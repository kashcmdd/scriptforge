const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function isValidEmail(email: unknown): email is string {
  return typeof email === "string" && email.length <= 254 && EMAIL_RE.test(email);
}

export function titleIssue(title: unknown): string | null {
  if (typeof title !== "string") return "Title is required.";
  const t = title.trim();
  if (!t) return "Title is required.";
  if (t.length > 120) return "Title is too long (max 120 characters).";
  return null;
}

export function gameIssue(game: unknown): string | null {
  if (typeof game !== "string") return "Game is required.";
  const g = game.trim();
  if (!g) return "Game is required.";
  if (g.length > 60) return "Game is too long (max 60 characters).";
  return null;
}

export function descriptionIssue(description: unknown): string | null {
  if (description === undefined || description === null) return null;
  if (typeof description !== "string") return "Description must be text.";
  if (description.length > 400) return "Description is too long (max 400 characters).";
  return null;
}

/**
 * Requires 8+ chars, at least one letter and one number.
 * Intentionally not requiring symbols — that tends to push people
 * toward weaker, more predictable passwords ("Password1!").
 */
export function passwordIssue(password: unknown): string | null {
  if (typeof password !== "string") return "Password is required.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (password.length > 200) return "Password is too long.";
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    return "Password must include at least one letter and one number.";
  }
  return null;
}
