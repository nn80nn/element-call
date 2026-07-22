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
// Type-only: erased at compile time, doesn't trigger loading the module (which touches
// AudioWorkletNode at the top level and would blow up outside a real browser, eg. in tests).
import type * as NoiseSuppression from "@workadventure/noise-suppression/audio-worklet";

import { logger } from "matrix-js-sdk/lib/logger";

async function loadModule(): Promise<typeof NoiseSuppression> {
  return import("@workadventure/noise-suppression/audio-worklet");
}

// DTLN's model was trained on 16kHz audio, so it needs a dedicated AudioContext running at
// that rate rather than the (usually 48kHz) context LiveKit shares between processors -
// MediaStreamAudioSourceNode resamples to whatever context it's created in, so creating our
// own keeps that resampling correct instead of feeding the model pitch-shifted audio.
const DTLN_SAMPLE_RATE = 16000;

/**
 * A LiveKit audio {@link TrackProcessor} that runs the local microphone track through DTLN
 * (via {@link https://github.com/workadventure/noise-suppression}) before it's published.
 * Unlike RNNoise, DTLN was trained on a noise set that includes short transient noises
 * (keyboard clicks, taps), not just steady background noise.
 */
export class DtlnTrackProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  public readonly name = "dtln-suppressor";
  public processedTrack?: MediaStreamTrack;

  private context?: AudioContext;
  private source?: MediaStreamAudioSourceNode;
  private worklet?: NoiseSuppression.NoiseSuppressionAudioWorkletHandle;
  private destination?: MediaStreamAudioDestinationNode;

  public async init(opts: AudioProcessorOptions): Promise<void> {
    await this.setup(opts);
  }

  public async restart(opts: AudioProcessorOptions): Promise<void> {
    await this.teardown();
    await this.setup(opts);
  }

  public async destroy(): Promise<void> {
    await this.teardown();
  }

  private async setup({ track }: AudioProcessorOptions): Promise<void> {
    const { createNoiseSuppressionAudioWorklet } = await loadModule();

    this.context = new AudioContext({ sampleRate: DTLN_SAMPLE_RATE });
    await this.context.resume();

    this.worklet = await createNoiseSuppressionAudioWorklet(this.context, {
      bypassUntilReady: true,
    });

    this.source = this.context.createMediaStreamSource(
      new MediaStream([track]),
    );
    this.destination = this.context.createMediaStreamDestination();

    this.source.connect(this.worklet.node);
    this.worklet.node.connect(this.destination);

    this.processedTrack = this.destination.stream.getAudioTracks()[0];
    logger.info("DTLN processor initialised");
  }

  private async teardown(): Promise<void> {
    this.source?.disconnect();
    this.worklet?.dispose();
    this.destination?.disconnect();
    await this.context?.close();
    this.context = undefined;
    this.source = undefined;
    this.worklet = undefined;
    this.destination = undefined;
    this.processedTrack = undefined;
  }
}

export function supportsDtln(): boolean {
  return (
    typeof AudioWorkletNode !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    !!AudioContext.prototype.createMediaStreamDestination
  );
}
