/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  combineLatest,
  distinctUntilChanged,
  map,
  type Observable,
  of,
  startWith,
  switchMap,
  timer,
} from "rxjs";

/**
 * How long a call member may have a MatrixRTC membership but no media in LiveKit before we
 * stop showing them. Joining normally takes a few seconds; anything past this is far more
 * likely a membership that was never cleaned up than someone still on their way in.
 */
export const STALE_MEDIA_AFTER_MS = 30_000;

/**
 * Whether a remote member's tile should be treated as stale.
 *
 * A client that dies without leaving properly -- a phone app swiped away, say -- can leave its
 * membership event behind for hours, since a client that doesn't use delayed leave events
 * never gets it cleaned up. Everyone else then sees a permanent "waiting for media" tile.
 *
 * The clock only runs while *we* are connected. When our own connection is down every remote
 * member looks media-less, and that says nothing about them.
 */
export function isStaleMedia$(
  waitingForMedia$: Observable<boolean>,
  weAreDisconnected$: Observable<boolean>,
  afterMs = STALE_MEDIA_AFTER_MS,
): Observable<boolean> {
  return combineLatest([waitingForMedia$, weAreDisconnected$]).pipe(
    map(([waiting, disconnected]) => waiting && !disconnected),
    distinctUntilChanged(),
    // Each time the member starts waiting, or we come back online, the clock starts over.
    switchMap((counting) =>
      counting
        ? timer(afterMs).pipe(
            map(() => true),
            startWith(false),
          )
        : of(false),
    ),
    distinctUntilChanged(),
  );
}
