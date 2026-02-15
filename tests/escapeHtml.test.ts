import { describe, it, expect } from "vitest";
import { escapeHtml } from "../src/lib/escapeHtml.js";

describe("escapeHtml", () => {
  it("escapes <script> tags", () => {
    const input = '<script>alert("xss")</script>';
    expect(escapeHtml(input)).not.toContain("<script>");
    expect(escapeHtml(input)).toContain("&lt;");
    expect(escapeHtml(input)).toContain("&gt;");
  });

  it("escapes img onerror so tag does not execute", () => {
    const input = "<img src=x onerror=alert(1)>";
    const out = escapeHtml(input);
    expect(out).toContain("&lt;");
    expect(out).toContain("&gt;");
    expect(out).not.toMatch(/<[a-z]/i);
  });

  it("escapes ampersand and quotes", () => {
    expect(escapeHtml("a & b")).toBe("a &amp; b");
    expect(escapeHtml('"foo"')).toBe("&quot;foo&quot;");
  });

  it("returns empty string for null/undefined", () => {
    expect(escapeHtml(null)).toBe("");
    expect(escapeHtml(undefined)).toBe("");
  });
});
