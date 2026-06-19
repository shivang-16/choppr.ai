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

/**
 * Per-glyph fallback stack covering every supported language. The canvas walks
 * this list for each glyph until it finds a font that has it.
 */
export const CAPTION_FONT_STACK =
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
