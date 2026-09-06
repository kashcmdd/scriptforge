const { test, expect } = require("@playwright/test");

const unique = () => `pw-${Date.now()}@test.com`;

test("homepage loads", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("ScriptForge Hub")).toBeVisible();
});

test("health endpoint responds ok", async ({ request }) => {
  const res = await request.get("/api/health");
  expect(res.status()).toBe(200);
  expect(await res.json()).toMatchObject({ ok: true, db: "ok" });
});

test("library lists sample scripts with sorting", async ({ page }) => {
  await page.goto("/scripts");
  await expect(page.getByRole("heading", { name: "Script library" })).toBeVisible();
  await expect(page.getByText("Sample Anti-Recoil")).toBeVisible();
  await page.getByRole("link", { name: "A\u2013Z" }).click();
  await expect(page).toHaveURL(/sort=az/);
  await expect(page.getByRole("link", { name: "A\u2013Z" })).toHaveClass(/is-active/);
});

test("script detail shows flow preview and version history", async ({ page }) => {
  await page.goto("/scripts/1");
  await expect(page.getByRole("heading", { name: "Flow preview" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "Version history" })).toBeVisible();
});

test("unverified users are gated from downloading", async ({ page }) => {
  await page.goto("/signup");
  await page.getByLabel("Email").fill(unique());
  await page.getByLabel("Password").fill("pwpass123");
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL("**/scripts");
  await page.goto("/scripts/1");
  await expect(page.getByText(/Only verified accounts can download/i)).toBeVisible();
  await expect(page.getByRole("link", { name: "Verify your email to download" })).toBeVisible();
});

test("register, account settings: display name + password change + login", async ({ page }) => {
  const email = unique();
  const oldPass = "pwpass123";
  const newPass = "pwnew456";

  await page.goto("/signup");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(oldPass);
  await page.getByRole("button", { name: "Sign up" }).click();
  await page.waitForURL("**/scripts");

  await page.goto("/account");
  await expect(page.getByText(/Email not verified/i)).toBeVisible();

  await page.getByLabel("Display name").fill("PW Tester");
  await page.getByRole("button", { name: "Save profile" }).click();
  await expect(page.getByText("Saved.")).toBeVisible();
  await expect(page.getByText("PW Tester")).toBeVisible();

  await page.getByLabel("Current password").fill(oldPass);
  await page.getByLabel("New password").fill(newPass);
  await page.getByRole("button", { name: "Update password" }).click();
  await expect(page.getByText("Password updated.")).toBeVisible();

  await page.getByRole("button", { name: "Log out" }).click();
  await page.goto("/login");

  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(newPass);
  await page.getByRole("button", { name: "Log in" }).click();
  await page.waitForURL("**/scripts");

  await page.goto("/account");
  await expect(page.getByRole("heading", { name: "PW Tester" })).toBeVisible();
});

test("device hub: presets persist and flow preview renders", async ({ page }) => {
  await page.goto("/device");
  await page.getByLabel("Baud rate").selectOption("57600");
  await page.getByPlaceholder("e.g. Cronus at home").fill("home-rig");
  await page.getByRole("button", { name: "Save", exact: true }).click();
  await page.reload();
  await expect(page.getByText("home-rig@57600")).toBeVisible();

  await page.getByLabel("Script to preview").selectOption("1");
  await expect(page.getByText(/step 1\/\d+/)).toBeVisible();
});