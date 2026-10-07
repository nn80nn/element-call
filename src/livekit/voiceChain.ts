/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

/**
 * The Web Audio nodes a processed microphone signal is routed through.
 */
export interface VoiceChain {
  input: AudioNode;
  output: AudioNode;
  /** Disconnects every node in the chain. */
  dispose: () => void;
}

/**
 * Builds the stage that sits after noise suppression and before the signal is published.
 *
 * The browser's own automatic gain control is switched off whenever our noise suppression
 * is in use (it pumps audibly on top of it), so this takes over the job of keeping quiet
 * and loud speakers at a comparable level without the pumping:
 *
 *  1. a high-pass filter drops desk thumps and mains rumble below the voice band;
 *  2. a gentle compressor evens out soft and loud passages, and make-up gain brings the
 *     result back up, which is mostly what makes a quiet microphone usable;
 *  3. a fast limiter catches the peaks that make-up gain would otherwise clip.
 */
export function createVoiceChain(context: BaseAudioContext): VoiceChain {
  const highPass = context.createBiquadFilter();
  highPass.type = "highpass";
  highPass.frequency.value = 80;
  highPass.Q.value = 0.7;

  const leveler = context.createDynamicsCompressor();
  leveler.threshold.value = -30;
  leveler.knee.value = 14;
  leveler.ratio.value = 3;
  leveler.attack.value = 0.01;
  leveler.release.value = 0.25;

  const makeup = context.createGain();
  makeup.gain.value = 1.8;

  const limiter = context.createDynamicsCompressor();
  limiter.threshold.value = -3;
  limiter.knee.value = 0;
  limiter.ratio.value = 20;
  limiter.attack.value = 0.002;
  limiter.release.value = 0.1;

  highPass.connect(leveler);
  leveler.connect(makeup);
  makeup.connect(limiter);

  return {
    input: highPass,
    output: limiter,
    dispose: (): void => {
      highPass.disconnect();
      leveler.disconnect();
      makeup.disconnect();
      limiter.disconnect();
    },
  };
}
