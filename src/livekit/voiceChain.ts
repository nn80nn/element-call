/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { inputMode, voiceThresholdDb } from "../settings/settings";

/** How long the gate stays open after the level drops, so word endings aren't clipped. */
const GATE_HOLD_MS = 350;
const GATE_POLL_MS = 20;

/**
 * The Web Audio nodes a processed microphone signal is routed through.
 */
export interface VoiceChain {
  input: AudioNode;
  output: AudioNode;
  /** Current level of the incoming signal in dBFS (-Infinity for silence). */
  getLevelDb: () => number;
  /** Whether voice activation currently lets the signal through. */
  isOpen: () => boolean;
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

  // Voice activation. The level is read from the signal entering the chain, i.e. after noise
  // suppression, so room noise that was already removed doesn't hold the gate open.
  const analyser = context.createAnalyser();
  analyser.fftSize = 1024;
  const samples = new Float32Array(analyser.fftSize);
  const gate = context.createGain();

  let levelDb = -Infinity;
  let open = true;
  let lastLoud = 0;
  const poll = setInterval(() => {
    analyser.getFloatTimeDomainData(samples);
    let sum = 0;
    for (const s of samples) sum += s * s;
    levelDb = 20 * Math.log10(Math.sqrt(sum / samples.length) || 1e-10);

    const now = performance.now();
    if (levelDb > voiceThresholdDb.value$.value) lastLoud = now;
    // A hidden page has its timers throttled to about one tick a second, far too slow to
    // gate speech, so in that case fail open rather than chop words up.
    open =
      document.hidden ||
      inputMode.value$.value !== "voice" ||
      now - lastLoud < GATE_HOLD_MS;
    // Open quickly so the first syllable gets through, close a bit more gently.
    gate.gain.setTargetAtTime(
      open ? 1 : 0,
      context.currentTime,
      open ? 0.005 : 0.04,
    );
  }, GATE_POLL_MS);

  highPass.connect(analyser);
  highPass.connect(leveler);
  leveler.connect(makeup);
  makeup.connect(limiter);
  limiter.connect(gate);

  return {
    input: highPass,
    output: gate,
    getLevelDb: (): number => levelDb,
    isOpen: (): boolean => open,
    dispose: (): void => {
      clearInterval(poll);
      analyser.disconnect();
      gate.disconnect();
      highPass.disconnect();
      leveler.disconnect();
      makeup.disconnect();
      limiter.disconnect();
    },
  };
}
