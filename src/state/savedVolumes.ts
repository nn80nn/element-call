/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/lib/logger";

/**
 * The loudest a participant can be set to, as a multiplier of their original level.
 * Anything above 1 is amplification, which needs the Web Audio pipeline.
 */
export const MAX_PLAYBACK_VOLUME = 2;

const STORAGE_KEY = "remess-playback-volumes";

function readAll(): Record<string, number> {
  try {
    const parsed: unknown = JSON.parse(
      localStorage.getItem(STORAGE_KEY) ?? "{}",
    );
    return parsed !== null && typeof parsed === "object"
      ? (parsed as Record<string, number>)
      : {};
  } catch {
    // Storage can be blocked or hold garbage; either way we just start from defaults.
    return {};
  }
}

/**
 * The volume this user last chose for the given participant, or 1 (100%) if they never
 * adjusted it. Keyed by Matrix user ID, so it carries across calls and rooms.
 */
export function getSavedVolume(key: string): number {
  const volume = readAll()[key];
  return typeof volume === "number" && Number.isFinite(volume)
    ? Math.min(Math.max(volume, 0), MAX_PLAYBACK_VOLUME)
    : 1;
}

/**
 * Remembers a volume for the given participant. Returning to the default clears the entry
 * instead of storing it, so the table doesn't fill up with people left at 100%.
 */
export function saveVolume(key: string, volume: number): void {
  try {
    const all = readAll();
    if (volume === 1) delete all[key];
    else all[key] = volume;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch (e) {
    logger.warn("Could not save playback volume", e);
  }
}
