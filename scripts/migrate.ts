// Apply supabase/migrations/*.sql to DATABASE_URL (for plain Postgres; `supabase start` applies them itself).
import { readdirSync, readFileSync } from "node:fs";
import { sql } from "../src/lib/db";

async function main() {
  await sql`create table if not exists _migrations (name text primary key, applied_at timestamptz default now())`;
  for (const f of readdirSync("supabase/migrations").filter((f) => f.endsWith(".sql")).sort()) {
    const [done] = await sql`select 1 from _migrations where name = ${f}`;
    if (done) continue;
    await sql.begin(async (tx) => {
      await tx.unsafe(readFileSync(`supabase/migrations/${f}`, "utf8"));
      await tx`insert into _migrations (name) values (${f})`;
    });
    console.log("applied", f);
  }
  await sql.end();
  
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
