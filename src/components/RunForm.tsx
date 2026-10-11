"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function RunForm() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const f = new FormData(e.currentTarget);
    setBusy(true);
    setError("");
    const res = await fetch("/api/runs", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        text: f.get("text"),
        amount: Number(f.get("amount")),
        maxWeight: Number(f.get("maxPct")) / 100,
        minHoldings: Number(f.get("minHoldings")),
        candidates: Number(f.get("candidates")),
      }),
    });
    const body = await res.json();
    if (!res.ok) {
      setError(body.error ?? "Something went wrong");
      setBusy(false);
      return;
    }
    router.push(`/runs/${body.id}`);
  }

  return (
    <form onSubmit={submit} className="card">
      <label>
        Thesis
        <textarea name="text" rows={3} required placeholder="AI infrastructure beneficiaries outside the megacaps" />
      </label>
      <div className="row">
        <label>
          Amount ($)
          <input name="amount" type="number" min="1" defaultValue={10000} required />
        </label>
        <label>
          Max per stock (%)
          <input name="maxPct" type="number" min="1" max="100" defaultValue={20} required />
        </label>
        <label>
          Min holdings
          <input name="minHoldings" type="number" min="1" defaultValue={5} required />
        </label>
        <label>
          Stocks to analyse in depth
          <input name="candidates" type="number" min="5" max="12" defaultValue={8} required />
        </label>
      </div>
      <button disabled={busy}>{busy ? "Starting…" : "Run research"}</button>
      {error && <p className="err">{error}</p>}
    </form>
  );
}
