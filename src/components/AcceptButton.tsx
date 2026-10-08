"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function AcceptButton({ portfolioId }: { portfolioId: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await fetch(`/api/portfolios/${portfolioId}/accept`, { method: "POST" });
        router.refresh();
      }}
    >
      {busy ? "Starting…" : "Start paper tracking"}
    </button>
  );
}
