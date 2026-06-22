# Painel de Métricas HARGROVE — Plano de Implementação (Fase 1)

> Plano derivado de `../specs/2026-06-22-painel-metricas-hargrove-design.md`. Data: 2026-06-22.
> Cada milestone é entregável e verificável sozinho. Ordem importa.

## Convenções
- Branch por milestone (`m0-scaffold`, `m1-db`, ...), PR/merge na `main` → deploy automático na Vercel.
- TypeScript estrito. Lint + typecheck antes de cada merge.
- Segredos só em env vars (Vercel/Supabase), nunca no git.
- "✅ Verificação" = como saber que o milestone ficou pronto.

---

## M0 — Scaffold + pipeline de deploy
**Objetivo:** app Next.js mínimo no ar na Vercel, provando o pipeline.
- `create-next-app` (App Router, TS, Tailwind, ESLint) na raiz do repo `dash`.
- Tema base dark + paleta HARGROVE (tokens CSS).
- Página `/` "em construção".
- `.env.example` com todas as chaves da seção 10 do spec.
- `.gitignore` cobrindo `.env*`.
- **✅ Verificação:** push na `main` → deploy verde na Vercel → URL abre a página.

## M1 — Banco (Supabase + Drizzle) + segurança
**Objetivo:** schema completo, migrations e RLS.
- Configurar Drizzle apontando pra `DATABASE_URL` do Supabase.
- Tabelas (spec §5): `accounts`, `profiles`, `stores`, `connections`, `orders`, `order_items`, `refunds`, `ad_spend_daily`, `cost_settings`, `manual_adjustments`.
- Índices: `orders(store_id, processed_at)`, único `ad_spend_daily(store_id, date)`, `order_items(order_id)`.
- **RLS ligado em todas**; políticas: acesso só do dono via `account_id`/`profiles`; service role para ingestão.
- Desligar "Automatically expose new tables" no projeto Supabase.
- Seed: 1 account, 1 store (HARGROVE, GBP), `cost_settings` default.
- Criptografia das credenciais em `connections`.
- **✅ Verificação:** `drizzle migrate` aplica; seed cria a loja; cliente anon não lê tabelas (RLS); servidor lê via service role.

## M2 — Autenticação
**Objetivo:** login funcionando, rotas protegidas.
- Supabase Auth (email + senha). Criar 1 usuário (você) ligado ao `profile`/`account`.
- Middleware: rotas `/dashboard` e `/settings` exigem sessão; senão → `/login`.
- Helpers de sessão server-side.
- **✅ Verificação:** sem login → redireciona; com login → entra; logout encerra.

## M3 — Configurações + conexões + custos
**Objetivo:** cadastrar credenciais e parâmetros de custo.
- Tela `/settings`:
  - Conexão Shopify (domínio + Admin API token) e Facebook (access token + `act_` + pixel) → grava em `connections` (criptografado), testa e marca `status`.
  - Custos: `monthly_operational`, `shipping_mode`+`shipping_value`, `gateway_fee_percent_fallback`.
  - `revenue_goal`.
  - Ajustes manuais (CRUD em `manual_adjustments`).
- **✅ Verificação:** salvar/recarregar persiste; teste de conexão acusa token inválido.

## M4 — Ingestão Shopify (tempo real)
**Objetivo:** pedidos entram via webhook, idempotentes, com CMV.
- Criar app custom no admin HARGROVE; registrar webhooks (`orders/create|paid|updated|cancelled`, `refunds/create`).
- `POST /api/webhooks/shopify`: verifica **HMAC**; upsert idempotente em `orders`/`order_items`/`refunds`; captura `unit_cost` (cost per item).
- **Backfill** inicial: script que importa pedidos recentes (ex.: últimos 60–90 dias) via Admin API.
- **✅ Verificação:** pedido teste no Shopify aparece no banco em segundos; reenvio não duplica; HMAC inválido → 401; backfill popula histórico.

## M5 — Ingestão Facebook (1x/dia + manual)
**Objetivo:** gasto e funil diários no banco.
- Cliente Marketing API (Insights) reaproveitando padrão do `Hargrove Agent/meta_client.py` (porta TS).
- `GET /api/cron/facebook` (protegida por `CRON_SECRET`): puxa por dia `spend` + ações do pixel → upsert em `ad_spend_daily`.
- `vercel.json` com cron 1x/dia.
- Botão "Atualizar agora" no painel chama a rota (autenticado).
- Backoff/erro → mantém último dado, marca `last_synced_at`.
- **✅ Verificação:** cron popula `ad_spend_daily`; "Atualizar agora" força repuxe; falha de API não quebra.

## M6 — Motor de métricas (cálculo on-the-fly)
**Objetivo:** todas as fórmulas do spec §6, com período anterior.
- Módulo puro `lib/metrics` (sem I/O) recebendo dados crus → KPIs.
- `GET /api/metrics?from=&to=`: lê eventos crus, calcula KPIs + deltas vs período anterior + série diária (Faturamento/Lucro/Custos) + funil.
- **Testes unitários** das fórmulas (incluindo divisão por zero) — crítico.
- **✅ Verificação:** testes passam; com dados de seed os números batem com cálculo manual.

## M7 — Dashboard (UI)
**Objetivo:** a tela do mockup, ligada à API real.
- Layout: sidebar + topbar (loja, "atualizado há X", filtro de período, GBP, "Atualizar agora").
- Filtro de período: Hoje / Ontem / 7 dias / Este mês / Mês passado / Custom.
- Cards KPI (Lucro, Faturamento, Custos, Taxas, Margem, CPA, ROI, ROAS, CMV, Pedidos, Ticket, Conversão, Unidades) com deltas.
- Funil (Facebook), gauge da meta, gasto por canal, gráfico Faturamento×Lucro×Custos (Recharts).
- Estados de loading/erro/vazio.
- Base visual no mockup `dash-mockup/index.html`.
- **✅ Verificação:** dashboard mostra dados reais; trocar período recalcula; "Atualizar agora" reflete novo gasto FB.

## M8 — Acabamento + go-live
**Objetivo:** produção estável.
- Selo "desatualizado desde X" quando uma fonte falha.
- Avisos de token expirado em Configurações.
- Revisão de segurança (RLS, nenhuma chave vazando pro client, rotas protegidas).
- Deploy de produção + smoke test ponta a ponta (pedido real → aparece; cron FB → gasto aparece; lucro confere).
- **✅ Verificação:** fluxo completo validado em produção com dados reais da HARGROVE.

---

## Pré-requisitos do usuário (em paralelo, quando chegar a hora)
- Resetar senha do banco no Supabase; pôr chaves nas env vars da Vercel.
- Preencher "Custo por item" nos produtos do Shopify (custo do fornecedor + frete dele).
- Criar app custom no Shopify e gerar Admin API token.
- Confirmar tokens do Facebook (Marketing API) e o `act_`/pixel corretos.

## Ordem de execução
M0 → M1 → M2 → M3 → (M4 e M5 em paralelo) → M6 → M7 → M8.
