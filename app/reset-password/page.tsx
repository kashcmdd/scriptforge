"use client";
import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function ResetPasswordForm() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") || "";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Something went wrong.");
        return;
      }
      router.push("/login");
    } catch {
      setError("Something went wrong. Try again in a moment.");
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-card">
        <p className="eyebrow">Reset link</p>
        <p className="lede">
          This link is missing a reset token. Request a new one from the forgot-password page.
        </p>
        <p className="form-link"><a href="/forgot-password">Request a new link</a></p>
      </div>
    );
  }

  return (
    <div className="auth-card">
      <p className="eyebrow">Almost there</p>
      <h1 className="auth-title">Choose a new password</h1>
      <p className="auth-sub">Make it at least 8 characters with a letter and a number.</p>

      <form className="stack" onSubmit={handleSubmit}>
        <label className="field">
          <span>New password</span>
          <input
            type="password"
            placeholder="New password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </label>
        {error && <p className="form-err">{error}</p>}
        <button type="submit" disabled={loading}>
          {loading ? "Saving…" : "Save new password"}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={<p className="lede">Loading…</p>}>
      <ResetPasswordForm />
    </Suspense>
  );
}