"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({ error: "Unexpected response from server." }));
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/scripts");
    } catch {
      setError("Couldn't reach the server. Check your connection and try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Welcome back</p>
      <h1 className="auth-title">Log in</h1>
      <p className="auth-sub">Access your saved scripts and device tools.</p>

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
        <label className="field">
          <span>Password</span>
          <input
            type="password"
            placeholder="Your password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-err">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Logging in…" : "Log in"}
        </button>
      </form>

      <p className="form-link"><a href="/forgot-password">Forgot your password?</a></p>
      <p className="form-link">New here? <a href="/signup">Create an account</a></p>
    </div>
  );
}