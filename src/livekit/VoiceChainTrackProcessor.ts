/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type Track,
  type AudioProcessorOptions,
  type TrackProcessor,
} from "livekit-client";

import { createVoiceChain, type VoiceChain } from "./voiceChain";

/**
 * A LiveKit audio {@link TrackProcessor} that applies only the voice chain (leveling and
 * voice activation) with no noise suppression in front of it. It exists for people who
 * have turned noise suppression off but still want voice activation.
 */
export class VoiceChainTrackProcessor implements TrackProcessor<
  Track.Kind.Audio,
  AudioProcessorOptions
> {
  public readonly name = "voice-chain";
  public processedTrack?: MediaStreamTrack;

  private source?: MediaStreamAudioSourceNode;
  private chain?: VoiceChain;
  private destination?: MediaStreamAudioDestinationNode;

  /** The running voice chain, for level metering. */
  public getVoiceChain(): VoiceChain | undefined {
    return this.chain;
  }

  public async init(opts: AudioProcessorOptions): Promise<void> {
    this.setup(opts);
    await Promise.resolve();
  }

  public async restart(opts: AudioProcessorOptions): Promise<void> {
    this.teardown();
    await this.init(opts);
  }

  public async destroy(): Promise<void> {
    this.teardown();
    await Promise.resolve();
  }

  private setup({ audioContext, track }: AudioProcessorOptions): void {
    this.source = audioContext.createMediaStreamSource(
      new MediaStream([track]),
    );
    this.chain = createVoiceChain(audioContext);
    this.destination = audioContext.createMediaStreamDestination();
    this.source.connect(this.chain.input);
    this.chain.output.connect(this.destination);
    this.processedTrack = this.destination.stream.getAudioTracks()[0];
  }

  private teardown(): void {
    this.source?.disconnect();
    this.chain?.dispose();
    this.destination?.disconnect();
    this.source = undefined;
    this.chain = undefined;
    this.destination = undefined;
    this.processedTrack = undefined;
  }
}
