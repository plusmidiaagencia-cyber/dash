/**
 * Aplica um arquivo .sql no Postgres do Supabase usando a DATABASE_URL.
 * Uso: node scripts/apply-sql.mjs scripts/sql/0001_init.sql
 */
import postgres from "postgres";
import fs from "node:fs";
import path from "node:path";

function loadEnv() {
  const p = path.resolve(".env.local");
  if (fs.existsSync(p)) {
    for (const line of fs.readFileSync(p, "utf8").split("\n")) {
      const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim();
    }
  }
}

loadEnv();
const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL ausente");
  process.exit(1);
}
const file = process.argv[2];
if (!file) {
  console.error("Informe o arquivo .sql");
  process.exit(1);
}

const sqlText = fs.readFileSync(path.resolve(file), "utf8");
const sql = postgres(url, { prepare: false });

try {
  await sql.unsafe(sqlText);
  console.log(`✅ aplicado: ${file}`);
} catch (e) {
  console.error("❌ erro ao aplicar:", e.message);
  process.exitCode = 1;
} finally {
  await sql.end();
}
