import { db, listScripts, type SortKey } from "@/lib/db";
import { getSession } from "@/lib/auth";
import FavButton from "./fav-button";

const TAG_COLORS: Record<string, string> = {
  "Generic FPS": "var(--coral)",
  "Generic Sports": "var(--gold)",
  "Battle Royale": "var(--teal)",
};

const SORTS: { key: SortKey; label: string }[] = [
  { key: "recent", label: "Recent" },
  { key: "downloads", label: "Most downloaded" },
  { key: "az", label: "A–Z" },
];

function qs(params: Record<string, string | undefined>): string {
  const parts = Object.entries(params)
    .filter(([, v]) => v && v.length > 0)
    .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v as string)}`);
  return parts.length ? `?${parts.join("&")}` : "";
}

export default async function ScriptsPage({
  searchParams,
}: {
  searchParams: { q?: string; game?: string; fav?: string; sort?: string; page?: string; verified?: string };
}) {
  const session = await getSession();
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : "";
  const game = typeof searchParams.game === "string" ? searchParams.game : "";
  const fav = typeof searchParams.fav === "string" ? searchParams.fav : "";
  const sort: SortKey = searchParams.sort === "downloads" || searchParams.sort === "az" ? searchParams.sort : "recent";
  const page = Math.max(1, Number(searchParams.page) || 1);

  const { rows: scripts, total, page: currentPage, pages } = listScripts({
    q,
    game,
    favOnly: fav === "1",
    userId: session?.userId,
    sort,
    page,
    perPage: 8,
  });

  const games = db.prepare("SELECT DISTINCT game FROM scripts ORDER BY game").all() as {
    game: string;
  }[];

  const favoriteIds = new Set<number>();
  if (session) {
    const rows = db.prepare("SELECT script_id FROM favorites WHERE user_id = ?").all(session.userId) as {
      script_id: number;
    }[];
    for (const row of rows) favoriteIds.add(row.script_id);
  }

  const hasFilters = Boolean(q || game || fav === "1");
  const from = total === 0 ? 0 : (currentPage - 1) * 8 + 1;
  const to = Math.min(total, currentPage * 8);
  const pageHref = (p: number) => qs({ q, game, fav: fav === "1" ? "1" : undefined, sort, page: p > 1 ? String(p) : undefined });

  return (
    <div>
      <div className="page-head">
        <p className="eyebrow">Library</p>
        <h1>Script library</h1>
        <p className="lede">
          {session
            ? `Signed in as ${session.email} — downloads ready.`
            : "Log in to download scripts — anyone can browse titles."}
        </p>
      </div>

      {searchParams.verified === "1" && (
        <div className="pill-ok">Email verified — you&apos;re all set.</div>
      )}

      <form className="search-form" method="get" action="/scripts">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search scripts…"
          aria-label="Search scripts"
        />
        {game && <input type="hidden" name="game" value={game} />}
        {fav === "1" && <input type="hidden" name="fav" value="1" />}
        {sort !== "recent" && <input type="hidden" name="sort" value={sort} />}
        <button type="submit">Search</button>
      </form>

      <div className="chips">
        <a
          className={`chip${!game && fav !== "1" ? " is-active" : ""}`}
          href={qs({ q, fav: undefined, game: undefined, sort })}
        >
          All
        </a>
        {games.map((g) => (
          <a key={g.game} className={`chip${game === g.game && fav !== "1" ? " is-active" : ""}`} href={qs({ q, game: g.game, sort })}>
            {g.game}
          </a>
        ))}
        {session && (
          <a className={`chip${fav === "1" ? " is-active" : ""}`} href={qs({ q, fav: "1", sort })}>
            Favorites
          </a>
        )}
      </div>

      <div className="toolbar">
        <span className="toolbar-label">Sort</span>
        <div className="chips toolbar-chips">
          {SORTS.map((s) => (
            <a
              key={s.key}
              className={`chip${sort === s.key ? " is-active" : ""}`}
              href={qs({ q, game, fav: fav === "1" ? "1" : undefined, sort: s.key !== "recent" ? s.key : undefined })}
            >
              {s.label}
            </a>
          ))}
        </div>
        {hasFilters && (
          <a className="filter-note toolbar-clear" href="/scripts">Clear filters</a>
        )}
      </div>

      {scripts.length === 0 ? (
        <div className="empty">
          <p className="eyebrow">No matches</p>
          <p>Nothing here yet. Try a different search or filter.</p>
        </div>
      ) : (
        <div className="script-list">
          {scripts.map((s) => (
            <div className="script-row" key={s.id}>
              <div
                className="tag"
                style={{ background: TAG_COLORS[s.game] || "var(--teal)", color: TAG_COLORS[s.game] || "var(--teal)" }}
              />
              <div className="script-meta">
                <a className="script-title" href={`/scripts/${s.id}`}>
                  {s.title}
                </a>
                <span className="script-game">{s.game} · v{s.version}</span>
              </div>
              <span className="dl-count">⇣ {s.downloads}</span>
              {session && <FavButton scriptId={s.id} initial={favoriteIds.has(s.id)} />}
              {session && (
                <a className="btn btn-outline btn-small" href={`/api/scripts/${s.id}/download`}>
                  Download
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {total > 0 && (
        <div className="pagination">
          <span className="page-indicator">
            Showing {from}–{to} of {total}
          </span>
          <div className="panel-actions">
            <a
              className={`btn btn-ghost btn-small${currentPage <= 1 ? " is-disabled" : ""}`}
              href={currentPage > 1 ? pageHref(currentPage - 1) : undefined}
              aria-disabled={currentPage <= 1}
            >
              Prev
            </a>
            <span className="page-indicator">
              page {currentPage} of {pages}
            </span>
            <a
              className={`btn btn-ghost btn-small${currentPage >= pages ? " is-disabled" : ""}`}
              href={currentPage < pages ? pageHref(currentPage + 1) : undefined}
              aria-disabled={currentPage >= pages}
            >
              Next
            </a>
          </div>
        </div>
      )}
    </div>
  );
}