/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC, type ReactNode } from "react";
import { useTranslation } from "react-i18next";

import { FieldRow, InputField } from "../input/Input";
import {
  screenShareBitrateMbps,
  screenShareCodec,
  screenShareFocus,
  screenShareFps,
  screenShareLowCpu,
  screenShareResolution,
  type ScreenShareCodec,
  type ScreenShareFocus,
  type ScreenShareFps,
  type ScreenShareResolution,
  type Setting,
  useSetting,
} from "./settings";
import styles from "./AudioInputSettings.module.css";

interface Option<T> {
  value: T;
  label: string;
}

/** One group of radio buttons bound to a setting. */
function RadioSetting<T extends string | number>({
  name,
  title,
  setting,
  options,
}: {
  name: string;
  title: string;
  setting: Setting<T>;
  options: Option<T>[];
}): ReactNode {
  const [value, setValue] = useSetting(setting);
  return (
    <>
      <h4>{title}</h4>
      {options.map((option) => (
        <FieldRow key={option.value}>
          <InputField
            id={`${name}-${option.value}`}
            type="radio"
            name={name}
            label={option.label}
            checked={value === option.value}
            onChange={(): void => setValue(option.value)}
          />
        </FieldRow>
      ))}
    </>
  );
}

export const ScreenShareSettings: FC = () => {
  const { t } = useTranslation();
  const [lowCpu, setLowCpu] = useSetting(screenShareLowCpu);

  const focus: Option<ScreenShareFocus>[] = [
    { value: "motion", label: t("settings.screen_share.focus_motion") },
    { value: "detail", label: t("settings.screen_share.focus_detail") },
  ];
  const resolution: Option<ScreenShareResolution>[] = [
    { value: 720, label: "720p" },
    { value: 1080, label: "1080p" },
    { value: 1440, label: "1440p" },
    { value: 0, label: t("settings.screen_share.resolution_native") },
  ];
  const fps: Option<ScreenShareFps>[] = [
    { value: 15, label: t("settings.screen_share.fps", { fps: 15 }) },
    { value: 30, label: t("settings.screen_share.fps", { fps: 30 }) },
    { value: 60, label: t("settings.screen_share.fps", { fps: 60 }) },
  ];
  const bitrate: Option<number>[] = [
    { value: 0, label: t("settings.screen_share.bitrate_auto") },
    ...[2, 4, 6, 8, 12].map((mbps) => ({
      value: mbps,
      label: t("settings.screen_share.bitrate_mbps", { mbps }),
    })),
  ];
  const codec: Option<ScreenShareCodec>[] = [
    { value: "vp8", label: t("settings.screen_share.codec_vp8") },
    { value: "h264", label: t("settings.screen_share.codec_h264") },
  ];

  return (
    <div className={styles.root}>
      <h3>{t("settings.screen_share.title")}</h3>
      <p>{t("settings.screen_share.description")}</p>
      <RadioSetting
        name="ssFocus"
        title={t("settings.screen_share.focus_title")}
        setting={screenShareFocus}
        options={focus}
      />
      <RadioSetting
        name="ssResolution"
        title={t("settings.screen_share.resolution_title")}
        setting={screenShareResolution}
        options={resolution}
      />
      <RadioSetting
        name="ssFps"
        title={t("settings.screen_share.fps_title")}
        setting={screenShareFps}
        options={fps}
      />
      <RadioSetting
        name="ssBitrate"
        title={t("settings.screen_share.bitrate_title")}
        setting={screenShareBitrateMbps}
        options={bitrate}
      />
      <RadioSetting
        name="ssCodec"
        title={t("settings.screen_share.codec_title")}
        setting={screenShareCodec}
        options={codec}
      />
      <FieldRow>
        <InputField
          id="ssLowCpu"
          type="checkbox"
          label={t("settings.screen_share.low_cpu_label")}
          description={t("settings.screen_share.low_cpu_description")}
          checked={lowCpu}
          onChange={(e): void => setLowCpu(e.target.checked)}
        />
      </FieldRow>
      <p>{t("settings.screen_share.applies_next")}</p>
    </div>
  );
};
