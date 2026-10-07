/*
Copyright 2026 Element Software Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { combineLatest, map, merge, of, Subject, switchMap } from "rxjs";

import { type Behavior } from "./Behavior";
import { type ObservableScope } from "./ObservableScope";
import { accumulate } from "../utils/observable";
import { getSavedVolume, saveVolume } from "./savedVolumes";

/**
 * Controls for audio playback volume.
 */
export interface VolumeControls {
  /**
   * The volume to which the audio is set, as a scalar multiplier.
   */
  playbackVolume$: Behavior<number>;
  /**
   * Whether playback of this audio is disabled.
   */
  playbackMuted$: Behavior<boolean>;
  togglePlaybackMuted: () => void;
  adjustPlaybackVolume: (value: number) => void;
  commitPlaybackVolume: () => void;
}

interface VolumeControlsInputs {
  pretendToBeDisconnected$: Behavior<boolean>;
  /**
   * The callback to run to notify the module performing audio playback of the
   * requested volume.
   */
  sink$: Behavior<(volume: number) => void>;
  /**
   * If given, the volume is remembered under this key across calls: it is restored when the
   * controls are created and saved whenever the user finishes adjusting it.
   */
  persistKey?: string;
}

/**
 * Creates a set of controls for audio playback volume and syncs this with the
 * audio playback module for the duration of the scope.
 */
export function createVolumeControls(
  scope: ObservableScope,
  { pretendToBeDisconnected$, sink$, persistKey }: VolumeControlsInputs,
): VolumeControls {
  const initialVolume =
    persistKey === undefined ? 1 : getSavedVolume(persistKey);
  const toggleMuted$ = new Subject<"toggle mute">();
  const adjustVolume$ = new Subject<number>();
  const commitVolume$ = new Subject<"commit">();

  const playbackVolume$ = scope.behavior<number>(
    merge(toggleMuted$, adjustVolume$, commitVolume$).pipe(
      accumulate(
        { volume: initialVolume, committedVolume: initialVolume },
        (state, event) => {
          switch (event) {
            case "toggle mute":
              return {
                ...state,
                volume: state.volume === 0 ? state.committedVolume : 0,
              };
            case "commit": {
              // Dragging the slider to zero should have the same effect as
              // muting: keep the original committed volume, as if it were never
              // dragged
              const committedVolume =
                state.volume === 0 ? state.committedVolume : state.volume;
              if (persistKey !== undefined)
                saveVolume(persistKey, committedVolume);
              return { ...state, committedVolume };
            }
            default:
              // Volume adjustment
              return { ...state, volume: event };
          }
        },
      ),
      map(({ volume }) => volume),
    ),
  );

  // Sync the requested volume with the audio playback module
  combineLatest([
    sink$,
    // The playback volume, taking into account whether we're supposed to
    // pretend that the audio stream is disconnected (since we don't necessarily
    // want that to modify the UI state).
    pretendToBeDisconnected$.pipe(
      switchMap((disconnected) => (disconnected ? of(0) : playbackVolume$)),
    ),
  ])
    .pipe(scope.bind())
    .subscribe(([sink, volume]) => sink(volume));

  return {
    playbackVolume$,
    playbackMuted$: scope.behavior<boolean>(
      playbackVolume$.pipe(map((volume) => volume === 0)),
    ),
    togglePlaybackMuted: () => toggleMuted$.next("toggle mute"),
    adjustPlaybackVolume: (value: number) => adjustVolume$.next(value),
    commitPlaybackVolume: () => commitVolume$.next("commit"),
  };
}
