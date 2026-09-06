import Database from "better-sqlite3";
import path from "path";

const SAMPLE_ANTI_RECOIL = `/*
 * Sample Anti-Recoil - pulls the right stick down while the trigger
 * is held, then recenters. Tune "vertical" to the weapon you use.
 */
int vertical = 8;

main {
    if (get_val(PS4_R2)) {
        set_val(PS4_RY, vertical);
        wait(20);
        set_val(PS4_RY, 0);
    }
}
`;

const SAMPLE_RAPID_FIRE = `/*
 * Sample Rapid Fire - fires on trigger press by pulsing R2.
 * Adjust pulse_ms for different weapons.
 */
int pulse_ms = 30;

main {
    if (get_val(PS4_R2) && event_press(PS4_R2)) {
        combo_run(pulse);
    }
}

combo pulse {
    set_val(PS4_R2, 100);
    wait(pulse_ms);
    set_val(PS4_R2, 0);
    wait(pulse_ms);
}
`;

const SAMPLE_SLIDE_CANCEL = `/*
 * Sample Slide Cancel - taps crouch on L3 press to slide-cancel.
 */
main {
    if (event_press(PS4_L3)) {
        combo_run(quick_slide);
    }
}

combo quick_slide {
    set_val(PS4_CIRCLE, 100);
    wait(120);
    set_val(PS4_CIRCLE, 0);
}
`;

const SAMPLE_AIM_ASSIST = `/*
 * Sample Aim Assist (Sports) - applies a gentle curve to the left
 * stick when ADS is held. Keep curve low and fair.
 */
int curve = 4;

main {
    if (get_val(PS4_L2)) {
        set_val(PS4_LX, get_val(PS4_LX) * curve);
        set_val(PS4_LY, get_val(PS4_LY) * curve);
    }
}
`;

const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data.sqlite");
export const db = new Database(dbPath);

db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    email_verified INTEGER NOT NULL DEFAULT 0,
    verify_token TEXT,
    verify_token_expires TEXT,
    reset_token TEXT,
    reset_token_expires TEXT,
    session_version INTEGER NOT NULL DEFAULT 0,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS scripts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    game TEXT NOT NULL,
    description TEXT,
    body TEXT NOT NULL,
    created_by INTEGER,
    downloads INTEGER NOT NULL DEFAULT 0,
    version INTEGER NOT NULL DEFAULT 1,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS script_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
    version INTEGER NOT NULL,
    title TEXT NOT NULL,
    body TEXT NOT NULL,
    changelog TEXT,
    created_by INTEGER,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS favorites (
    user_id INTEGER NOT NULL,
    script_id INTEGER NOT NULL,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, script_id)
  );

  CREATE INDEX IF NOT EXISTS idx_script_versions_script ON script_versions(script_id, version DESC);
  CREATE INDEX IF NOT EXISTS idx_scripts_game ON scripts(game);
  CREATE INDEX IF NOT EXISTS idx_scripts_downloads ON scripts(downloads DESC);
  CREATE INDEX IF NOT EXISTS idx_scripts_created_at ON scripts(created_at DESC);
  CREATE INDEX IF NOT EXISTS idx_scripts_created_by ON scripts(created_by);
  CREATE INDEX IF NOT EXISTS idx_favorites_user ON favorites(user_id);
`);

function ensureColumn(table: string, column: string, ddl: string) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string }[];
  if (!cols.some((c) => c.name === column)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${ddl}`);
  }
}

ensureColumn("users", "display_name", "display_name TEXT");
ensureColumn("users", "session_version", "session_version INTEGER NOT NULL DEFAULT 0");
ensureColumn("scripts", "version", "version INTEGER NOT NULL DEFAULT 1");
ensureColumn("scripts", "updated_at", "updated_at TEXT");
ensureColumn("scripts", "description", "description TEXT");
ensureColumn("scripts", "created_by", "created_by INTEGER");
ensureColumn("scripts", "downloads", "downloads INTEGER NOT NULL DEFAULT 0");

// Upgrade the two original placeholder samples to the richer seed bodies
// so the detail page has something worth reading.
const upgrade = db.prepare(
  "UPDATE scripts SET body = ?, description = ? WHERE title = ? AND body = ?"
);
upgrade.run(
  SAMPLE_ANTI_RECOIL,
  "Smart-stick anti-recoil for automatic weapons. Tune the vertical value to match your in-game sensitivity.",
  "Sample Anti-Recoil",
  "// placeholder GPC body\ncombo main {}\n"
);
upgrade.run(
  SAMPLE_RAPID_FIRE,
  "Hair-trigger rapid fire with an adjustable pulse rate. Use with semi-auto and burst weapons.",
  "Sample Rapid Fire",
  "// placeholder GPC body\ncombo main {}\n"
);

// Backfill a v1 history snapshot for any script that doesn't have one yet.
function backfillScriptVersions() {
  const existing = db
    .prepare("SELECT COUNT(*) as c FROM script_versions sv JOIN scripts s ON s.id = sv.script_id WHERE sv.version = 1")
    .get() as { c: number };
  if (existing.c > 0) return;

  const scripts = db
    .prepare("SELECT id, title, body, created_by FROM scripts ORDER BY id")
    .all() as { id: number; title: string; body: string; created_by: number | null }[];

  const insert = db.prepare(
    "INSERT INTO script_versions (script_id, version, title, body, changelog, created_by) VALUES (?, 1, ?, ?, NULL, ?)"
  );
  for (const s of scripts) {
    insert.run(s.id, s.title, s.body, s.created_by);
  }
}
backfillScriptVersions();

