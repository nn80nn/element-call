/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { beforeEach, expect, test } from "vitest";

import {
  BOOSTED_MAX_PLAYBACK_VOLUME,
  getSavedVolume,
  maxPlaybackVolume,
  saveVolume,
  setVolumeBoostActive,
} from "./savedVolumes";

beforeEach(() => {
  localStorage.clear();
  setVolumeBoostActive(true);
});

test("defaults to 100% for someone never adjusted", () => {
  expect(getSavedVolume("@a:example.org")).toBe(1);
});

test("remembers a volume per user, including amplification", () => {
  saveVolume("@a:example.org", 1.5);
  saveVolume("@b:example.org", 0.3);
  expect(getSavedVolume("@a:example.org")).toBe(1.5);
  expect(getSavedVolume("@b:example.org")).toBe(0.3);
});

test("clamps stored values to the allowed range", () => {
  localStorage.setItem(
    "remess-playback-volumes",
    JSON.stringify({ "@a:example.org": 9, "@b:example.org": -1 }),
  );
  expect(getSavedVolume("@a:example.org")).toBe(BOOSTED_MAX_PLAYBACK_VOLUME);
  expect(getSavedVolume("@b:example.org")).toBe(0);
});

test("returning to 100% clears the entry", () => {
  saveVolume("@a:example.org", 1.5);
  saveVolume("@a:example.org", 1);
  expect(localStorage.getItem("remess-playback-volumes")).toBe("{}");
});

test("survives corrupt storage", () => {
  localStorage.setItem("remess-playback-volumes", "not json");
  expect(getSavedVolume("@a:example.org")).toBe(1);
});

test("without amplification nothing above 100% is ever offered or restored", () => {
  setVolumeBoostActive(false);
  expect(maxPlaybackVolume()).toBe(1);
  // A value saved while amplification was on must not reach a plain media element, which
  // throws for anything above 1.
  saveVolume("@a:example.org", 1.8);
  expect(getSavedVolume("@a:example.org")).toBe(1);
});
