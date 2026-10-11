// Check active trade ideas against new closes and record the paper-portfolio snapshot.
// Schedule this (daily or weekly). It never regenerates a thesis.
import { monitorIdeas } from "../src/pipeline/monitor";
import { snapshotAll } from "../src/pipeline/snapshot";
import { sql } from "../src/lib/db";

async function main() {
  console.log("ideas", await monitorIdeas());
  console.log("snapshots", await snapshotAll());
  await sql.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
