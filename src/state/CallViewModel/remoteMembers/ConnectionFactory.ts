/*
Copyright 2025 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  Room as LivekitRoom,
  type RoomOptions,
  type BaseKeyProvider,
  type E2EEManagerOptions,
  type BaseE2EEManager,
} from "livekit-client";
import { type Logger } from "matrix-js-sdk/lib/logger";
// imported as inline to support worker when loaded from a cdn (cross domain)
import E2EEWorker from "livekit-client/e2ee-worker?worker&inline";
import { type CallMembershipIdentityParts } from "matrix-js-sdk/lib/matrixrtc/EncryptionManager";
import { type LivekitTransportConfig } from "matrix-js-sdk/lib/matrixrtc";

import { type ObservableScope } from "../../ObservableScope.ts";
import { Connection } from "./Connection.ts";
import type {
  OpenIDClientParts,
  SFUConfig,
} from "../../../livekit/openIDSFU.ts";
import type { MediaDevices } from "../../MediaDevices.ts";
import type { Behavior } from "../../Behavior.ts";
import type { ProcessorState } from "../../../livekit/TrackProcessorContext.tsx";
import { defaultLiveKitOptions } from "../../../livekit/options.ts";
import { setVolumeBoostActive } from "../../savedVolumes.ts";
import {
  allowVolumeBoost,
  noiseSuppression as noiseSuppressionSetting,
  noiseSuppressionDtln as noiseSuppressionDtlnSetting,
} from "../../../settings/settings.ts";
import { supportsRnnoise } from "../../../livekit/RnnoiseTrackProcessor.ts";

// TODO evaluate if this should be done like the Publisher Factory
export interface ConnectionFactory {
  createConnection(
    scope: ObservableScope,
    transport: LivekitTransportConfig,
    ownMembershipIdentity: CallMembershipIdentityParts,
    logger: Logger,
    sfuConfig?: SFUConfig,
  ): Connection;
}

export class ECConnectionFactory implements ConnectionFactory {
  private readonly livekitRoomFactory: () => LivekitRoom;

  /**
   * Creates a ConnectionFactory for LiveKit connections.
   *
   * @param client - The OpenID client parts for authentication, needed to get openID and JWT tokens.
   * @param roomId - The current room ID.
   * @param devices - Used for video/audio out/in capture options.
   * @param processorState$ - Effects like background blur (only for publishing connection?)
   * @param livekitKeyProvider - Optional key provider for end-to-end encryption.
   * @param controlledAudioDevices - Option to indicate whether audio output device is controlled externally (native mobile app).
   * @param livekitRoomFactory - Optional factory function (for testing) to create LivekitRoom instances. If not provided, a default factory is used.
   * @param echoCancellation - Whether to enable echo cancellation for audio capture.
   * @param noiseSuppression - Whether to enable noise suppression for audio capture.
   */
  public constructor(
    private client: OpenIDClientParts,
    private readonly roomId: string,
    private devices: MediaDevices,
    private processorState$: Behavior<ProcessorState>,
    livekitKeyProvider: BaseKeyProvider | undefined,
    private controlledAudioDevices: boolean,
    livekitRoomFactory?: () => LivekitRoom,
    echoCancellation: boolean = true,
    noiseSuppression: boolean = true,
  ) {
    const defaultFactory = (): LivekitRoom =>
      new LivekitRoom(
        generateRoomOption({
          devices: this.devices,
          processorState: this.processorState$.value,
          e2eeLivekitOptions: livekitKeyProvider && {
            keyProvider: livekitKeyProvider,
            // It's important that every room use a separate E2EE worker.
            // They get confused if given streams from multiple rooms.
            worker: new E2EEWorker(),
          },
          controlledAudioDevices: this.controlledAudioDevices,
          echoCancellation,
          noiseSuppression,
        }),
      );
    this.livekitRoomFactory = livekitRoomFactory ?? defaultFactory;
  }

  /**
   *
   * @param scope The observable scope (used for clean-up)
   * @param transport The transport to use for this connection.
   * @param ownMembershipIdentity required to connect (using the jwt service) with the SFU.
   * @param logger The logger instance to use for this connection.
   * @param sfuConfig optional config in case we already have a token for this connection.
   * @returns
   */
  public createConnection(
    scope: ObservableScope,
    transport: LivekitTransportConfig,
    ownMembershipIdentity: CallMembershipIdentityParts,
    logger: Logger,
    sfuConfig?: SFUConfig,
  ): Connection {
    return new Connection(
      {
        existingSFUConfig: sfuConfig,
        roomId: this.roomId,
        transport,
        client: this.client,
        scope: scope,
        livekitRoomFactory: this.livekitRoomFactory,
        ownMembershipIdentity,
      },
      logger,
    );
  }
}

/**
 *  Generate the initial LiveKit RoomOptions based on the current media devices and processor state.
 */
function generateRoomOption({
  devices,
  processorState,
  e2eeLivekitOptions,
  controlledAudioDevices,
  echoCancellation,
  noiseSuppression,
}: {
  devices: MediaDevices;
  processorState: ProcessorState;
  e2eeLivekitOptions:
    | E2EEManagerOptions
    | { e2eeManager: BaseE2EEManager }
    | undefined;
  controlledAudioDevices: boolean;
  echoCancellation: boolean;
  noiseSuppression: boolean;
}): RoomOptions {
  // When our own noise suppression is running, the browser's would only be a second pass
  // over already-cleaned audio, which smears speech; and its automatic gain control pumps
  // against ours. Leave both to the processor, which has its own leveling stage.
  const boost = allowVolumeBoost.value$.value;
  setVolumeBoostActive(boost);
  const ownNoiseSuppression =
    supportsRnnoise() &&
    (noiseSuppressionSetting.value$.value ||
      noiseSuppressionDtlnSetting.value$.value);
  return {
    ...defaultLiveKitOptions,
    webAudioMix: boost,
    videoCaptureDefaults: {
      ...defaultLiveKitOptions.videoCaptureDefaults,
      deviceId: devices.videoInput.selected$.value?.id,
      processor: processorState.processor,
    },
    audioCaptureDefaults: {
      ...defaultLiveKitOptions.audioCaptureDefaults,
      deviceId: devices.audioInput.selected$.value?.id,
      echoCancellation,
      noiseSuppression: noiseSuppression && !ownNoiseSuppression,
      autoGainControl: !ownNoiseSuppression,
    },
    audioOutput: {
      // When using controlled audio devices, we don't want to set the
      // deviceId here, because it will be set by the native app.
      // (also the id does not need to match a browser device id)
      deviceId: controlledAudioDevices
        ? undefined
        : devices.audioOutput.selected$.value?.id,
    },
    e2ee: e2eeLivekitOptions,
    // TODO test and consider this:
    // webAudioMix: true,
  };
}
