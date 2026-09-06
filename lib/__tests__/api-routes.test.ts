import { describe, it, expect, beforeEach, vi } from "vitest";
import { NextRequest } from "next/server";
import { resetRateLimits } from "@/lib/rate-limit";
import { db } from "@/lib/db";
import { csrfFails } from "@/lib/csrf";

process.env.ADMIN_EMAILS = "admin@example.com";

const session = vi.hoisted(() => ({
  current: null as { userId: number; email: string } | null,
}));

vi.mock("@/lib/auth", () => ({
  getSession: () => Promise.resolve(session.current),
  createSession: () => Promise.resolve(),
  clearSession: () => Promise.resolve(),
}));

vi.mock("@/lib/db", async () => {
  const Database = (await import("better-sqlite3")).default;
  const db = new Database(":memory:");
  db.exec(`
    CREATE TABLE users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      email_verified INTEGER NOT NULL DEFAULT 0,
      verify_token TEXT,
      verify_token_expires TEXT,
      reset_token TEXT,
      reset_token_expires TEXT,
      session_version INTEGER NOT NULL DEFAULT 0,
      display_name TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE scripts (
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

    CREATE TABLE script_versions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      script_id INTEGER NOT NULL REFERENCES scripts(id) ON DELETE CASCADE,
      version INTEGER NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      changelog TEXT,
      created_by INTEGER,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE favorites (
      user_id INTEGER NOT NULL,
      script_id INTEGER NOT NULL,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id, script_id)
    );
  `);

  const seedResult = db
    .prepare("INSERT INTO scripts (title, game, description, body, created_by, downloads) VALUES (?, ?, ?, ?, ?, ?)")
    .run("Seed Script", "Generic FPS", null, "// hi\ncombo main {}", null, 4);
  const seedId = Number(seedResult.lastInsertRowid);
  db.prepare(
    "INSERT INTO script_versions (script_id, version, title, body, changelog, created_by) VALUES (?, 1, 'Seed Script', '// hi\ncombo main {}', NULL, NULL)"
  ).run(seedId);

  const createScript = (input: { title: string; game: string; description: string | null; body: string; createdBy: number }) => {
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
  };

  const updateScript = (id: number, patch: { title?: string; game?: string; description?: string | null; body?: string; changelog?: string | null; createdBy: number }) => {
    const script = db.prepare("SELECT id, title, game, description, body, version FROM scripts WHERE id = ?").get(id) as any;
    if (!script) return null;
    const title = patch.title ?? script.title;
    const game = patch.game ?? script.game;
    const description = patch.description === undefined ? script.description : patch.description;
    const body = patch.body ?? script.body;
    const contentChanged =
      title !== script.title || game !== script.game || description !== script.description || body !== script.body;
    if (!contentChanged) return { version: script.version };
    const version = script.version + 1;
    db.prepare(
      "UPDATE scripts SET title = ?, game = ?, description = ?, body = ?, version = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
    ).run(title, game, description, body, version, id);
    db.prepare(
      "INSERT INTO script_versions (script_id, version, title, body, changelog, created_by) VALUES (?, ?, ?, ?, ?, ?)"
    ).run(id, version, title, body, patch.changelog || null, patch.createdBy);
    return { version };
  };

  const listScriptVersions = (scriptId: number) =>
    db
      .prepare(
        `SELECT v.version, v.changelog, v.created_at, u.email AS author_email, u.display_name AS author_name
         FROM script_versions v LEFT JOIN users u ON u.id = v.created_by
         WHERE v.script_id = ? ORDER BY v.version DESC`
      )
      .all(scriptId);

  const bumpSessionVersion = (userId: number) => {
    db.prepare("UPDATE users SET session_version = session_version + 1 WHERE id = ?").run(userId);
  };

  return { db, createScript, updateScript, listScriptVersions, bumpSessionVersion };
});

