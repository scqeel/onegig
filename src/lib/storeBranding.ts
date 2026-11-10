/** Fonts offered to agents in store settings. Anything else is ignored. */
export const STORE_FONTS = ["Inter", "Outfit", "Space Grotesk", "Playfair Display", "Roboto"] as const;
export type StoreFont = (typeof STORE_FONTS)[number];

const DARK_FOREGROUND = "220 20% 7%";
const WHITE_FOREGROUND = "0 0% 100%";

function parseHex(hex: string): [number, number, number] | null {
  let value = hex.trim().replace(/^#/, "");
  if (/^[0-9a-fA-F]{3}$/.test(value)) {
    value = value.split("").map((c) => c + c).join("");
  }
  if (!/^[0-9a-fA-F]{6}$/.test(value)) return null;
  return [
    parseInt(value.substring(0, 2), 16) / 255,
    parseInt(value.substring(2, 4), 16) / 255,
    parseInt(value.substring(4, 6), 16) / 255,
  ];
}

/** "#ff0000" -> "0 100% 50%", the format the theme's CSS variables use. */
export function hexToHslValues(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0;
  let s = 0;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h /= 6;
  }

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Picks whichever of dark or white text has the higher WCAG contrast on the colour. */
export function readableForeground(hex: string): string | null {
  const rgb = parseHex(hex);
  if (!rgb) return null;
  const luminance = relativeLuminance(rgb);
  const onWhite = 1.05 / (luminance + 0.05);
  const onDark = (luminance + 0.05) / 0.055;
  return onDark >= onWhite ? DARK_FOREGROUND : WHITE_FOREGROUND;
}

/** CSS variables that re-tint the theme to an agent's brand. Empty keeps the platform colours. */
export function storeBrandVars(brandColor: string | null | undefined): Record<string, string> {
  if (!brandColor) return {};
  const primary = hexToHslValues(brandColor);
  const foreground = readableForeground(brandColor);
  if (!primary || !foreground) return {};
  return {
    "--primary": primary,
    "--primary-foreground": foreground,
    "--ring": primary,
  };
}

export function resolveStoreFont(font: string | null | undefined): StoreFont | null {
  return STORE_FONTS.find((f) => f === font) ?? null;
}

/** Only requests weights that every font in STORE_FONTS provides. */
export function buildStoreFontUrl(font: StoreFont): string {
  return `https://fonts.googleapis.com/css2?family=${font.replace(/\s+/g, "+")}:wght@400;600;700&display=swap`;
}
