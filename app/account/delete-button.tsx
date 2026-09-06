"use client";
import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

export default function DeleteButton({ scriptId }: { scriptId: number }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);

  async function run() {
    setBusy(true);
    try {
      const res = await fetch(`/api/scripts/${scriptId}`, {
        method: "DELETE",
        headers: await csrfHeaders(),
      });
      if (res.ok) {
        window.location.reload();
        return;
      }
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  if (!confirming) {
    return (
      <button className="btn-ghost btn-small btn-danger" onClick={() => setConfirming(true)} disabled={busy}>
        Delete
      </button>
    );
  }

  return (
    <span className="inline-confirm">
      <button className="btn-danger" onClick={run} disabled={busy}>
        {busy ? "Deleting…" : "Confirm"}
      </button>
      <button className="btn-ghost btn-small" onClick={() => setConfirming(false)} disabled={busy}>
        Cancel
      </button>
    </span>
  );
}