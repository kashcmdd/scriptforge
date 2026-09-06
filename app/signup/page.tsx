"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function SignupPage() {
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
      const res = await fetch("/api/auth/signup", {
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
      <p className="eyebrow">Join the hub</p>
      <h1 className="auth-title">Create account</h1>
      <p className="auth-sub">Free to sign up — your scripts, your device, your call.</p>

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
            placeholder="8+ chars, letter + number"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-err">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Creating account…" : "Sign up"}
        </button>
      </form>

      <p className="form-link">Already registered? <a href="/login">Log in</a></p>
    </div>
  );
}