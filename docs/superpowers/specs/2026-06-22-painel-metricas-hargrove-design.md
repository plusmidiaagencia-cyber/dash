# Painel de Métricas HARGROVE — Design (Fase 1)

> Spec de design. Data: 2026-06-22. Autor: Plus Mídia / HARGROVE.
> Estilo de referência: bkdash.com.br / utmify.com.br — porém recortado ao que faz sentido hoje: **Shopify + Facebook Ads**.

## 1. Objetivo

Construir um painel web que mostra o **lucro real** (não só faturamento) da loja HARGROVE, juntando dados de Shopify e Facebook Ads e calculando custos, margem, ROAS, CPA, funil e meta de faturamento — em GBP.

Esta é a **Fase 1**: foco na loja HARGROVE, mas com arquitetura limpa pronta para virar multi-tenant (Fase 2) e produto/SaaS (Fase 3).

### Roadmap (contexto, fora do escopo desta fase)
- **Fase 1 (este spec):** painel da HARGROVE, totais da loja, Shopify + Facebook Ads.
- **Fase 2:** multi-tenant + multi-loja; quebra por campanha (atribuição UTM) e por produto.
- **Fase 3:** billing/assinatura, onboarding self-service, mais integrações (TikTok, Google Ads, gateways), times.

## 2. Decisões fechadas

| Tema | Decisão |
|---|---|
| Escopo | Fase 1 só HARGROVE; arquitetura pronta p/ multi-tenant |
| CMV (custo do produto) | Campo "Custo por item" (Cost per item) do Shopify, capturado no momento do pedido |
| Custos no lucro | Gateway + frete que você paga + operacional fixo + extras/reembolsos |
| Impostos/VAT | Fora da Fase 1 |
| Nível de detalhe | Totais da loja (sem quebra por campanha/produto) |
| Shopify | Tempo real via webhooks |
| Facebook | 1x/dia via Cron da Vercel + botão "Atualizar agora" |
| Hosting | Vercel (plano Hobby), repo `plusmidiaagencia-cyber/dash` |
| Banco/Auth | Supabase (Postgres + Auth + RLS), região Americas |
| Moeda | GBP (multi-moeda fora da Fase 1) |
| Arquitetura de dados | Eventos crus armazenados + cálculo na hora (on-the-fly) |

## 3. Stack

- **Next.js (App Router) + TypeScript**, deploy na Vercel.
- **Supabase**: Postgres (dados), Auth (login), RLS (isolamento).
- **Drizzle ORM** para schema, migrations e queries tipadas no servidor.
- **Tailwind CSS** + **Recharts** para UI/gráficos. Tema dark na paleta HARGROVE
  (`--charcoal:#1B1B1B`, `--offwhite:#F6F4F0`, `--greige:#A39A8C`, `--champagne:#C2A878`).
- Acesso ao banco **somente pelo servidor** (rotas/route handlers / server actions) usando a connection string / service role. O navegador nunca lê tabelas crus.

## 4. Arquitetura de dados (eventos crus → cálculo on-the-fly)

Princípio: armazenamos os **eventos crus** (pedidos do Shopify, gasto diário do Facebook) e **calculamos os KPIs no momento** em que o painel é aberto, para qualquer período. Sem tabela de agregados pré-calculados (desnecessário no volume atual; fica para Fase 2 se precisar).

```
Shopify  --webhook (HMAC)-->  /api/webhooks/shopify  -->  orders, order_items, refunds
Facebook --cron 1x/dia----->  /api/cron/facebook     -->  ad_spend_daily
Painel   --GET------------->  /api/metrics?period=... -->  calcula e devolve KPIs
```

### Fluxo Shopify (tempo real)
- App **custom/privado** no admin da HARGROVE com Admin API token.
- Webhooks assinados: `orders/create`, `orders/paid`, `orders/updated`, `orders/cancelled`, `refunds/create`.
- Endpoint `/api/webhooks/shopify`:
  - Verifica **HMAC** do header `X-Shopify-Hmac-Sha256`. Inválido → `401`.
  - **Idempotente**: usa o ID do pedido/evento como chave única (upsert) — reenvio não duplica.
  - Captura `cost_per_item` por linha **no momento** → CMV histórico correto mesmo se o custo mudar depois.

