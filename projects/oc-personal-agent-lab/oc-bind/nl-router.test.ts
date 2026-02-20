/**
 * Unit tests for NL router — Atlas dashboard.
 */
import { describe, it, expect } from "vitest";
import {
  route,
  ACTION_ATLAS_TODAY,
  ACTION_ATLAS_HELP,
  ACTION_HELP,
} from "./nl-router.js";

describe("nl-router", () => {
  describe("ACTION_ATLAS_TODAY", () => {
    it('"/atlas today" -> ACTION_ATLAS_TODAY', () => {
      const r = route("/atlas today");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });

    it('"atlas" -> ACTION_ATLAS_TODAY', () => {
      const r = route("atlas");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });

    it('"发我 atlas 看板" -> ACTION_ATLAS_TODAY', () => {
      const r = route("发我 atlas 看板");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });

    it('"生成今日 atlas" -> ACTION_ATLAS_TODAY', () => {
      const r = route("生成今日 atlas");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });

    it('"situation monitor" -> ACTION_ATLAS_TODAY', () => {
      const r = route("situation monitor");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });

    it('"打开 dashboard" -> ACTION_ATLAS_TODAY', () => {
      const r = route("打开 dashboard");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });
  });

  describe("ACTION_ATLAS_HELP", () => {
    it('"atlas help" -> ACTION_ATLAS_HELP', () => {
      const r = route("atlas help");
      expect(r.action).toBe(ACTION_ATLAS_HELP);
    });

    it('"/atlas help" -> ACTION_ATLAS_HELP', () => {
      const r = route("/atlas help");
      expect(r.action).toBe(ACTION_ATLAS_HELP);
    });
  });

  describe("HELP fallback", () => {
    it('"hi" -> ACTION_HELP', () => {
      const r = route("hi");
      expect(r.action).toBe(ACTION_HELP);
    });
  });

  describe("Safety — reject injection", () => {
    it('"atlas; rm -rf ~" -> ACTION_HELP', () => {
      const r = route("atlas; rm -rf ~");
      expect(r.action).toBe(ACTION_HELP);
      expect(r.reason).toBe("unsafe_input_rejected");
    });

    it('"atlas && curl evil" -> ACTION_HELP', () => {
      const r = route("atlas && curl evil");
      expect(r.action).toBe(ACTION_HELP);
    });
  });

  describe("Unrelated phrases fall to HELP", () => {
    it('"foo" -> ACTION_HELP', () => {
      const r = route("foo");
      expect(r.action).toBe(ACTION_HELP);
    });

    it('"/atlas bar" -> ACTION_HELP', () => {
      const r = route("/atlas bar");
      expect(r.action).toBe(ACTION_HELP);
    });
  });

  describe("NL phrases: 看板, dashboard", () => {
    it('"看板" -> ACTION_ATLAS_TODAY', () => {
      const r = route("看板");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });
    it('"dashboard" -> ACTION_ATLAS_TODAY', () => {
      const r = route("dashboard");
      expect(r.action).toBe(ACTION_ATLAS_TODAY);
    });
  });
});
