/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type ScreenShareCaptureOptions,
  type TrackPublishOptions,
} from "livekit-client";

import {
  type ScreenShareCodec,
  type ScreenShareFocus,
  type ScreenShareFps,
  type ScreenShareResolution,
} from "../settings/settings";
import { screenShareAudioPublishOptions } from "./options";

export interface ScreenShareQuality {
  focus: ScreenShareFocus;
  resolution: ScreenShareResolution;
  fps: ScreenShareFps;
  /** 0 = pick automatically. */
  bitrateMbps: number;
  codec: ScreenShareCodec;
  lowCpu: boolean;
}

const SIZES: Record<ScreenShareResolution, { width: number; height: number }> =
  {
    720: { width: 1280, height: 720 },
    1080: { width: 1920, height: 1080 },
    1440: { width: 2560, height: 1440 },
    // Capture constraints are "ideal" ones, so asking for more than the screen has just
    // gets the screen's own size.
    0: { width: 3840, height: 2160 },
  };

/** Bits per pixel per frame that screen content needs to look clean, give or take. */
const BITS_PER_PIXEL = 0.08;
const MIN_AUTO_BITRATE = 1_500_000;
const MAX_AUTO_BITRATE = 12_000_000;

/**
 * A bitrate to match the picture: 1080p30 comes out at 5 Mbit/s, which is what the stock
 * preset uses, and it scales with pixels and frame rate from there.
 */
export function autoBitrate(
  width: number,
  height: number,
  fps: number,
): number {
  const raw = width * height * fps * BITS_PER_PIXEL;
  return Math.round(
    Math.min(MAX_AUTO_BITRATE, Math.max(MIN_AUTO_BITRATE, raw)),
  );
}

/**
 * Turns the user's screen share choices into LiveKit capture and publish options.
 *
 * The important one is the degradation preference. LiveKit defaults screen shares to
 * "maintain-resolution", which under CPU or bandwidth pressure sacrifices frame rate
 * without limit: a game that is already hammering the machine ends up streamed at a few
 * frames per second. "maintain-framerate" does the reverse, shrinking the picture instead.
 */
export function screenShareOptions(q: ScreenShareQuality): {
  capture: Pick<ScreenShareCaptureOptions, "resolution" | "contentHint">;
  publish: TrackPublishOptions;
} {
  const { width, height } = SIZES[q.resolution];
  const maxBitrate =
    q.bitrateMbps > 0
      ? Math.round(q.bitrateMbps * 1_000_000)
      : autoBitrate(width, height, q.fps);

  return {
    capture: {
      resolution: { width, height, frameRate: q.fps },
      contentHint: q.focus === "motion" ? "motion" : "detail",
    },
    publish: {
      ...screenShareAudioPublishOptions,
      screenShareEncoding: { maxBitrate, maxFramerate: q.fps },
      degradationPreference:
        q.focus === "motion" ? "maintain-framerate" : "maintain-resolution",
      // Hardware-accelerated where the machine offers it, which is what takes the load off
      // the processor while a game is also running.
      ...(q.codec === "h264" ? { videoCodec: "h264" as const } : {}),
      ...(q.lowCpu ? { simulcast: false } : {}),
    },
  };
}
