/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type FC } from "react";
import { useTranslation } from "react-i18next";
import {
  MicOnSolidIcon,
  MicOffSolidIcon,
  VolumeOffSolidIcon,
  VolumeOnSolidIcon,
} from "@vector-im/compound-design-tokens/assets/web/icons";

import { Modal } from "../Modal";
import { Slider } from "../Slider";
import { Avatar, Size } from "../Avatar";
import { useBehavior } from "../useBehavior";
import { ConnectionQualityIndicator } from "../tile/ConnectionQualityIndicator";
import { maxPlaybackVolume } from "../state/savedVolumes";
import { type WrappedUserMediaViewModel } from "../state/media/WrappedUserMediaViewModel";
import { type RemoteUserMediaViewModel } from "../state/media/RemoteUserMediaViewModel";
import styles from "./ParticipantsModal.module.css";

const RemoteControls: FC<{ vm: RemoteUserMediaViewModel }> = ({ vm }) => {
  const { t } = useTranslation();
  const volume = useBehavior(vm.playbackVolume$);
  const muted = useBehavior(vm.playbackMuted$);
  const Icon = muted ? VolumeOffSolidIcon : VolumeOnSolidIcon;

  return (
    <div className={styles.controls}>
      <button
        type="button"
        className={styles.iconButton}
        aria-label={t("video_tile.mute_for_me")}
        aria-pressed={muted}
        onClick={vm.togglePlaybackMuted}
      >
        <Icon aria-hidden width={20} height={20} />
      </button>
      <Slider
        className={styles.slider}
        label={t("video_tile.volume")}
        value={volume}
        onValueChange={vm.adjustPlaybackVolume}
        onValueCommit={vm.commitPlaybackVolume}
        min={0}
        max={maxPlaybackVolume()}
        step={0.01}
      />
    </div>
  );
};

const ParticipantRow: FC<{ vm: WrappedUserMediaViewModel }> = ({ vm }) => {
  const { t } = useTranslation();
  const displayName = useBehavior(vm.displayName$);
  const avatarUrl = useBehavior(vm.mxcAvatarUrl$);
  const audioEnabled = useBehavior(vm.audioEnabled$);
  const speaking = useBehavior(vm.speaking$);
  const quality = useBehavior(vm.connectionQuality$);
  const MicIcon = audioEnabled ? MicOnSolidIcon : MicOffSolidIcon;

  return (
    <li className={styles.row} data-speaking={speaking}>
      <Avatar
        id={vm.userId}
        name={displayName}
        size={Size.SM}
        src={avatarUrl ?? undefined}
      />
      <span className={styles.name}>{displayName}</span>
      <MicIcon
        aria-label={audioEnabled ? t("microphone_on") : t("microphone_off")}
        width={20}
        height={20}
        className={styles.mic}
        data-muted={!audioEnabled}
      />
      <ConnectionQualityIndicator quality={quality} />
      {!vm.local && <RemoteControls vm={vm} />}
    </li>
  );
};

interface Props {
  open: boolean;
  onDismiss: () => void;
  participants: WrappedUserMediaViewModel[];
}

/**
 * Everyone in the call in one list, with the per-person volume and mute controls that
 * otherwise sit in each tile's menu where you have to hunt for them.
 */
export const ParticipantsModal: FC<Props> = ({
  open,
  onDismiss,
  participants,
}) => {
  const { t } = useTranslation();
  return (
    <Modal
      title={t("participants_modal.title")}
      open={open}
      onDismiss={onDismiss}
    >
      <ul className={styles.list}>
        {participants.map((vm) => (
          <ParticipantRow key={vm.id} vm={vm} />
        ))}
      </ul>
    </Modal>
  );
};