import { POST as signupPOST } from "@/app/api/auth/signup/route";
import { POST as loginPOST } from "@/app/api/auth/login/route";
import { GET as verifyGET } from "@/app/api/auth/verify/route";
import { POST as requestResetPOST } from "@/app/api/auth/request-reset/route";
import { POST as resetPasswordPOST } from "@/app/api/auth/reset-password/route";
import { POST as resendVerifyPOST } from "@/app/api/auth/resend-verify/route";
import { POST as uploadPOST } from "@/app/api/scripts/upload/route";
import { GET as downloadGET } from "@/app/api/scripts/[id]/download/route";
import { POST as favoritePOST } from "@/app/api/scripts/[id]/favorite/route";
import { PATCH as patchScript, DELETE as deleteScript, GET as getScript } from "@/app/api/scripts/[id]/route";
import { GET as versionsGET } from "@/app/api/scripts/[id]/versions/route";
import { GET as scriptsListGET } from "@/app/api/scripts/route";
import { GET as healthGET } from "@/app/api/health/route";
import { GET as csrfGET } from "@/app/api/csrf/route";
import { PATCH as patchProfile } from "@/app/api/account/profile/route";
import { POST as accountPasswordPOST } from "@/app/api/account/password/route";
import { POST as accountDeletePOST } from "@/app/api/account/delete/route";

function post(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function patch(url: string, body?: unknown) {
  return new NextRequest(url, {
    method: "PATCH",
    headers: { "content-type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
}

function call(handler: (req: NextRequest, params?: any) => Promise<Response>, req: NextRequest, params?: any) {
  return handler(req, params);
}

async function signupUser(email: string, password = "testpass123") {
  const res = await signupPOST(post("http://localhost:8000/api/auth/signup", { email, password }));
  return res;
}

function createUser(email: string, opts: { verified?: boolean } = {}) {
  db.prepare("DELETE FROM users WHERE email = ?").run(email);
  const result = db
    .prepare("INSERT INTO users (email, password_hash, email_verified) VALUES (?, 'x', ?)")
    .run(email, opts.verified ? 1 : 0);
  return Number(result.lastInsertRowid);
}

async function createVerifiedUser(email: string) {
  const id = createUser(email, { verified: true });
  session.current = { userId: id, email };
  return id;
}

async function createVerifiedAdmin() {
  const id = createUser("admin@example.com", { verified: true });
  session.current = { userId: id, email: "admin@example.com" };
}

const seedId = 1;

beforeEach(() => {
  resetRateLimits();
});

describe("signup", () => {
  it("creates an account", async () => {
    const res = await signupUser("a@test.com");
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ ok: true, emailVerified: false });

    const user = db.prepare("SELECT email, email_verified FROM users WHERE email = ?").get("a@test.com") as any;
    expect(user).toBeTruthy();
    expect(user.email_verified).toBe(0);
  });

  it("rejects a weak password", async () => {
    const res = await signupPOST(post("http://localhost:8000/api/auth/signup", { email: "weak@test.com", password: "onlyletters" }));
    expect(res.status).toBe(400);
    expect(await res.json()).toMatchObject({ error: "Password must include at least one letter and one number." });
  });

  it("rejects a duplicate email", async () => {
    await signupUser("dup@test.com");
    const res = await signupUser("dup@test.com");
    expect(res.status).toBe(409);
  });

  it("rate limits after 5 attempts", async () => {
    for (let i = 1; i <= 5; i++) {
      const res = await signupUser(`rl${i}@test.com`);
      expect(res.status).toBe(200);
    }
    const res = await signupUser("rl6@test.com");
    expect(res.status).toBe(429);
  });
});

describe("login", () => {
  it("rejects a wrong password", async () => {
    await signupUser("login@test.com");
    const res = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "login@test.com", password: "wrongpass" }));
    expect(res.status).toBe(401);
  });

  it("rejects an unknown email", async () => {
    const res = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "nobody@test.com", password: "whatever123" }));
    expect(res.status).toBe(401);
  });

  it("accepts a valid password", async () => {
    await signupUser("good@test.com");
    const res = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "good@test.com", password: "testpass123" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});

