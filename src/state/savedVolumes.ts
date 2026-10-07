/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/lib/logger";

/** The loudest a participant can be set to when amplification is available. */
export const BOOSTED_MAX_PLAYBACK_VOLUME = 2;

let boostActive = false;

/**
 * Records whether the call being joined plays audio through Web Audio, and so can amplify.
 * Decided once, when the call's rooms are created: asking a plain media element for a
 * volume above 1 throws, so what the controls offer must not change mid-call.
 */
export function setVolumeBoostActive(active: boolean): void {
  boostActive = active;
}

/** The loudest a participant can be set to in the current call, as a multiplier. */
export function maxPlaybackVolume(): number {
  return boostActive ? BOOSTED_MAX_PLAYBACK_VOLUME : 1;
}

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
    ? Math.min(Math.max(volume, 0), maxPlaybackVolume())
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
