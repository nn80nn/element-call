/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import {
  type FC,
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useTranslation } from "react-i18next";
import { Button } from "@vector-im/compound-web";
import { logger } from "matrix-js-sdk/lib/logger";
import { Track } from "livekit-client";

import { FieldRow, InputField } from "../input/Input";
import { Slider } from "../Slider";
import { useMediaDevices } from "../MediaDevicesContext";
import {
  type InputMode,
  allowVolumeBoost as allowVolumeBoostSetting,
  inputMode as inputModeSetting,
  noiseSuppression as noiseSuppressionSetting,
  noiseSuppressionDtln as noiseSuppressionDtlnSetting,
  pushToTalkKey as pushToTalkKeySetting,
  useSetting,
  voiceThresholdDb as voiceThresholdSetting,
} from "./settings";
import { type VoiceChain } from "../livekit/voiceChain";
import {
  RnnoiseTrackProcessor,
  supportsRnnoise,
} from "../livekit/RnnoiseTrackProcessor";
import {
  DtlnTrackProcessor,
  supportsDtln,
} from "../livekit/DtlnTrackProcessor";
import { VoiceChainTrackProcessor } from "../livekit/VoiceChainTrackProcessor";
import styles from "./AudioInputSettings.module.css";

const METER_FLOOR_DB = -70;
const METER_CEILING_DB = -10;

/** Position of a level on the meter, from 0 to 1. */
const meterPosition = (db: number): number =>
  Math.min(
    1,
    Math.max(0, (db - METER_FLOOR_DB) / (METER_CEILING_DB - METER_FLOOR_DB)),
  );

/** Human-readable name for a `KeyboardEvent.code`. */
const keyLabel = (code: string): string =>
  code.replace(/^Key/, "").replace(/^Digit/, "");

type TestProcessor =
  | RnnoiseTrackProcessor
  | DtlnTrackProcessor
  | VoiceChainTrackProcessor;

interface MicTest {
  stop: () => void;
  chain: () => VoiceChain | undefined;
}

/**
 * Opens the selected microphone through the same processing a call would use, so what
 * the meter shows -- and what can be listened back to -- is what other people would hear.
 */
async function startMicTest(
  deviceId: string | undefined,
  outputId: string | undefined,
  monitor: boolean,
): Promise<MicTest> {
  const useDtln = noiseSuppressionDtlnSetting.value$.value && supportsDtln();
  const useRnnoise =
    !useDtln && noiseSuppressionSetting.value$.value && supportsRnnoise();
  const ownNoiseSuppression = useDtln || useRnnoise;

  const stream = await navigator.mediaDevices.getUserMedia({
    audio: {
      deviceId: deviceId ? { exact: deviceId } : undefined,
      echoCancellation: true,
      noiseSuppression: !ownNoiseSuppression,
      autoGainControl: !ownNoiseSuppression,
    },
  });
  const context = new AudioContext();
  await context.resume();
  const track = stream.getAudioTracks()[0];

  const processor: TestProcessor = useDtln
    ? new DtlnTrackProcessor()
    : useRnnoise
      ? new RnnoiseTrackProcessor()
      : new VoiceChainTrackProcessor();
  await processor.init({
    kind: Track.Kind.Audio,
    audioContext: context,
    track,
  });

  let monitorSource: MediaStreamAudioSourceNode | undefined;
  if (monitor && processor.processedTrack) {
    if (outputId && "setSinkId" in context) {
      await (
        context as AudioContext & { setSinkId: (id: string) => Promise<void> }
      )
        .setSinkId(outputId)
        .catch((e: unknown) => logger.warn("Could not route mic test", e));
    }
    monitorSource = context.createMediaStreamSource(
      new MediaStream([processor.processedTrack]),
    );
    monitorSource.connect(context.destination);
  }

  return {
    chain: () => processor.getVoiceChain(),
    stop: (): void => {
      monitorSource?.disconnect();
      void processor.destroy();
      track.stop();
      void context.close();
    },
  };
}

const LevelMeter: FC<{ test: MicTest | null; thresholdDb: number }> = ({
  test,
  thresholdDb,
}) => {
  const fillRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!test) return;
    const timer = setInterval(() => {
      const chain = test.chain();
      const fill = fillRef.current;
      if (!chain || !fill) return;
      fill.style.width = `${meterPosition(chain.getLevelDb()) * 100}%`;
      fill.dataset.open = String(chain.isOpen());
    }, 50);
    return (): void => clearInterval(timer);
  }, [test]);

  return (
    <div className={styles.meter} aria-hidden>
      <div ref={fillRef} className={styles.meterFill} data-open="false" />
      {Number.isFinite(thresholdDb) && (
        <div
          className={styles.threshold}
          style={{ left: `${meterPosition(thresholdDb) * 100}%` }}
        />
      )}
    </div>
  );
};