describe("upload", () => {
  it("forbids non-admin uploads", async () => {
    session.current = { userId: 1, email: "regular@test.com" };
    const res = await uploadPOST(post("http://localhost:8000/api/scripts/upload", { title: "t", game: "g", body: "b" }));
    expect(res.status).toBe(403);
  });

  it("forbids unverified admins from uploading", async () => {
    const id = createUser("admin@example.com", { verified: false });
    session.current = { userId: id, email: "admin@example.com" };
    const res = await uploadPOST(post("http://localhost:8000/api/scripts/upload", { title: "t", game: "g", body: "b" }));
    expect(res.status).toBe(403);
  });

  it("lets a verified admin add a script with description and version 1", async () => {
    await createVerifiedAdmin();
    const res = await call(uploadPOST, post("http://localhost:8000/api/scripts/upload", { title: "Recoil Killer", game: "Generic FPS", description: "Tames recoil.", body: "// body" }));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.version).toBe(1);

    const script = db.prepare("SELECT title, game, description, created_by, version FROM scripts WHERE id = ?").get(json.id) as any;
    expect(script.title).toBe("Recoil Killer");
    expect(script.description).toBe("Tames recoil.");
    expect(script.created_by).toBe(session.current!.userId);
    expect(script.version).toBe(1);

    const versions = db.prepare("SELECT COUNT(*) as c FROM script_versions WHERE script_id = ?").get(json.id) as any;
    expect(versions.c).toBe(1);
  });

  it("rejects a missing title even for admins", async () => {
    await createVerifiedAdmin();
    const res = await uploadPOST(post("http://localhost:8000/api/scripts/upload", { game: "g", body: "b" }));
    expect(res.status).toBe(400);
  });

  it("rejects an overly long title", async () => {
    await createVerifiedAdmin();
    const res = await uploadPOST(post("http://localhost:8000/api/scripts/upload", { title: "x".repeat(121), game: "g", body: "b" }));
    expect(res.status).toBe(400);
  });
});

describe("download", () => {
  it("requires login", async () => {
    session.current = null;
    const res = downloadGET(new NextRequest("http://localhost:8000/api/scripts/1/download"), { params: { id: String(seedId) } });
    expect((await res).status).toBe(401);
  });

  it("serves the script and increments downloads", async () => {
    await createVerifiedUser("user@test.com");
    const res = await downloadGET(new NextRequest("http://localhost:8000/api/scripts/1/download"), { params: { id: String(seedId) } });
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/plain");
    expect(res.headers.get("content-disposition")).toContain("seed_script.gpc");
    expect(await res.text()).toContain("combo main");

    const script = db.prepare("SELECT downloads FROM scripts WHERE id = ?").get(seedId) as { downloads: number };
    expect(script.downloads).toBe(5);
  });

  it("forbids unverified users from downloading", async () => {
    const id = createUser("unverified@test.com", { verified: false });
    session.current = { userId: id, email: "unverified@test.com" };
    const res = await downloadGET(new NextRequest("http://localhost:8000/api/scripts/1/download"), { params: { id: String(seedId) } });
    expect(res.status).toBe(403);
  });

  it("rejects an invalid id", async () => {
    await createVerifiedUser("user@test.com");
    const res = await downloadGET(new NextRequest("http://localhost:8000/api/scripts/abc/download"), { params: { id: "abc" } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing script", async () => {
    await createVerifiedUser("user@test.com");
    const res = await downloadGET(new NextRequest("http://localhost:8000/api/scripts/9999/download"), { params: { id: "9999" } });
    expect(res.status).toBe(404);
  });
});

describe("favorites", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await favoritePOST(post("http://localhost:8000/api/scripts/1/favorite", { favorited: true }), { params: { id: "1" } });
    expect(res.status).toBe(401);
  });

  it("toggles favorite on and off", async () => {
    session.current = { userId: 3, email: "fav@test.com" };
    const on = await favoritePOST(post("http://localhost:8000/api/scripts/1/favorite", { favorited: true }), { params: { id: "1" } });
    expect((await on.json()).favorited).toBe(true);
    expect(db.prepare("SELECT COUNT(*) as c FROM favorites").get() as any).toMatchObject({ c: 1 });

    const off = await favoritePOST(post("http://localhost:8000/api/scripts/1/favorite", { favorited: false }), { params: { id: "1" } });
    expect((await off.json()).favorited).toBe(false);
    expect(db.prepare("SELECT COUNT(*) as c FROM favorites").get() as any).toMatchObject({ c: 0 });
  });

  it("is idempotent for duplicate favorites", async () => {
    session.current = { userId: 3, email: "fav@test.com" };
    await favoritePOST(post("http://localhost:8000/api/scripts/1/favorite", { favorited: true }), { params: { id: "1" } });
    await favoritePOST(post("http://localhost:8000/api/scripts/1/favorite", { favorited: true }), { params: { id: "1" } });
    expect(db.prepare("SELECT COUNT(*) as c FROM favorites").get() as any).toMatchObject({ c: 1 });
  });

  it("returns 404 for a missing script", async () => {
    session.current = { userId: 3, email: "fav@test.com" };
    const res = await favoritePOST(post("http://localhost:8000/api/scripts/9999/favorite", { favorited: true }), { params: { id: "9999" } });
    expect(res.status).toBe(404);
  });
});

