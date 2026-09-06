"use client";
import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

export default function UploadScriptPage() {
  const [title, setTitle] = useState("");
  const [game, setGame] = useState("");
  const [description, setDescription] = useState("");
  const [body, setBody] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);
    try {
      const res = await fetch("/api/scripts/upload", {
        method: "POST",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ title, game, description, body }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Upload failed.");
        return;
      }
      setMessage(`Script added as v${data.version ?? 1}.`);
      setTitle("");
      setGame("");
      setDescription("");
      setBody("");
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card" style={{ maxWidth: 560 }}>
      <p className="eyebrow">Admin</p>
      <h1 className="auth-title">Add a script</h1>
      <p className="auth-sub">
        Requires an admin account with a verified email — see ADMIN_EMAILS in your env.
      </p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input
            placeholder="e.g. Anti-Recoil v2"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Game</span>
          <input
            placeholder="e.g. Battle Royale"
            value={game}
            onChange={(e) => setGame(e.target.value)}
            required
          />
        </label>
        <label className="field">
          <span>Description</span>
          <input
            placeholder="A one-line summary (optional)"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="field">
          <span>Script body</span>
          <textarea
            placeholder="// Script source"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            required
            rows={10}
            style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}
          />
        </label>
        {error && <p className="form-err">{error}</p>}
        {message && !error && <p className="form-ok">{message}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Uploading…" : "Add script"}
        </button>
      </form>
    </div>
  );
}