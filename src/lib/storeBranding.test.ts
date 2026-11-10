import { describe, it, expect } from "vitest";
import {
  buildStoreFontUrl,
  hexToHslValues,
  readableForeground,
  resolveStoreFont,
  storeBrandVars,
} from "./storeBranding";

const DARK_TEXT = "220 20% 7%";
const WHITE_TEXT = "0 0% 100%";

describe("hexToHslValues", () => {
  it("converts a 6-digit hex colour", () => {
    expect(hexToHslValues("#ff0000")).toBe("0 100% 50%");
  });

  it("expands a 3-digit hex colour", () => {
    expect(hexToHslValues("#0f0")).toBe("120 100% 50%");
  });

  it("accepts a hex colour without the leading hash", () => {
    expect(hexToHslValues("0000ff")).toBe("240 100% 50%");
  });

  it.each(["", "#12", "#gggggg", "red", "#12345"])("rejects invalid colour %j", (value) => {
    expect(hexToHslValues(value)).toBeNull();
  });
});

describe("readableForeground", () => {
  it("uses dark text on a pale brand colour", () => {
    expect(readableForeground("#ffcc00")).toBe(DARK_TEXT);
  });

  it("uses white text on a deep brand colour", () => {
    expect(readableForeground("#1e3a8a")).toBe(WHITE_TEXT);
  });

  it("returns null for an invalid colour", () => {
    expect(readableForeground("nope")).toBeNull();
  });
});

describe("storeBrandVars", () => {
  it("sets primary, its foreground and the focus ring from the brand colour", () => {
    expect(storeBrandVars("#1e3a8a")).toEqual({
      "--primary": "224 64% 33%",
      "--primary-foreground": WHITE_TEXT,
      "--ring": "224 64% 33%",
    });
  });

  it("leaves the platform colours alone when the agent has no brand colour", () => {
    expect(storeBrandVars(null)).toEqual({});
  });

  it("leaves the platform colours alone when the brand colour is invalid", () => {
    expect(storeBrandVars("not-a-colour")).toEqual({});
  });
});

describe("resolveStoreFont", () => {
  it("accepts a font offered in agent settings", () => {
    expect(resolveStoreFont("Space Grotesk")).toBe("Space Grotesk");
  });

  it("rejects a font that is not offered", () => {
    expect(resolveStoreFont("Comic Sans'; color: red")).toBeNull();
  });

  it("returns null when no font is set", () => {
    expect(resolveStoreFont(null)).toBeNull();
  });
});

describe("buildStoreFontUrl", () => {
  it("encodes the font name and only requests weights every offered font has", () => {
    expect(buildStoreFontUrl("Space Grotesk")).toBe(
      "https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700&display=swap",
    );
  });
});