describe("delete", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await deleteScript(new NextRequest("http://localhost:8000/api/scripts/1", { method: "DELETE" }), { params: { id: "1" } });
    expect(res.status).toBe(401);
  });

  it("forbids non-admin, non-owner deletion", async () => {
    session.current = { userId: 4, email: "outsider@test.com" };
    const res = await deleteScript(new NextRequest("http://localhost:8000/api/scripts/1", { method: "DELETE" }), { params: { id: "1" } });
    expect(res.status).toBe(403);
  });

  it("lets an owner delete their own script and its versions", async () => {
    const info = db.prepare("INSERT INTO scripts (title, game, body, created_by) VALUES ('own', 'g', 'b', 5)").run();
    const ownId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO script_versions (script_id, version, title, body) VALUES (?, 1, 'own', 'b')").run(ownId);
    session.current = { userId: 5, email: "owner@test.com" };
    const res = await deleteScript(new NextRequest("http://localhost:8000/api/scripts/" + ownId, { method: "DELETE" }), { params: { id: String(ownId) } });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT id FROM scripts WHERE id = ?").get(ownId)).toBeUndefined();
    expect(db.prepare("SELECT COUNT(*) as c FROM script_versions WHERE script_id = ?").get(ownId) as any).toMatchObject({ c: 0 });
  });

  it("lets an admin delete any script", async () => {
    const info = db.prepare("INSERT INTO scripts (title, game, body, created_by) VALUES ('admin', 'g', 'b', null)").run();
    const adminId = Number(info.lastInsertRowid);
    await createVerifiedAdmin();
    const res = await deleteScript(new NextRequest("http://localhost:8000/api/scripts/" + adminId, { method: "DELETE" }), { params: { id: String(adminId) } });
    expect(res.status).toBe(200);
    expect(db.prepare("SELECT id FROM scripts WHERE id = ?").get(adminId)).toBeUndefined();
  });
});

describe("email verification", () => {
  it("rejects a bad token", async () => {
    const res = await verifyGET(new NextRequest("http://localhost:8000/api/auth/verify?token=nope"));
    expect(res.status).toBe(400);
  });

  it("verifies a valid token and clears it", async () => {
    await signupUser("verify@test.com");
    const user = db.prepare("SELECT id, verify_token FROM users WHERE email = ?").get("verify@test.com") as any;
    expect(user.verify_token).toBeTruthy();

    const res = await verifyGET(new NextRequest(`http://localhost:8000/api/auth/verify?token=${user.verify_token}`));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/scripts?verified=1");

    const after = db.prepare("SELECT email_verified, verify_token FROM users WHERE id = ?").get(user.id) as any;
    expect(after.email_verified).toBe(1);
    expect(after.verify_token).toBeNull();
  });
});

