/**
 * JSON extractor tests: code fence, explanatory text, bracket matching,
 * strings with braces, multiple fences, multiple JSON objects.
 */
import { describe, it, expect } from "vitest";
import { extractJsonObject } from "../src/lib/jsonExtract.js";

describe("extractJsonObject", () => {
  it("pure JSON returns ok", () => {
    const r = extractJsonObject('{"a":1}');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ a: 1 });
  });

  it("code fence json returns ok", () => {
    const r = extractJsonObject('```json\n{"a":123}\n```');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ a: 123 });
  });

  it("explanatory text + JSON returns ok", () => {
    const r = extractJsonObject('Here is the result:\n{"x":"y"}\nThanks!');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ x: "y" });
  });

  it("invalid JSON returns ok:false", () => {
    const r = extractJsonObject("{invalid}");
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("parse");
  });

  it("empty returns ok:false", () => {
    const r = extractJsonObject("");
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("empty");
  });

  it("no object returns ok:false", () => {
    const r = extractJsonObject("just text");
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("no JSON");
  });

  it("JSON string containing { } parses correctly", () => {
    const r = extractJsonObject('{"a":"x{y}z","b":1}');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ a: "x{y}z", b: 1 });
  });

  it("JSON string with escaped quote and braces parses correctly", () => {
    const r = extractJsonObject('{"a":"\\"} { not brace \\"","b":2}');
    expect(r.ok).toBe(true);
    const v = (r as { value: unknown }).value as { a?: string; b?: number };
    expect(v.b).toBe(2);
    expect(v.a).toContain("}");
    expect(v.a).toContain("{");
  });

  it("multiple fences: first invalid, second valid → selects second", () => {
    const r = extractJsonObject('```\n{invalid json}\n```\n```json\n{"valid":true}\n```');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ valid: true });
  });

  it("explanatory text + JSON + explanatory text extracts correctly", () => {
    const r = extractJsonObject('Intro here.\n{"key":"value"}\nOutro here.');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ key: "value" });
  });

  it("two JSON objects in text → extracts first only", () => {
    const r = extractJsonObject('{"first":1} {"second":2}');
    expect(r.ok).toBe(true);
    expect((r as { value: unknown }).value).toEqual({ first: 1 });
  });

  it("no JSON at all → ok:false with clear reason", () => {
    const r = extractJsonObject("no braces or json here");
    expect(r.ok).toBe(false);
    expect((r as { reason: string }).reason).toContain("no JSON");
  });
});
