/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { expect, test } from "vitest";

import {
  autoBitrate,
  type ScreenShareQuality,
  screenShareOptions,
} from "./screenShareQuality";

const base: ScreenShareQuality = {
  focus: "motion",
  resolution: 1080,
  fps: 30,
  bitrateMbps: 0,
  codec: "vp8",
  lowCpu: false,
};

test("automatic bitrate matches the stock 1080p30 preset and scales from it", () => {
  expect(autoBitrate(1920, 1080, 30)).toBeGreaterThan(4_900_000);
  expect(autoBitrate(1920, 1080, 30)).toBeLessThan(5_100_000);
  expect(autoBitrate(1920, 1080, 60)).toBeGreaterThan(
    autoBitrate(1920, 1080, 30),
  );
  expect(autoBitrate(1280, 720, 15)).toBe(1_500_000);
  expect(autoBitrate(3840, 2160, 60)).toBe(12_000_000);
});

test("asks the capture for the chosen size and frame rate", () => {
  const { capture } = screenShareOptions({
    ...base,
    resolution: 1440,
    fps: 60,
  });
  expect(capture.resolution).toEqual({
    width: 2560,
    height: 1440,
    frameRate: 60,
  });
});

test("favouring motion keeps the frame rate and tells the encoder so", () => {
  const { capture, publish } = screenShareOptions(base);
  expect(capture.contentHint).toBe("motion");
  expect(publish.degradationPreference).toBe("maintain-framerate");
  expect(publish.screenShareEncoding?.maxFramerate).toBe(30);
});

test("favouring detail keeps the picture sharp", () => {
  const { capture, publish } = screenShareOptions({ ...base, focus: "detail" });
  expect(capture.contentHint).toBe("detail");
  expect(publish.degradationPreference).toBe("maintain-resolution");
});

test("a manual bitrate wins over the automatic one", () => {
  const { publish } = screenShareOptions({ ...base, bitrateMbps: 8 });
  expect(publish.screenShareEncoding?.maxBitrate).toBe(8_000_000);
});

test("only sets a codec or turns simulcast off when asked to", () => {
  const plain = screenShareOptions(base).publish;
  expect(plain).not.toHaveProperty("videoCodec");
  expect(plain).not.toHaveProperty("simulcast");

  const tuned = screenShareOptions({
    ...base,
    codec: "h264",
    lowCpu: true,
  }).publish;
  expect(tuned.videoCodec).toBe("h264");
  expect(tuned.simulcast).toBe(false);
});

test("the screen share audio keeps its better encoding", () => {
  expect(screenShareOptions(base).publish.audioPreset).toBeDefined();
});
