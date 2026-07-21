/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import rnnoiseWorkletPath from "@sapphi-red/web-noise-suppressor/rnnoiseWorklet.js?url";
import rnnoiseWasmPath from "@sapphi-red/web-noise-suppressor/rnnoise.wasm?url";
import rnnoiseWasmSimdPath from "@sapphi-red/web-noise-suppressor/rnnoise_simd.wasm?url";
import {
  type Track,
  type AudioProcessorOptions,
  type TrackProcessor,
} from "livekit-client";
// Type-only: erased at compile time, doesn't trigger loading the module (which touches
// AudioWorkletNode at the top level and would blow up outside a real browser, eg. in tests).
import type * as WebNoiseSuppressor from "@sapphi-red/web-noise-suppressor";

import { logger } from "matrix-js-sdk/lib/logger";

// The actual @sapphi-red/web-noise-suppressor module declares classes that extend
// AudioWorkletNode at the top level, so importing it eagerly breaks anywhere that global
// doesn't exist (eg. unit tests running outside a real browser). Load it lazily, only once
// we actually need it - which in practice is only in browsers where noise suppression is
// supported and enabled.
async function loadModule(): Promise<typeof WebNoiseSuppressor> {
  return import("@sapphi-red/web-noise-suppressor");
}

// The wasm binary and worklet module are shared across every call the processor is used
// in, so we only fetch/register them once per page load rather than once per call.
let wasmBinaryPromise: Promise<ArrayBuffer> | undefined;
async function getWasmBinary(): Promise<ArrayBuffer> {
  wasmBinaryPromise ??= loadModule().then(async ({ loadRnnoise }) =>
    loadRnnoise({ url: rnnoiseWasmPath, simdUrl: rnnoiseWasmSimdPath }),
  );
  return wasmBinaryPromise;
}

const registeredWorkletContexts = new WeakSet<AudioContext>();
async function ensureWorkletRegistered(context: AudioContext): Promise<void> {
  if (registeredWorkletContexts.has(context)) return;
  await context.audioWorklet.addModule(rnnoiseWorkletPath);
  registeredWorkletContexts.add(context);
}

/**
 * A LiveKit audio {@link TrackProcessor} that runs the local microphone track through
 * RNNoise (via {@link https://github.com/sapphi-red/web-noise-suppressor}) before it's
 * published, to suppress background/environmental noise beyond what the browser's own
 * WebRTC noise suppression does.
 */
export class RnnoiseTrackProcessor
  implements TrackProcessor<Track.Kind.Audio, AudioProcessorOptions>
{
  public readonly name = "rnnoise-suppressor";
  public processedTrack?: MediaStreamTrack;

  private source?: MediaStreamAudioSourceNode;
  private node?: WebNoiseSuppressor.RnnoiseWorkletNode;
  private destination?: MediaStreamAudioDestinationNode;

  public async init(opts: AudioProcessorOptions): Promise<void> {
    await this.setup(opts);
  }

  public async restart(opts: AudioProcessorOptions): Promise<void> {
    this.teardown();
    await this.setup(opts);
  }

  public async destroy(): Promise<void> {
    this.teardown();
    await Promise.resolve();
  }

  private async setup({ audioContext, track }: AudioProcessorOptions): Promise<void> {
    const [{ RnnoiseWorkletNode }, wasmBinary] = await Promise.all([
      loadModule(),
      getWasmBinary(),
      ensureWorkletRegistered(audioContext),
    ]);

    this.source = audioContext.createMediaStreamSource(new MediaStream([track]));
    this.node = new RnnoiseWorkletNode(audioContext, {
      maxChannels: 1,
      wasmBinary,
    });
    this.destination = audioContext.createMediaStreamDestination();

    this.source.connect(this.node);
    this.node.connect(this.destination);

    this.processedTrack = this.destination.stream.getAudioTracks()[0];
    logger.info("RNNoise processor initialised");
  }

  private teardown(): void {
    this.source?.disconnect();
    this.node?.disconnect();
    this.node?.destroy();
    this.destination?.disconnect();
    this.source = undefined;
    this.node = undefined;
    this.destination = undefined;
    this.processedTrack = undefined;
  }
}

export function supportsRnnoise(): boolean {
  return (
    typeof AudioWorkletNode !== "undefined" &&
    typeof AudioContext !== "undefined" &&
    !!AudioContext.prototype.createMediaStreamDestination
  );
}
