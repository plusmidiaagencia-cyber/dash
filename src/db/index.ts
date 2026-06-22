/**
 * Cliente do banco (Drizzle + postgres.js).
 * Transaction pooler do Supabase => prepare:false.
 * Lazy: só conecta quando usado (não quebra build/sample-data).
 */
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

let _client: ReturnType<typeof postgres> | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

function client() {
  if (_client) return _client;
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL não configurada");
  _client = postgres(url, { prepare: false });
  return _client;
}

export function getDb() {
  if (_db) return _db;
  _db = drizzle(client(), { schema });
  return _db;
}

/** Cliente postgres.js cru, para leituras agregadas. */
export function sql() {
  return client();
}

export { schema };
