import { describe, it, expect } from "vitest";
import { isValidEmail, passwordIssue } from "../validate";

describe("isValidEmail", () => {
  it("accepts a normal email", () => {
    expect(isValidEmail("test@example.com")).toBe(true);
  });
  it("rejects missing @", () => {
    expect(isValidEmail("test.example.com")).toBe(false);
  });
  it("rejects non-string input", () => {
    expect(isValidEmail(123)).toBe(false);
    expect(isValidEmail(undefined)).toBe(false);
  });
});

describe("passwordIssue", () => {
  it("rejects short passwords", () => {
    expect(passwordIssue("abc123")).toMatch(/at least 8/);
  });
  it("rejects letter-only passwords", () => {
    expect(passwordIssue("abcdefgh")).toMatch(/letter and one number/);
  });
  it("rejects number-only passwords", () => {
    expect(passwordIssue("12345678")).toMatch(/letter and one number/);
  });
  it("accepts a valid password", () => {
    expect(passwordIssue("abcd1234")).toBeNull();
  });
});
