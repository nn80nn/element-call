/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { afterEach, beforeEach, expect, test, vi } from "vitest";
import { BehaviorSubject } from "rxjs";

import { isStaleMedia$, STALE_MEDIA_AFTER_MS } from "./staleMedia";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup(waiting: boolean, disconnected = false) {
  const waiting$ = new BehaviorSubject(waiting);
  const disconnected$ = new BehaviorSubject(disconnected);
  const values: boolean[] = [];
  const sub = isStaleMedia$(waiting$, disconnected$).subscribe((v) =>
    values.push(v),
  );
  return {
    waiting$,
    disconnected$,
    latest: (): boolean | undefined => values.at(-1),
    sub,
  };
}

test("a member with media is never stale", () => {
  const { latest } = setup(false);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS * 10);
  expect(latest()).toBe(false);
});

test("a member waiting for media is shown at first, then goes stale", () => {
  const { latest } = setup(true);
  expect(latest()).toBe(false);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS - 1);
  expect(latest()).toBe(false);
  vi.advanceTimersByTime(1);
  expect(latest()).toBe(true);
});

test("a stale member comes back as soon as their media arrives", () => {
  const { waiting$, latest } = setup(true);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS);
  expect(latest()).toBe(true);
  waiting$.next(false);
  expect(latest()).toBe(false);
});

test("the clock restarts if they stop waiting and start again", () => {
  const { waiting$, latest } = setup(true);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS - 1000);
  waiting$.next(false);
  waiting$.next(true);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS - 1);
  expect(latest()).toBe(false);
  vi.advanceTimersByTime(1);
  expect(latest()).toBe(true);
});

test("nobody goes stale while we are disconnected ourselves", () => {
  const { disconnected$, latest } = setup(true, true);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS * 10);
  expect(latest()).toBe(false);
  // Once we are back, they get a full grace period.
  disconnected$.next(false);
  vi.advanceTimersByTime(STALE_MEDIA_AFTER_MS - 1);
  expect(latest()).toBe(false);
  vi.advanceTimersByTime(1);
  expect(latest()).toBe(true);
});
