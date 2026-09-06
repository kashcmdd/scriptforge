"use client";
import { useState } from "react";
import { csrfHeaders } from "@/lib/csrf-client";

export default function ResendVerify() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function resend() {
    setBusy(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/resend-verify", {
        method: "POST",
        headers: await csrfHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setMessage(data.alreadyVerified ? "Already verified." : "Verification email sent.");
      } else {
        setMessage(data.error || "Couldn't send. Try again later.");
      }
    } catch {
      setMessage("Couldn't send. Try again later.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="resend">
      <button type="button" className="linklike" onClick={resend} disabled={busy}>
        {busy ? "Sending…" : "Resend verification email"}
      </button>
      {message && <small>{message}</small>}
    </span>
  );
}