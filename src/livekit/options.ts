/*
Copyright 2023, 2024 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  AudioPresets,
  DefaultReconnectPolicy,
  type RoomConnectOptions,
  type RoomOptions,
  ScreenSharePresets,
  type TrackPublishDefaults,
  type VideoPreset,
  VideoPresets,
} from "livekit-client";

const defaultLiveKitPublishOptions: TrackPublishDefaults = {
  audioPreset: AudioPresets.music,
  dtx: true,
  // disable red because the livekit server strips out red packets for clients
  // that don't support it (firefox) but of course that doesn't work with e2ee.
  red: false,
  forceStereo: false,
  simulcast: true,
  videoSimulcastLayers: [VideoPresets.h180, VideoPresets.h360] as VideoPreset[],
  screenShareEncoding: ScreenSharePresets.h1080fps30.encoding,
  stopMicTrackOnMute: false,
  videoCodec: "vp8",
  videoEncoding: VideoPresets.h720.encoding,
  backupCodec: { codec: "vp8", encoding: VideoPresets.h720.encoding },
} as const;

// LiveKit's DefaultReconnectPolicy stops after ten attempts, which works out at roughly 45
// seconds of trying before the media session is declared dead. Keep the same ramp but let it
// keep retrying for a few minutes: on a connection that drops out in bursts, the difference
// is between the call healing itself and the user having to rejoin by hand. The MatrixRTC
// membership outlives this too, so there is a session left to rejoin when the media comes back.
const RECONNECT_MAX_DELAY_MS = 7000;
const reconnectDelaysMs = [
  0,
  300,
  2 * 2 * 300,
  3 * 3 * 300,
  4 * 4 * 300,
  ...new Array<number>(25).fill(RECONNECT_MAX_DELAY_MS),
];

/**
 * Options for the initial `Room.connect`. LiveKit's own defaults allow a single retry with
 * 15 second timeouts, which is easy to blow through while the network is still settling down.
 */
export const defaultLiveKitConnectOptions: RoomConnectOptions = {
  maxRetries: 3,
  peerConnectionTimeout: 30_000,
  websocketTimeout: 30_000,
};

export const defaultLiveKitOptions: RoomOptions = {
  // automatically manage subscribed video quality
  adaptiveStream: true,

  // optimize publishing bandwidth and CPU for published tracks
  dynacast: true,

  // capture settings
  videoCaptureDefaults: {
    resolution: VideoPresets.h720.resolution,
  },

  // publish settings
  publishDefaults: defaultLiveKitPublishOptions,

  // default LiveKit options that seem to be sane
  stopLocalTrackOnUnpublish: true,
  reconnectPolicy: new DefaultReconnectPolicy(reconnectDelaysMs),
  disconnectOnPageLeave: true,
  webAudioMix: false,
};