const count = (db.prepare("SELECT COUNT(*) as c FROM scripts").get() as { c: number }).c;
if (count === 0) {
  const insert = db.prepare(
    "INSERT INTO scripts (title, game, description, body, downloads, version) VALUES (?, ?, ?, ?, 0, 1)"
  );
  const insertVersion = db.prepare(
    "INSERT INTO script_versions (script_id, version, title, body, changelog, created_by) VALUES (?, 1, ?, ?, NULL, NULL)"
  );
  const seed = (
    title: string,
    game: string,
    description: string,
    body: string,
  ) => {
    const result = insert.run(title, game, description, body);
    insertVersion.run(Number(result.lastInsertRowid), title, body);
  };
  seed(
    "Sample Anti-Recoil",
    "Generic FPS",
    "Smart-stick anti-recoil for automatic weapons. Tune the vertical value to match your in-game sensitivity.",
    SAMPLE_ANTI_RECOIL
  );
  seed(
    "Sample Rapid Fire",
    "Generic FPS",
    "Hair-trigger rapid fire with an adjustable pulse rate. Use with semi-auto and burst weapons.",
    SAMPLE_RAPID_FIRE
  );
  seed(
    "Sample Slide Cancel",
    "Battle Royale",
    "Movement helper that taps crouch on L3 to slide-cancel around corners.",
    SAMPLE_SLIDE_CANCEL
  );
  seed(
    "Sample Aim Assist",
    "Generic Sports",
    "Gentle left-stick curve while aiming down sights. Keep the value low and fair.",
    SAMPLE_AIM_ASSIST
  );
}

export type NewScriptInput = {
  title: string;
  game: string;
  description: string | null;
  body: string;
  createdBy: number;
};

export function createScript(input: NewScriptInput): number {
  const tx = db.transaction(() => {
    const result = db
      .prepare(
        "INSERT INTO scripts (title, game, description, body, created_by, version, updated_at) VALUES (?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP)"
      )
      .run(input.title, input.game, input.description, input.body, input.createdBy);
    const id = Number(result.lastInsertRowid);
    db.prepare(
      "INSERT INTO script_versions (script_id, version, title, body, changelog, created_by) VALUES (?, 1, ?, ?, NULL, ?)"
    ).run(id, input.title, input.body, input.createdBy);
    return id;
  });
  return tx();
}

export type ScriptPatch = {
  title?: string;
  game?: string;
  description?: string | null;
  body?: string;
  changelog?: string | null;
  createdBy: number;
};

export function updateScript(id: number, patch: ScriptPatch): { version: number } | null {
  const script = db
    .prepare("SELECT id, title, game, description, body, version FROM scripts WHERE id = ?")
    .get(id) as
    | { id: number; title: string; game: string; description: string | null; body: string; version: number }
    | undefined;
  if (!script) return null;

  const title = patch.title ?? script.title;
  const game = patch.game ?? script.game;
  const description = patch.description === undefined ? script.description : patch.description;
  const body = patch.body ?? script.body;

  const contentChanged =
    title !== script.title || game !== script.game || description !== script.description || body !== script.body;

  if (!contentChanged) {
    return { version: script.version };
  }

  const version = script.version + 1;

  const tx = db.transaction(() => {
    db.prepare(
      "UPDATE scripts SET title = ?, game = ?, description = ?, body = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, game, description, body, version, id);
    db.prepare(
      "INSERT INTO script_versions (script_id, version, title, body, changelog, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, version, title, body, patch.changelog || null, patch.createdBy);
    return version;
  });
  return { version: tx() };
}

export function bumpSessionVersion(userId: number) {
  db.prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?").run(userId);
}

export function listScriptVersions(scriptId: number) {
  return db
    .prepare(
      `SELECT v.version, v.changelog, v.created_at, u.email AS author_email, u.display_name AS author_name
       FROM script_versions v LEFT JOIN users u ON u.id = v.created_by
       WHERE v.script_id = ? ORDER BY v.version DESC`
    )
    .all(scriptId) as {
    version: number;
    changelog: string | null;
    created_at: string;
    author_email: string | null;
    author_name: string | null;
  }[];
}

export type SortKey = "recent" | "downloads" | "az";

export function listScripts(opts: {
  q?: string;
  game?: string;
  favOnly?: boolean;
  userId?: number;
  sort?: SortKey;
  page?: number;
  perPage?: number;
}) {
  const where: string[] = [];
  const args: (string | number)[] = [];

  if (opts.q) {
    where.push("lower(title) LIKE ?");
    args.push(`%${opts.q.toLowerCase()}%`);
  }
  if (opts.game) {
    where.push("game = ?");
    args.push(opts.game);
  }
  if (opts.favOnly && opts.userId) {
    where.push("EXISTS (SELECT 1 FROM favorites f WHERE f.script_id = scripts.id AND f.user_id = ?)");
    args.push(opts.userId);
  }
  const whereSql = where.length ? ` WHERE ${where.join(" AND ")}` : "";

  const total = (db.prepare(`SELECT COUNT(*) as c FROM scripts${whereSql}`).get(...args) as { c: number }).c;

  const order =
    opts.sort === "downloads"
      ? "downloads DESC, id DESC"
      : opts.sort === "az"
        ? "lower(title) ASC, id ASC"
        : "created_at DESC, id DESC";

  const perPage = opts.perPage || 8;
  const totalPages = Math.max(1, Math.ceil(total / perPage));
  const page = Math.min(Math.max(1, opts.page || 1), totalPages);
  const offset = (page - 1) * perPage;

  const rows = db
    .prepare(
      `SELECT id, title, game, downloads, version, created_at FROM scripts${whereSql} ORDER BY ${order} LIMIT ? OFFSET ?`
    )
    .all(...args, perPage, offset) as {
    id: number;
    title: string;
    game: string;
    downloads: number;
    version: number;
    created_at: string;
  }[];

  return { rows, total, page, perPage, pages: totalPages };
}