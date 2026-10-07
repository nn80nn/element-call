/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { beforeEach, expect, test } from "vitest";

import {
  getSavedVolume,
  MAX_PLAYBACK_VOLUME,
  saveVolume,
} from "./savedVolumes";

beforeEach(() => localStorage.clear());

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
  expect(getSavedVolume("@a:example.org")).toBe(MAX_PLAYBACK_VOLUME);
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