describe("resend verification", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await resendVerifyPOST(post("http://localhost:8000/api/auth/resend-verify"));
    expect(res.status).toBe(401);
  });

  it("regenerates the token for an unverified user", async () => {
    await signupUser("resend@test.com");
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get("resend@test.com") as { id: number };
    session.current = { userId: user.id, email: "resend@test.com" };
    const res = await resendVerifyPOST(post("http://localhost:8000/api/auth/resend-verify"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, alreadyVerified: false });
  });

  it("does nothing for an already-verified user", async () => {
    db.prepare("UPDATE users SET email_verified = 1 WHERE email = ?").run("resend@test.com");
    const res = await resendVerifyPOST(post("http://localhost:8000/api/auth/resend-verify"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, alreadyVerified: true });
  });
});

describe("password reset", () => {
  it("does not leak whether an email exists", async () => {
    const res = await requestResetPOST(post("http://localhost:8000/api/auth/request-reset", { email: "not-here@test.com" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({
      ok: true,
      message: "If that email has an account, a reset link has been sent.",
    });
  });

  it("resets the password so the old one stops working", async () => {
    await signupUser("reset@test.com", "oldpass123");
    await requestResetPOST(post("http://localhost:8000/api/auth/request-reset", { email: "reset@test.com" }));

    const user = db.prepare("SELECT reset_token FROM users WHERE email = ?").get("reset@test.com") as any;
    expect(user.reset_token).toBeTruthy();

    const reset = await resetPasswordPOST(
      post("http://localhost:8000/api/auth/reset-password", { token: user.reset_token, password: "newpass456" })
    );
    expect(reset.status).toBe(200);

    const oldLogin = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "reset@test.com", password: "oldpass123" }));
    expect(oldLogin.status).toBe(401);

    const newLogin = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "reset@test.com", password: "newpass456" }));
    expect(newLogin.status).toBe(200);
  });
});

describe("account profile", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await patchProfile(patch("http://localhost:8000/api/account/profile", { display_name: "Zed" }));
    expect(res.status).toBe(401);
  });

  it("sets and clears a display name", async () => {
    await createVerifiedUser("prof@test.com");
    const set = await patchProfile(patch("http://localhost:8000/api/account/profile", { display_name: "  Zed  " }));
    expect(set.status).toBe(200);
    expect(await set.json()).toEqual({ ok: true, displayName: "Zed" });

    const user = db.prepare("SELECT display_name FROM users WHERE id = ?").get(session.current!.userId) as any;
    expect(user.display_name).toBe("Zed");

    const clear = await patchProfile(patch("http://localhost:8000/api/account/profile", { display_name: "" }));
    expect(clear.status).toBe(200);
    expect((await clear.json()).displayName).toBeNull();
  });

  it("rejects an over-long display name", async () => {
    await createVerifiedUser("prof@test.com");
    const res = await patchProfile(patch("http://localhost:8000/api/account/profile", { display_name: "x".repeat(49) }));
    expect(res.status).toBe(400);
  });
});

describe("account password", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await accountPasswordPOST(post("http://localhost:8000/api/account/password", { old_password: "x", new_password: "whatever1" }));
    expect(res.status).toBe(401);
  });

  it("rejects a wrong current password", async () => {
    const id = createUser("pw@test.com", { verified: true });
    session.current = { userId: id, email: "pw@test.com" };
    const res = await accountPasswordPOST(post("http://localhost:8000/api/account/password", { old_password: "nope", new_password: "newpass456" }));
    expect(res.status).toBe(400);
  });

  it("changes the password so the old one stops working", async () => {
    await signupUser("change@test.com", "oldpass123");
    const user = db.prepare("SELECT id FROM users WHERE email = ?").get("change@test.com") as { id: number };
    session.current = { userId: user.id, email: "change@test.com" };

    const res = await accountPasswordPOST(post("http://localhost:8000/api/account/password", { old_password: "oldpass123", new_password: "newpass456" }));
    expect(res.status).toBe(200);

    const oldLogin = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "change@test.com", password: "oldpass123" }));
    expect(oldLogin.status).toBe(401);

    const newLogin = await loginPOST(post("http://localhost:8000/api/auth/login", { email: "change@test.com", password: "newpass456" }));
    expect(newLogin.status).toBe(200);
  });

  it("validates the new password strength", async () => {
    const id = createUser("pw@test.com", { verified: true });
    session.current = { userId: id, email: "pw@test.com" };
    const res = await accountPasswordPOST(post("http://localhost:8000/api/account/password", { old_password: "a", new_password: "weak" }));
    expect(res.status).toBe(400);
  });
});

