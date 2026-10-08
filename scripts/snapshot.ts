import { snapshotAll } from "../src/pipeline/snapshot";
import { sql } from "../src/lib/db";

async function main() {
  console.log(await snapshotAll());
  await sql.end();
  
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
