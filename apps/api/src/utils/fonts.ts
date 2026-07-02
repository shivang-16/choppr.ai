/**
 * Caption font registration.
 *
 * The server-side caption renderer (@napi-rs/canvas) needs fonts that cover
 * every language we translate to. On macOS the OS provides these system fonts,
 * but on Linux (EC2) they're absent — so non-Latin scripts (Hindi, Kannada,
 * Tamil, Arabic, CJK …) render as "tofu" (▯) boxes.
 *
 * We bundle Noto Sans fonts for all supported scripts under assets/fonts and
 * register them explicitly so rendering is identical on every platform.
 */
import { GlobalFonts } from "@napi-rs/canvas";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { existsSync } from "fs";
import { logger } from "./logger.js";

const __dirname  = dirname(fileURLToPath(import.meta.url));
// src/utils → ../../assets/fonts (works in both tsx-dev and built dist layout)
const FONTS_DIR  = join(__dirname, "../../assets/fonts");

// Multilingual fallback tail — appended after every display font so non-Latin
// scripts always render correctly.
const MULTILINGUAL_FALLBACK =
  '"Noto Sans",' +
  '"Noto Sans Devanagari",' +   // Hindi
  '"Noto Sans Tamil",' +        // Tamil
  '"Noto Sans Telugu",' +       // Telugu
  '"Noto Sans Kannada",' +      // Kannada
  '"Noto Sans Malayalam",' +    // Malayalam
  '"Noto Sans Arabic",' +       // Arabic
  '"Noto Sans SC",' +           // Chinese (Simplified)
  '"Noto Sans JP",' +           // Japanese
  '"Noto Sans KR",' +           // Korean
  "sans-serif";

/**
 * Default per-glyph fallback stack (Noto Sans + multilingual).
 * Used by styles that don't declare their own display font.
 */
export const CAPTION_FONT_STACK = MULTILINGUAL_FALLBACK;

/** Condensed display fonts — bold/impactful word-by-word styles */
export const FONT_ANTON    = `"Anton",${MULTILINGUAL_FALLBACK}`;
/** Wide comic-book display font */
export const FONT_BANGERS  = `"Bangers",${MULTILINGUAL_FALLBACK}`;
/** Condensed grotesque — clean titles, mr-beast style */
export const FONT_OSWALD   = `"Oswald",${MULTILINGUAL_FALLBACK}`;
/** Tall condensed sans — bold headlines */
export const FONT_BEBAS    = `"Bebas Neue",${MULTILINGUAL_FALLBACK}`;
/** Hand-written marker feel */
export const FONT_MARKER   = `"Permanent Marker",${MULTILINGUAL_FALLBACK}`;
/** Retro pixel / arcade */
export const FONT_PIXEL    = `"Press Start 2P",${MULTILINGUAL_FALLBACK}`;
/** Geometric modern sans */
export const FONT_SPACE    = `"Space Grotesk",${MULTILINGUAL_FALLBACK}`;
/** Gothic/blackletter display */
export const FONT_GOTHIC   = `"UnifrakturCook",${MULTILINGUAL_FALLBACK}`;
/** Rounded humanist sans */
export const FONT_NUNITO   = `"Nunito",${MULTILINGUAL_FALLBACK}`;

let registered = false;

/** Register all bundled caption fonts once (idempotent). */
export function ensureFontsRegistered(): void {
  if (registered) return;
  registered = true;
  try {
    if (!existsSync(FONTS_DIR)) {
      logger.warn(`Caption fonts directory not found: ${FONTS_DIR}`);
      return;
    }
    const count = GlobalFonts.loadFontsFromDir(FONTS_DIR);
    logger.info(`Registered ${count} caption font(s) from ${FONTS_DIR}`);
  } catch (err: any) {
    logger.error("Caption font registration failed", { error: err?.message ?? String(err) });
  }
}
