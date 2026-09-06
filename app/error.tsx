"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="auth-card" style={{ textAlign: "center" }}>
      <p className="eyebrow">System fault</p>
      <h1 className="auth-title">Something broke</h1>
      <p className="auth-sub">
        The page hit an unexpected error. You can try again, or head back home.
      </p>
      <div className="panel-actions" style={{ justifyContent: "center" }}>
        <button onClick={() => reset()}>Try again</button>
        <a className="btn btn-ghost" href="/">Back home</a>
      </div>
    </div>
  );
}