"use client";
import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

export default function PasswordForm() {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setMessage("");
    setError("");
    setBusy(true);
    try {
      const res = await fetch("/api/account/password", {
        method: "POST",
        headers: await csrfHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify({ old_password: oldPassword, new_password: newPassword }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error || "Couldn't change the password.");
        return;
      }
      setMessage("Password updated.");
      setOldPassword("");
      setNewPassword("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form className="stack" onSubmit={save}>
      <label className="field">
        <span>Current password</span>
        <input
          type="password"
          value={oldPassword}
          onChange={(e) => setOldPassword(e.target.value)}
          required
        />
      </label>
      <label className="field">
        <span>New password</span>
        <input
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          placeholder="8+ chars, letter + number"
          required
        />
      </label>
      {error && <p className="form-err">{error}</p>}
      {message && !error && <p className="form-ok">{message}</p>}
      <button type="submit" disabled={busy}>
        {busy ? "Saving…" : "Update password"}
      </button>
    </form>
  );
}