export const AudioInputSettings: FC = () => {
  const { t } = useTranslation();
  const devices = useMediaDevices();
  const [mode, setMode] = useSetting(inputModeSetting);
  const [thresholdDb, setThresholdDb] = useSetting(voiceThresholdSetting);
  const [thresholdRaw, setThresholdRaw] = useState(thresholdDb);
  const [pttCode, setPttCode] = useSetting(pushToTalkKeySetting);
  const [capturingKey, setCapturingKey] = useState(false);
  const [test, setTest] = useState<MicTest | null>(null);
  const [listen, setListen] = useState(false);
  const [error, setError] = useState(false);
  const [boost, setBoost] = useSetting(allowVolumeBoostSetting);

  // Rebinding: the next key pressed becomes the push-to-talk key.
  useEffect(() => {
    if (!capturingKey) return;
    const onKey = (e: KeyboardEvent): void => {
      e.preventDefault();
      e.stopPropagation();
      if (e.code !== "Escape") setPttCode(e.code);
      setCapturingKey(false);
    };
    window.addEventListener("keydown", onKey, { capture: true });
    return (): void =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [capturingKey, setPttCode]);

  const testRef = useRef<MicTest | null>(null);
  testRef.current = test;
  // Never leave the microphone open after the settings are closed.
  useEffect(() => (): void => testRef.current?.stop(), []);

  const begin = useCallback(
    (monitor: boolean) => {
      setError(false);
      startMicTest(
        devices.audioInput.selected$.value?.id,
        devices.audioOutput.selected$.value?.id,
        monitor,
      )
        .then(setTest)
        .catch((e) => {
          logger.error("Microphone test failed", e);
          setError(true);
        });
    },
    [devices],
  );

  const onToggleTest = useCallback(() => {
    if (test) {
      test.stop();
      setTest(null);
    } else {
      begin(listen);
    }
  }, [test, begin, listen]);

  // The monitor routing is fixed when the test starts, so changing it restarts the test.
  const onToggleListen = useCallback(
    (checked: boolean) => {
      setListen(checked);
      if (test) {
        test.stop();
        setTest(null);
        begin(checked);
      }
    },
    [test, begin],
  );

  const modeOption = (value: InputMode, label: string): ReactNode => (
    <FieldRow>
      <InputField
        id={`inputMode-${value}`}
        type="radio"
        name="inputMode"
        label={label}
        checked={mode === value}
        onChange={(): void => setMode(value)}
      />
    </FieldRow>
  );

  return (
    <div className={styles.root}>
      <FieldRow>
        <InputField
          id="allowVolumeBoost"
          type="checkbox"
          label={t("settings.audio_tab.volume_boost_label")}
          description={t("settings.audio_tab.volume_boost_description")}
          checked={boost}
          onChange={(e): void => setBoost(e.target.checked)}
        />
      </FieldRow>
      <h4>{t("settings.audio_tab.input_mode_title")}</h4>
      {modeOption("open", t("settings.audio_tab.input_mode_open"))}
      {modeOption("voice", t("settings.audio_tab.input_mode_voice"))}
      {modeOption("ptt", t("settings.audio_tab.input_mode_ptt"))}

      {mode === "ptt" && (
        <div className={styles.row}>
          <span>{t("settings.audio_tab.ptt_key_label")}</span>
          <Button
            size="md"
            kind="secondary"
            onClick={(): void => setCapturingKey(true)}
          >
            {capturingKey
              ? t("settings.audio_tab.ptt_key_press")
              : keyLabel(pttCode)}
          </Button>
        </div>
      )}

      {mode === "voice" && (
        <div className={styles.slider}>
          <label>
            {t("settings.audio_tab.voice_threshold_label", {
              db: Math.round(thresholdRaw),
            })}
          </label>
          <Slider
            label={t("settings.audio_tab.voice_threshold_label", {
              db: Math.round(thresholdRaw),
            })}
            value={thresholdRaw}
            onValueChange={setThresholdRaw}
            onValueCommit={setThresholdDb}
            min={METER_FLOOR_DB}
            max={METER_CEILING_DB}
            step={1}
          />
        </div>
      )}

      <h4>{t("settings.audio_tab.test_title")}</h4>
      <LevelMeter
        test={test}
        thresholdDb={mode === "voice" ? thresholdRaw : -Infinity}
      />
      <div className={styles.row}>
        <Button size="md" kind="secondary" onClick={onToggleTest}>
          {test
            ? t("settings.audio_tab.test_stop")
            : t("settings.audio_tab.test_start")}
        </Button>
      </div>
      <FieldRow>
        <InputField
          id="micTestListen"
          type="checkbox"
          label={t("settings.audio_tab.test_listen")}
          description={t("settings.audio_tab.test_listen_description")}
          checked={listen}
          onChange={(e): void => onToggleListen(e.target.checked)}
        />
      </FieldRow>
      {error && (
        <p className={styles.error}>{t("settings.audio_tab.test_error")}</p>
      )}
    </div>
  );
};
