// Run the pipeline outside the UI (cron, CI, a terminal):
//   npm run run:pipeline -- "AI infrastructure beneficiaries outside the megacaps" 10000
import { createRun, runPipeline } from "../src/pipeline/run";
import { sql } from "../src/lib/db";

async function main() {
  const [text, amount = "10000", maxWeight = "0.2", minHoldings = "5"] = process.argv.slice(2);
  if (!text) {
    console.error('usage: npm run run:pipeline -- "<thesis>" [amount] [maxWeight] [minHoldings]');
    process.exit(1);
  }
  const id = await createRun({ text, amount: Number(amount), maxWeight: Number(maxWeight), minHoldings: Number(minHoldings) });
  console.log(`run ${id} started`);
  await runPipeline(id);
  const [r] = await sql`select status, error from runs where id = ${id}`;
  console.log(`run ${id}: ${r.status}${r.error ? ` (${r.error})` : ""}`);
  await sql.end();
  
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
