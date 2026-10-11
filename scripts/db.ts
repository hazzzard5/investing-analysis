// Docker-free local Postgres: real Postgres binaries from npm, data kept in ./.data/pg.
// Starts on port 54322 (same as `supabase start`), applies migrations, and runs until Ctrl+C.
import { existsSync } from "node:fs";
import EmbeddedPostgres from "embedded-postgres";

const dir = ".data/pg";
const port = Number(process.env.LOCAL_DB_PORT ?? 54322);

async function main() {
  const pg = new EmbeddedPostgres({ databaseDir: dir, user: "postgres", password: "postgres", port, persistent: true });
  if (!existsSync(`${dir}/PG_VERSION`)) await pg.initialise();
  await pg.start();
  process.env.DATABASE_URL = `postgresql://postgres:postgres@127.0.0.1:${port}/postgres`;
  await import("./migrate");
  console.log(`Postgres ready on port ${port}. Leave this running; press Ctrl+C to stop.`);
  const stop = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
