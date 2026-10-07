/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/lib/logger";

import { getUrlParams } from "../UrlParams";

/**
 * Switches the browser's own noise suppression and automatic gain control on a live
 * microphone track.
 *
 * Our noise suppressors do the same job, and stacking the two smears speech and makes
 * the gain control pump. The call used to decide this once, when the room was created, so
 * turning a suppressor on or off mid-call left the browser's processing in the wrong state.
 * Tying it to the processor's lifetime means it follows the setting wherever it changes.
 *
 * @param track - the raw microphone track, as handed to a track processor
 * @param ours - true while one of our own suppressors is running on it
 */
export async function setBrowserAudioProcessing(
  track: MediaStreamTrack,
  ours: boolean,
): Promise<void> {
  if (track.readyState !== "live") return;
  try {
    await track.applyConstraints({
      noiseSuppression: ours ? false : getUrlParams().noiseSuppression,
      autoGainControl: !ours,
    });
  } catch (e) {
    // Not every platform lets these be changed on a running track. Carrying on with what the
    // track already had is the pre-existing behaviour, so this is not worth failing a call over.
    logger.warn("Could not change browser audio processing", e);
  }
}
