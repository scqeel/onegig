import { useEffect } from "react";
import { buildStoreFontUrl, resolveStoreFont, storeBrandVars } from "@/lib/storeBranding";

const FONT_LINK_ID = "og-store-font";

/**
 * Applies an agent's branding to <html> for as long as their store is open.
 * It has to be <html> rather than a wrapper div because dialogs render in a
 * portal under <body>, so a wrapper-level override would miss checkout.
 */
export function useStoreBranding({
  brandColor,
  font,
  forceDark,
}: {
  brandColor?: string | null;
  font?: string | null;
  forceDark?: boolean | null;
}) {
  useEffect(() => {
    const root = document.documentElement;
    const vars = Object.entries(storeBrandVars(brandColor));
    vars.forEach(([name, value]) => root.style.setProperty(name, value));
    return () => vars.forEach(([name]) => root.style.removeProperty(name));
  }, [brandColor]);

  useEffect(() => {
    if (!forceDark) return;
    const root = document.documentElement;
    const wasDark = root.classList.contains("dark");
    root.classList.add("dark");
    return () => {
      if (!wasDark) root.classList.remove("dark");
    };
  }, [forceDark]);

  useEffect(() => {
    const storeFont = resolveStoreFont(font);
    if (!storeFont) return;

    const root = document.documentElement;
    const link = document.createElement("link");
    link.id = FONT_LINK_ID;
    link.rel = "stylesheet";
    link.href = buildStoreFontUrl(storeFont);
    document.head.appendChild(link);

    const family = `"${storeFont}", sans-serif`;
    document.body.style.fontFamily = family;
    root.style.setProperty("--heading-font", family);

    return () => {
      link.remove();
      document.body.style.fontFamily = "";
      root.style.removeProperty("--heading-font");
    };
  }, [font]);
}
