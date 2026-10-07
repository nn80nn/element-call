/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { ConnectionQuality } from "livekit-client";
import { useTranslation } from "react-i18next";

import styles from "./ConnectionQualityIndicator.module.css";

const BARS: Partial<Record<ConnectionQuality, number>> = {
  [ConnectionQuality.Lost]: 0,
  [ConnectionQuality.Poor]: 1,
  [ConnectionQuality.Good]: 2,
  [ConnectionQuality.Excellent]: 3,
};

interface Props {
  quality: ConnectionQuality;
}

/**
 * Three signal bars next to a participant's name, so that a choppy voice can be told apart
 * from someone whose connection is struggling.
 */
export const ConnectionQualityIndicator: FC<Props> = ({ quality }) => {
  const { t } = useTranslation();
  const lit = BARS[quality];
  if (lit === undefined) return null;

  const label = {
    [ConnectionQuality.Excellent]: t("video_tile.connection_quality.excellent"),
    [ConnectionQuality.Good]: t("video_tile.connection_quality.good"),
    [ConnectionQuality.Poor]: t("video_tile.connection_quality.poor"),
    [ConnectionQuality.Lost]: t("video_tile.connection_quality.lost"),
  }[quality as Exclude<ConnectionQuality, ConnectionQuality.Unknown>];
  return (
    <span
      className={styles.indicator}
      data-quality={quality}
      role="img"
      aria-label={label}
      title={label}
    >
      {[1, 2, 3].map((bar) => (
        <span key={bar} data-lit={bar <= lit} />
      ))}
    </span>
  );
};
