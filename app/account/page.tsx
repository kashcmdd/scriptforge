import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import LogoutButton from "./logout-button";
import DeleteButton from "./delete-button";
import DeleteAccount from "./delete-account";
import ResendVerify from "./resend-verify";
import ProfileForm from "./profile-form";
import PasswordForm from "./password-form";

const TAG_COLORS: Record<string, string> = {
  "Generic FPS": "var(--coral)",
  "Generic Sports": "var(--gold)",
  "Battle Royale": "var(--teal)",
};

type ScriptRow = { id: number; title: string; game: string; downloads: number };

function rowTag(game: string) {
  return TAG_COLORS[game] || "var(--teal)";
}

function ScriptList({ scripts, canDelete }: { scripts: ScriptRow[]; canDelete?: boolean }) {
  if (scripts.length === 0) {
    return <p className="empty">Nothing here yet.</p>;
  }
  return (
    <div className="script-list">
      {scripts.map((s) => (
        <div className="script-row" key={s.id}>
          <div className="tag" style={{ background: rowTag(s.game), color: rowTag(s.game) }} />
          <div className="script-meta">
            <a className="script-title" href={`/scripts/${s.id}`}>{s.title}</a>
            <span className="script-game">{s.game}</span>
          </div>
          <span className="dl-count">⇣ {s.downloads}</span>
          <a className="btn btn-outline btn-small" href={`/scripts/${s.id}/edit`}>
            Edit
          </a>
          <a className="btn btn-outline btn-small" href={`/api/scripts/${s.id}/download`}>
            Download
          </a>
          {canDelete && <DeleteButton scriptId={s.id} />}
        </div>
      ))}
    </div>
  );
}

export default async function AccountPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = db
    .prepare("SELECT email, display_name, email_verified, created_at FROM users WHERE id = ?")
    .get(session.userId) as { email: string; display_name: string | null; email_verified: number; created_at: string } | undefined;

  if (!user) redirect("/login");

  const admin = isAdmin(session.email);

  const myScripts = db
    .prepare("SELECT id, title, game, downloads FROM scripts WHERE created_by = ? ORDER BY created_at DESC")
    .all(session.userId) as ScriptRow[];

  const favoriteScripts = db
    .prepare(
      `SELECT s.id, s.title, s.game, s.downloads FROM scripts s
       JOIN favorites f ON f.script_id = s.id
       WHERE f.user_id = ? ORDER BY f.created_at DESC`
    )
    .all(session.userId) as ScriptRow[];

  const allScripts = admin
    ? (db.prepare("SELECT id, title, game, downloads FROM scripts ORDER BY created_at DESC").all() as ScriptRow[])
    : [];

  const memberSince = new Date(user.created_at).toLocaleDateString("en-US", {
    month: "short",
    year: "numeric",
  });

  return (
    <div>
      <div className="page-head">
        <p className="eyebrow">Account</p>
        <h1>{user.display_name || user.email}</h1>
        {user.display_name && <p className="lede">{user.email}</p>}
        <div className="meta-row" style={{ marginTop: user.display_name ? "1rem" : undefined }}>
          {user.email_verified ? (
            <span className="pill-ok">Email verified</span>
          ) : (
            <span className="pill-warn">
              Email not verified <ResendVerify />
            </span>
          )}
          <span className="meta-item">member since {memberSince}</span>
        </div>
      </div>

      <div className="panel-actions" style={{ marginBottom: "2rem" }}>
        <LogoutButton />
        <a className="btn btn-ghost" href="/scripts">Browse library</a>
        <a className="btn btn-ghost" href="/device">Connect device</a>
        {admin && <a className="btn btn-primary" href="/scripts/upload">Add a script</a>}
      </div>

      <div className="settings-grid">
        <section className="section">
          <h2>Profile</h2>
          <div className="card">
            <ProfileForm initial={user.display_name} />
          </div>
        </section>
        <section className="section">
          <h2>Security</h2>
          <div className="card">
            <PasswordForm />
          </div>
        </section>
      </div>

      <DeleteAccount />

      <section className="section">
        <h2>Your scripts</h2>
        <ScriptList scripts={myScripts} canDelete />
      </section>

      <section className="section">
        <h2>Favorites</h2>
        <ScriptList scripts={favoriteScripts} />
      </section>

      {admin && (
        <section className="section">
          <h2>All scripts (admin)</h2>
          <ScriptList scripts={allScripts} canDelete />
        </section>
      )}
    </div>
  );
}