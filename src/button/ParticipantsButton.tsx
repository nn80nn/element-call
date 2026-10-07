/*
Copyright 2026 Element Creations Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { type ComponentPropsWithoutRef, type FC } from "react";
import { Button } from "@vector-im/compound-web";
import { useTranslation } from "react-i18next";
import { UserProfileIcon } from "@vector-im/compound-design-tokens/assets/web/icons";

export const ParticipantsButton: FC<
  Omit<ComponentPropsWithoutRef<"button">, "children">
> = (props) => {
  const { t } = useTranslation();
  return (
    <Button kind="secondary" size="md" Icon={UserProfileIcon} {...props}>
      {t("header_participants_label")}
    </Button>
  );
};