### Fluxo Facebook (1x/dia + manual)
- **Cron da Vercel** (`vercel.json`) chama `/api/cron/facebook` 1x/dia (limite do plano Hobby).
  - Rota protegida por header `Authorization: Bearer ${CRON_SECRET}`.
- Busca na Marketing API (Insights), por dia, para o ad account:
  - **gasto** (`spend`);
  - **ações do pixel**: `landing_page_view` / `view_content` / `add_to_cart` / `initiate_checkout` / `purchase` → fonte do **funil**.
- Botão **"Atualizar agora"** no painel chama a mesma rota (autenticado) para repuxe sob demanda.

> **Nota sobre o funil:** reflete o **tráfego pago do Facebook** (atribuído aos anúncios), não o tráfego total da loja. É o que ferramentas como bkdash mostram e é o relevante para decisão de tráfego. Funil de tráfego total da loja (pixel próprio na loja) fica para Fase 2.

## 5. Modelo de dados (tabelas)

Multi-tenant-ready: tudo pendura em `store_id`. Na Fase 1 existe 1 conta, 1 usuário, 1 loja.

- **`auth.users`** — usuários de login, geridos pelo Supabase Auth.
- **`accounts`** — o "tenant" (Fase 1: 1 conta). `id`, `name`.
- **`profiles`** — liga `auth.users` ↔ `accounts` (papel do usuário na conta).
- **`stores`** — `id`, `account_id`, `name`, `currency` (default `GBP`), `revenue_goal`.
- **`connections`** — `store_id`, `provider` (`shopify`|`facebook`), credenciais **criptografadas**, `status`, `last_synced_at`.
- **`orders`** — `id` (Shopify order id), `store_id`, `created_at`, `processed_at`, `financial_status`, `total_price`, `subtotal`, `total_discounts`, `currency`, `gateway`, `transaction_fee` (quando disponível).
- **`order_items`** — `order_id`, `product_id`, `variant_id`, `title`, `quantity`, `unit_price`, `unit_cost` (cost per item capturado).
- **`refunds`** — `id`, `order_id`, `store_id`, `created_at`, `amount`.
- **`ad_spend_daily`** — `store_id`, `date`, `spend`, `page_views`, `view_content`, `add_to_cart`, `initiate_checkout`, `purchases`. Chave única (`store_id`,`date`) para upsert idempotente.
- **`cost_settings`** — `store_id`, `monthly_operational`, `shipping_mode` (`none`|`flat`|`percent`), `shipping_value`, `gateway_fee_percent_fallback`.
- **`manual_adjustments`** — `store_id`, `date`, `label`, `amount` (positivo = custo, negativo = crédito).

### Segurança (Supabase)
- **RLS ligado em todas as tabelas** de dados; sem RLS aberto.
- **"Automatically expose new tables" desligado** no projeto Supabase — tabelas sensíveis não vão para a Data API pública.
- Acesso aos dados só pelo **servidor** (service role / connection string em env var).
- Senha do banco e chaves vivem **apenas em env vars** (Vercel/Supabase), nunca em git.
- **Ação pendente do usuário:** resetar a senha do banco no Supabase (apareceu em screenshot).

## 6. Fórmulas dos KPIs

Para o período selecionado (e comparando com o período anterior de mesmo tamanho, para os deltas):