describe("script editing (PATCH)", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await patchScript(patch("http://localhost:8000/api/scripts/1", { title: "x" }), { params: { id: "1" } });
    expect(res.status).toBe(401);
  });

  it("forbids non-owner/non-admin edits", async () => {
    session.current = { userId: 99, email: "outsider@test.com" };
    const res = await patchScript(patch("http://localhost:8000/api/scripts/1", { title: "x" }), { params: { id: "1" } });
    expect(res.status).toBe(403);
  });

  it("lets an owner edit and bumps the version with history", async () => {
    const info = db.prepare("INSERT INTO scripts (title, game, body, created_by) VALUES ('mine', 'g', '// v1', 42)").run();
    const ownId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO script_versions (script_id, version, title, body, created_by) VALUES (?, 1, 'mine', '// v1', 42)").run(ownId);
    session.current = { userId: 42, email: "owner@test.com" };

    const res = await patchScript(
      patch("http://localhost:8000/api/scripts/" + ownId, { title: "mine v2", body: "// v2", changelog: "harden main" }),
      { params: { id: String(ownId) } }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 2 });

    const script = db.prepare("SELECT title, body, version FROM scripts WHERE id = ?").get(ownId) as any;
    expect(script.title).toBe("mine v2");
    expect(script.body).toBe("// v2");
    expect(script.version).toBe(2);

    const versions = db.prepare("SELECT version, changelog FROM script_versions WHERE script_id = ? ORDER BY version").all(ownId) as any[];
    expect(versions).toHaveLength(2);
    expect(versions[1]).toMatchObject({ version: 2, changelog: "harden main" });
  });

  it("does not bump the version for a content-less edit", async () => {
    const info = db.prepare("INSERT INTO scripts (title, game, body, created_by) VALUES ('same', 'g', 'b', 7)").run();
    const sameId = Number(info.lastInsertRowid);
    db.prepare("INSERT INTO script_versions (script_id, version, title, body, created_by) VALUES (?, 1, 'same', 'b', 7)").run(sameId);
    session.current = { userId: 7, email: "owner@test.com" };

    const res = await patchScript(
      patch("http://localhost:8000/api/scripts/" + sameId, { game: "g", changelog: "no actual change" }),
      { params: { id: String(sameId) } }
    );
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, version: 1 });
    expect(db.prepare("SELECT COUNT(*) as c FROM script_versions WHERE script_id = ?").get(sameId) as any).toMatchObject({ c: 1 });
  });

  it("rejects an invalid title", async () => {
    const id = createUser("owner@test.com", { verified: true });
    const info = db.prepare("INSERT INTO scripts (title, game, body, created_by) VALUES ('mine', 'g', 'b', ?)").run(id);
    const ownId = Number(info.lastInsertRowid);
    session.current = { userId: id, email: "owner@test.com" };
    const res = await patchScript(patch("http://localhost:8000/api/scripts/" + ownId, { title: "" }), { params: { id: String(ownId) } });
    expect(res.status).toBe(400);
  });

  it("returns 404 for a missing script", async () => {
    await createUser("owner@test.com", { verified: true });
    session.current = { userId: 55, email: "owner@test.com" };
    const res = await patchScript(patch("http://localhost:8000/api/scripts/9999", { title: "x" }), { params: { id: "9999" } });
    expect(res.status).toBe(404);
  });
});

