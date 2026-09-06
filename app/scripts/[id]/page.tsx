import { notFound } from "next/navigation";
import { db, listScriptVersions } from "@/lib/db";
import { getSession } from "@/lib/auth";
import { isAdmin } from "@/lib/admin";
import CodeView from "@/app/scripts/code-view";
import FavButton from "@/app/scripts/fav-button";
import CopyButton from "@/app/scripts/copy-button";
import ScriptPreview from "@/app/scripts/script-preview";

export default async function ScriptDetailPage({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  if (!Number.isInteger(id)) notFound();

  const script = db
    .prepare(
      `SELECT s.id, s.title, s.game, s.description, s.body, s.downloads, s.version,
              s.created_at, s.updated_at, u.email AS author_email, u.display_name AS author_name
       FROM scripts s LEFT JOIN users u ON u.id = s.created_by WHERE s.id = ?`
    )
    .get(id) as
    | {
        id: number;
        title: string;
        game: string;
        description: string | null;
        body: string;
        downloads: number;
        version: number;
        created_at: string;
        updated_at: string | null;
        author_email: string | null;
        author_name: string | null;
      }
    | undefined;

  if (!script) notFound();

  const session = await getSession();
  const favorited = session
    ? Boolean(db.prepare("SELECT 1 FROM favorites WHERE user_id = ? AND script_id = ?").get(session.userId, id))
    : false;
  const canEdit = session && (isAdmin(session.email) || script.author_email === session.email);
  const verified = session ? Boolean(db.prepare("SELECT 1 FROM users WHERE id = ? AND email_verified = 1").get(session.userId)) : false;

  const date = (iso: string) =>
    new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
  const versions = listScriptVersions(id);
  const author = script.author_name || script.author_email;

  return (
    <div>
      <div className="page-head">
        <p className="eyebrow">{script.game}</p>
        <h1>{script.title}</h1>
        <div className="meta-row">
          <span className="meta-item">v{script.version}</span>
          <span className="meta-item">⇣ {script.downloads} downloads</span>
          <span className="meta-item">
            {script.updated_at && script.updated_at !== script.created_at
              ? `edited ${date(script.updated_at)}`
              : `added ${date(script.created_at)}`}
          </span>
          {author && <span className="meta-item">by {author}</span>}
        </div>
      </div>

      {script.description && <p className="lede">{script.description}</p>}

      <div className="panel-actions" style={{ marginBottom: "1.5rem" }}>
        {!session ? (
          <a className="btn btn-primary" href="/login">
            Log in to download
          </a>
        ) : verified ? (
          <a className="btn btn-primary" href={`/api/scripts/${script.id}/download`}>
            Download .gpc
          </a>
        ) : (
          <a className="btn btn-primary" href="/account">
            Verify your email to download
          </a>
        )}
        {session && <FavButton scriptId={script.id} initial={favorited} />}
        <CopyButton text={script.body} />
        {canEdit && (
          <a className="btn btn-ghost btn-small" href={`/scripts/${script.id}/edit`}>
            Edit
          </a>
        )}
      </div>

      {session && !verified && (
        <p className="pill-warn" style={{ marginBottom: "1.5rem" }}>
          Only verified accounts can download — head to /account to verify your email.
        </p>
      )}

      <section className="section">
        <h2>Flow preview</h2>
        <ScriptPreview body={script.body} />
      </section>

      <section className="section">
        <h2>Source</h2>
        <CodeView code={script.body} />
      </section>

      {versions.length > 0 && (
        <section className="section">
          <h2>Version history</h2>
          <div className="history-list">
            {versions.map((v) => (
              <div className="history-item" key={v.version}>
                <span className="history-ver">v{v.version}</span>
                <span className="history-meta">
                  {date(v.created_at)}
                  {(v.author_email || v.author_name) && ` · ${v.author_name || v.author_email}`}
                </span>
                <span className="history-log">{v.changelog || "—"}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}