```
Faturamento   = Σ (total dos pedidos pagos) − Σ reembolsos
CMV           = Σ (unit_cost × quantity) dos itens vendidos no período
Gasto Ads     = Σ ad_spend_daily.spend
Taxas Gateway = Σ transaction_fee real das transações Shopify
                (fallback: Faturamento × gateway_fee_percent_fallback)
Frete (você)  = conforme cost_settings.shipping_mode:
                  none    → 0 (custo já embutido no unit_cost)
                  flat    → shipping_value × nº de pedidos
                  percent → Faturamento × shipping_value
Operacional   = (monthly_operational ÷ dias do mês) × dias do período
Extras        = Σ reembolsos + Σ manual_adjustments

LUCRO LÍQUIDO = Faturamento − CMV − Gasto Ads − Taxas Gateway − Frete − Operacional − Extras
Margem        = Lucro ÷ Faturamento          (0 se Faturamento = 0)
ROAS          = Faturamento ÷ Gasto Ads      (— se Gasto = 0)
ROI           = Lucro ÷ Gasto Ads            (— se Gasto = 0)
CPA           = Gasto Ads ÷ nº de pedidos    (— se pedidos = 0)
Ticket Médio  = Faturamento ÷ nº de pedidos  (0 se pedidos = 0)
Unidades      = Σ quantity
Conversão     = purchases ÷ page_views       (funil do Facebook; 0 se page_views = 0)
Funil         = page_views → view_content → add_to_cart → initiate_checkout → purchases
Meta          = Faturamento ÷ stores.revenue_goal
```

Todos os KPIs exibem o **delta vs período anterior** (verde/vermelho).
Divisões por zero retornam 0 ou "—" (nunca quebram a tela).

## 7. Telas (Fase 1)

1. **Login** — Supabase Auth (email + senha).
2. **Dashboard** (tela principal, conforme mockup `dash-mockup/`):
   - Filtros: período (Hoje / Ontem / 7 dias / Este mês / Mês passado / Custom) e moeda GBP.
   - KPIs: Lucro líquido, Faturamento, Custos totais, Taxas, Margem.
   - Funil de conversão (Facebook), Meta de faturamento (gauge).
   - Investido em ads, CPA, ROI, ROAS, CMV, Pedidos, Ticket médio, Conversão, Unidades.
   - Gasto por canal (Facebook; Shopify pedidos; outros).
   - Gráfico Faturamento × Lucro × Custos por dia.
   - Botão "Atualizar agora" (repuxe Facebook) + selo "atualizado há X".
3. **Configurações:**
   - Conectar Shopify (domínio + Admin API token) e Facebook (access token + ad account + pixel).
   - Custos: operacional mensal, modo/valor de frete, % de gateway fallback.
   - Meta de faturamento.
   - Lançar ajustes manuais (extras/créditos).

## 8. Erros & resiliência

- Webhook com HMAC inválido → `401`, ignora.
- Webhook idempotente (upsert por id) → sem duplicidade em reenvio.
- Falha no poll do Facebook → mantém o último dado bom; painel mostra "desatualizado desde X"; não quebra.
- Token Shopify/Facebook expirado/inválido → aviso claro em Configurações para reconectar; `connections.status = error`.
- Rate limit do Facebook → backoff + tenta no próximo cron.
- Tudo em GBP; valores em moeda diferente são convertidos na entrada ou marcados (multi-moeda fora de escopo).

## 9. Testes

- **Unitários das fórmulas** (crítico): conjuntos fixos de pedidos/reembolsos/gasto → lucro/margem/ROAS esperados, incluindo casos de divisão por zero.
- **Parser de webhook**: verificação HMAC (válido/inválido) e idempotência (mesmo evento 2x).
- **Cliente Facebook**: mock da Marketing API → cálculo de gasto e funil.
- **Cálculo de período anterior** (deltas) para os ranges padrão.

## 10. Variáveis de ambiente (Vercel)

```
# Supabase
SUPABASE_URL=https://zwcokxivesfpvheonpqu.supabase.co
SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
DATABASE_URL=postgres://...           # connection string (Drizzle)

# Shopify
SHOPIFY_STORE_DOMAIN=hargrovelondon.myshopify.com
SHOPIFY_ADMIN_API_TOKEN=...
SHOPIFY_WEBHOOK_SECRET=...

# Facebook (Marketing API)
META_ACCESS_TOKEN=...
META_ACCOUNT_ID=act_...
META_API_VERSION=v21.0
META_PIXEL_ID=...

# Cron
CRON_SECRET=...
```

## 11. Fora de escopo (Fase 2/3)

Multi-tenant ativo, multi-loja, quebra por campanha/produto (atribuição UTM), TikTok/Google Ads, gateways extras, impostos/VAT, multi-moeda, billing/assinatura, funil de tráfego total da loja (pixel próprio), agregados pré-calculados.