describe("script versions route", () => {
  it("returns the version list for a script", async () => {
    const res = await versionsGET(new NextRequest("http://localhost:8000/api/scripts/1/versions"), { params: { id: "1" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.versions).toHaveLength(1);
    expect(json.versions[0].version).toBe(1);
  });

  it("returns 404 for a missing script", async () => {
    const res = await versionsGET(new NextRequest("http://localhost:8000/api/scripts/9999/versions"), { params: { id: "9999" } });
    expect(res.status).toBe(404);
  });
});

describe("script list + detail routes", () => {
  it("lists scripts", async () => {
    const res = await scriptsListGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.scripts.length).toBeGreaterThan(0);
    expect(json.scripts).toContainEqual(expect.objectContaining({ id: seedId, title: "Seed Script" }));
  });

  it("serves a single script with version", async () => {
    const res = await getScript(new NextRequest("http://localhost:8000/api/scripts/1"), { params: { id: "1" } });
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.script.version).toBe(1);
    expect(json.script.body).toContain("combo main");
  });

  it("returns 404 for a missing script", async () => {
    const res = await getScript(new NextRequest("http://localhost:8000/api/scripts/9999"), { params: { id: "9999" } });
    expect(res.status).toBe(404);
  });
});

describe("account delete", () => {
  it("requires login", async () => {
    session.current = null;
    const res = await accountDeletePOST(post("http://localhost:8000/api/account/delete", { confirm: true }));
    expect(res.status).toBe(401);
  });

  it("requires confirmation", async () => {
    await createVerifiedUser("victim@test.com");
    const res = await accountDeletePOST(post("http://localhost:8000/api/account/delete"));
    expect(res.status).toBe(400);
  });

  it("removes the account, favorites, and re-homes scripts", async () => {
    const id = createUser("victim@test.com", { verified: true });
    db.prepare("INSERT INTO favorites (user_id, script_id) VALUES (?, ?)").run(id, seedId);
    const info = db.prepare("INSERT INTO scripts (title, game, body, created_by) VALUES ('mine', 'g', 'b', ?)").run(id);
    const mineId = Number(info.lastInsertRowid);
    session.current = { userId: id, email: "victim@test.com" };

    const res = await accountDeletePOST(post("http://localhost:8000/api/account/delete", { confirm: true }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
    expect(db.prepare("SELECT id FROM users WHERE id = ?").get(id)).toBeUndefined();
    expect((db.prepare("SELECT COUNT(*) as c FROM favorites WHERE user_id = ?").get(id) as any).c).toBe(0);
    expect((db.prepare("SELECT created_by FROM scripts WHERE id = ?").get(mineId) as any).created_by).toBeNull();
  });
});

describe("health", () => {
  it("reports healthy", async () => {
    const res = await healthGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.ok).toBe(true);
    expect(json.db).toBe("ok");
  });
});

describe("csrf", () => {
  it("issues a token", async () => {
    const res = await csrfGET();
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(typeof json.token).toBe("string");
    expect(json.token.length).toBeGreaterThan(20);
  });

  it("accepts matching header + cookie", () => {
    const req = new NextRequest("http://localhost:8000/api/scripts/1", {
      method: "DELETE",
      headers: { cookie: "csrf_token=abc123", "x-csrf-token": "abc123" },
    });
    expect(csrfFails(req)).toBe(false);
  });

  it("rejects a missing or mismatched token", () => {
    const empty = new NextRequest("http://localhost:8000/api/scripts/1", { method: "DELETE" });
    expect(csrfFails(empty)).toBe(true);

    const mismatch = new NextRequest("http://localhost:8000/api/scripts/1", {
      method: "DELETE",
      headers: { cookie: "csrf_token=abc123", "x-csrf-token": "nope" },
    });
    expect(csrfFails(mismatch)).toBe(true);
  });
});