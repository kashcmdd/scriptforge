"use client";
import { useState } from "react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/auth/request-reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      setMessage(data.message || "If that email has an account, a reset link has been sent.");
    } catch {
      setMessage("Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Account recovery</p>
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-sub">Enter your email and we&apos;ll send a reset link if an account exists.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>Email</span>
          <input
            type="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </label>
        <button type="submit" disabled={loading}>
          {loading ? "Sending…" : "Send reset link"}
        </button>
      </form>

      {message && <p className="form-ok" style={{ marginTop: "1.1rem" }}>{message}</p>}

      <p className="form-link"><a href="/login">Back to login</a></p>
    </div>
  );
}