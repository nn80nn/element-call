/*
Copyright 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { logger } from "matrix-js-sdk/lib/logger";
import { BehaviorSubject } from "rxjs";

import { PosthogAnalytics } from "../analytics/PosthogAnalytics";
import { type Behavior } from "../state/Behavior";
import { useBehavior } from "../useBehavior";
import { MatrixRTCMode } from "../config/ConfigOptions";

export class Setting<T> {
  public constructor(
    key: string,
    public readonly defaultValue: T,
  ) {
    this.key = `matrix-setting-${key}`;

    const storedValue = localStorage.getItem(this.key);
    let initialValue = defaultValue;
    if (storedValue !== null) {
      try {
        initialValue = JSON.parse(storedValue);
      } catch (e) {
        logger.warn(
          `Invalid value stored for setting ${key}: ${storedValue}.`,
          e,
        );
      }
    }

    this._value$ = new BehaviorSubject(initialValue);
    this.value$ = this._value$;
    this._lastUpdateReason$ = new BehaviorSubject<string | null>(null);
    this.lastUpdateReason$ = this._lastUpdateReason$;
  }

  private readonly key: string;

  private readonly _value$: BehaviorSubject<T>;
  private readonly _lastUpdateReason$: BehaviorSubject<string | null>;
  public readonly value$: Behavior<T>;
  public readonly lastUpdateReason$: Behavior<string | null>;

  public readonly setValue = (value: T, reason?: string): void => {
    this._value$.next(value);
    this._lastUpdateReason$.next(reason ?? null);
    localStorage.setItem(this.key, JSON.stringify(value));
  };
  public readonly getValue = (): T => {
    return this._value$.getValue();
  };
}

/**
 * React hook that returns a settings's current value and a setter.
 */
export function useSetting<T>(setting: Setting<T>): [T, (value: T) => void] {
  return [useBehavior(setting.value$), setting.setValue];
}

// null = undecided
export const optInAnalytics = new Setting<boolean | null>(
  "opt-in-analytics",
  null,
);
// TODO: This setting can be disabled. Work out an approach to disableable
// settings thats works for Observables in addition to React.
export const useOptInAnalytics = (): [
  boolean | null,
  ((value: boolean | null) => void) | null,
] => {
  const setting = useSetting(optInAnalytics);
  return PosthogAnalytics.instance.isEnabled() ? setting : [false, null];
};

export const developerMode = new Setting("developer-settings-tab", false);

export const duplicateTiles = new Setting("duplicate-tiles", 0);

export const debugTileLayout = new Setting("debug-tile-layout", false);

export const showConnectionStats = new Setting<boolean>(
  "show-connection-stats",
  false,
);

export const audioInput = new Setting<string | undefined>(
  "audio-input",
  undefined,
);
export const audioOutput = new Setting<string | undefined>(
  "audio-output",
  undefined,
);
export const videoInput = new Setting<string | undefined>(
  "video-input",
  undefined,
);

export const backgroundBlur = new Setting<boolean>("background-blur", false);

export const noiseSuppression = new Setting<boolean>("noise-suppression", true);

// Experimental alternative to RNNoise (see RnnoiseTrackProcessor): DTLN, which unlike
// RNNoise was trained on a noise set that includes short transient noises (keyboard
// clicks, taps), not just steady background noise. Off by default and independent from
// the RNNoise setting above while it's being evaluated; takes priority over RNNoise when
// both happen to be on. See DtlnTrackProcessor.
export const noiseSuppressionDtln = new Setting<boolean>(
  "noise-suppression-dtln",
  false,
);

/**
 * How the microphone decides when you are talking:
 *  - "open": always transmitting while unmuted (the default);
 *  - "voice": only while the level is above the sensitivity threshold;
 *  - "ptt": only while the push-to-talk key is held, starting muted.
 */
export type InputMode = "open" | "voice" | "ptt";
export const inputMode = new Setting<InputMode>("input-mode", "open");

/** Level in dBFS above which voice activation opens the microphone. */
export const voiceThresholdDb = new Setting<number>("voice-threshold-db", -45);

/** `KeyboardEvent.code` of the push-to-talk key. */
export const pushToTalkKey = new Setting<string>("push-to-talk-key", "KeyT");

/**
 * What a screen share should favour when the machine or the network can't keep up:
 *  - "motion": keep the frame rate up and let the picture get softer (games, video);
 *  - "detail": keep the picture sharp and let the frame rate fall (slides, text, code).
 */
export type ScreenShareFocus = "motion" | "detail";
export const screenShareFocus = new Setting<ScreenShareFocus>(
  "screen-share-focus",
  "motion",
);

/** Capture height in pixels; 0 means whatever the screen natively is. */
export type ScreenShareResolution = 0 | 720 | 1080 | 1440;
export const screenShareResolution = new Setting<ScreenShareResolution>(
  "screen-share-resolution",
  1080,
);

export type ScreenShareFps = 15 | 30 | 60;
export const screenShareFps = new Setting<ScreenShareFps>(
  "screen-share-fps",
  30,
);

/** Maximum video bitrate in Mbit/s; 0 picks one to suit the resolution and frame rate. */
export const screenShareBitrateMbps = new Setting<number>(
  "screen-share-bitrate-mbps",
  0,
);

export type ScreenShareCodec = "vp8" | "h264";
export const screenShareCodec = new Setting<ScreenShareCodec>(
  "screen-share-codec",
  "vp8",
);

/** Encode a single version of the share instead of several for viewers on slow links. */
export const screenShareLowCpu = new Setting<boolean>(
  "screen-share-low-cpu",
  false,
);

/**
 * Lets a participant's volume go up to 200%. A plain media element cannot amplify, only a
 * Web Audio gain node can, and routing every remote track through Web Audio is a change to
 * how call audio is played back, so it is opt-in and takes effect on the next call joined.
 */
export const allowVolumeBoost = new Setting<boolean>(
  "allow-volume-boost",
  false,
);

export const showHandRaisedTimer = new Setting<boolean>(
  "hand-raised-show-timer",
  false,
);

export const showReactions = new Setting<boolean>("reactions-show", true);

export const playReactionsSound = new Setting<boolean>(
  "reactions-play-sound",
  true,
);

export const soundEffectVolume = new Setting<number>(
  "sound-effect-volume",
  0.5,
);

export const muteAllAudio = new Setting<boolean>("mute-all-audio", false);

export const alwaysShowSelf = new Setting<boolean>("always-show-self", true);

export const alwaysShowIphoneEarpiece = new Setting<boolean>(
  "always-show-iphone-earpiece",
  false,
);

export const enableExtendedLivekitLogs = new Setting<boolean>(
  "extended-livekit-logs",
  false,
);

export const matrixRTCMode = new Setting<MatrixRTCMode>(
  "matrix-rtc-mode",
  MatrixRTCMode.Compatibility,
);

export const customLivekitUrl = new Setting<string | null>(
  "custom-livekit-url",
  null,
);
