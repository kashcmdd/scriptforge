"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

export default function DeleteAccount() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function run() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/account/delete", {
        method: "POST",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ confirm: true }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't delete your account.");
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="card danger-card">
      <span className="group-label">Danger zone</span>
      <h3>Delete account</h3>
      <p>
        Permanently removes your account and favorites, and hands your scripts
        over to an anonymous author. This can&apos;t be undone.
      </p>
      {!confirming ? (
        <button className="btn-ghost btn-small btn-danger" onClick={() => setConfirming(true)}>
          Delete account
        </button>
      ) : (
        <div className="panel-actions">
          <button className="btn-danger" onClick={run} disabled={busy}>
            {busy ? "Deleting…" : "Yes, delete my account"}
          </button>
          <button className="btn-ghost" onClick={() => setConfirming(false)} disabled={busy}>
            Cancel
          </button>
        </div>
      )}
      {error && <p className="form-err">{error}</p>}
    </div>
  );
}