"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { csrfHeaders } from "@/lib/csrf-client";

type ScriptDraft = {
  id: number;
  title: string;
  game: string;
  description: string | null;
  body: string;
  version: number;
};

export default function EditForm({ script }: { script: ScriptDraft }) {
  const router = useRouter();
  const [title, setTitle] = useState(script.title);
  const [game, setGame] = useState(script.game);
  const [description, setDescription] = useState(script.description ?? "");
  const [body, setBody] = useState(script.body);
  const [changelog, setChangelog] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setBusy(true);
    try {
      const res = await fetch(`/api/scripts/${script.id}`, {
        method: "PATCH",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, game, description, body, changelog }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't save changes.");
        return;
      }
      router.push(`/scripts/${script.id}`);
      router.refresh();
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-card" style={{ maxWidth: 640 }}>
      <p className="eyebrow">Edit — v{script.version}</p>
      <h1 className="auth-title">Edit script</h1>
      <p className="auth-sub">
        Saving creates <strong>v{script.version + 1}</strong> — the previous version stays in the history.
      </p>

      <form className="stack" onSubmit={save}>
        <label className="field">
          <span>Title</span>
          <input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={120} />
        </label>
        <label className="field">
          <span>Game</span>
          <input value={game} onChange={(e) => setGame(e.target.value)} required maxLength={60} />
        </label>
        <label className="field">
          <span>Description</span>
          <input value={description} onChange={(e) => setDescription(e.target.value)} maxLength={400} />
        </label>
        <label className="field">
          <span>What changed? (optional)</span>
          <input value={changelog} onChange={(e) => setChangelog(e.target.value)} placeholder="e.g. Retuned vertical to 9" maxLength={500} />
        </label>
        <label className="field">
          <span>Script body</span>
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={12}
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
          />
        </label>
        {error && <p className="form-err">{error}</p>}
        <div className="panel-actions">
          <button type="submit" disabled={busy}>
            {busy ? "Saving…" : "Save v" + (script.version + 1)}
          </button>
          <a className="btn btn-ghost" href={`/scripts/${script.id}`}>Cancel</a>
        </div>
      </form>
    </div>
  );
}