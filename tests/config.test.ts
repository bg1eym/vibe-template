import { describe, it, expect } from "vitest";
import { getConfig } from "../src/lib/config.js";

describe("config", () => {
  it("uses defaults", () => {
    const c = getConfig({});
    expect(c.host).toBe("127.0.0.1");
    expect(c.port).toBe(3000);
    expect(c.dbFile).toBe("app.sqlite");
  });

  it("rejects invalid PORT", () => {
    expect(() => getConfig({ PORT: "nope" } as any)).toThrow();
    expect(() => getConfig({ PORT: "70000" } as any)).toThrow();
    expect(() => getConfig({ PORT: "0" } as any)).toThrow();
  });

  it("accepts valid PORT", () => {
    const c = getConfig({ PORT: "3001" } as any);
    expect(c.port).toBe(3001);
  });
});
