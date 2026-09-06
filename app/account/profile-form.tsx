"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

export default function ProfileForm({ initial }: { initial: string | null }) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(initial ?? "");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/profile", {
        method: "PATCH",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ display_name: displayName }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save.");
        return;
      }
      setMessage("Saved.");
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <label className="field">
        <span>Display name</span>
        <input
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="What should people call you?"
          maxLength={48}
        />
      </label>
      {error && <p className="form-err">{error}</p>}
      {message && !error && <p className="form-ok">{message}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Save profile"}
      </button>
    </form>
  );
}