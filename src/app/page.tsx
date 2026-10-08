import Link from "next/link";
import { sql } from "../lib/db";
import RunForm from "../components/RunForm";

export const dynamic = "force-dynamic";

export default async function Home() {
  let runs: any[] = [];
  let dbError = "";
  try {
    runs = await sql`select r.id, r.status, r.created_at, t.text, t.amount
                     from runs r join theses t on t.id = r.thesis_id order by r.created_at desc limit 20`;
  } catch (e) {
    dbError = e instanceof Error ? e.message : String(e);
  }
  return (
    <>
      <h1>New research run</h1>
      <RunForm />
      <h2>Past runs</h2>
      {dbError && <p className="err">Database not reachable: {dbError}. See the README for setup.</p>}
      {!dbError && !runs.length && <p className="muted">No runs yet.</p>}
      {runs.map((r) => (
        <div className="card" key={r.id}>
          <Link href={`/runs/${r.id}`}>{r.text}</Link>
          <div className="muted">
            ${Number(r.amount).toLocaleString()} · {new Date(r.created_at).toLocaleString()} · <span className="pill">{r.status}</span>
          </div>
        </div>
      ))}
    </>
  );
}
