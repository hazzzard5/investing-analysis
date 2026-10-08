import postgres from "postgres";

const g = globalThis as unknown as { __sql?: postgres.Sql };

export const sql: postgres.Sql =
  g.__sql ??
  (g.__sql = postgres(
    process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
    { max: Number(process.env.DB_POOL_MAX ?? 5), onnotice: () => {} },
  ));
