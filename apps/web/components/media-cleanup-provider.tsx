"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import {
  startMediaCleanup,
  stopMediaCleanup,
  flushMediaElements,
  installVideoTracking,
} from "@/lib/media-cleanup";

/**
 * Global component that manages video element lifecycle.
 * Starts periodic cleanup and flushes detached leaks on route transitions.
 * Mount once near the root of the app.
 */
export function MediaCleanupProvider() {
  useEffect(() => {
    installVideoTracking();
    startMediaCleanup();
    return () => stopMediaCleanup();
  }, []);

  const pathname = usePathname();
  useEffect(() => {
    // Only prune detached leaks — never wipe live filmstrip extractors mid-page.
    flushMediaElements();
  }, [pathname]);

  return null;
}
