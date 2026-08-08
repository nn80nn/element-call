/*
Copyright 2025 New Vector Ltd.

SPDX-License-Identifier: AGPL-3.0-only OR LicenseRef-Element-Commercial
Please see LICENSE in the repository root for full details.
*/

import { defineConfig, mergeConfig } from "vite";
import generateFile from "vite-plugin-generate-file";

import fullConfig from "./vite.config";

const base = "./";

// Config for embedded deployments (possibly hosted under a non-root path)
export default defineConfig((env) =>
  mergeConfig(
    fullConfig({ ...env, packageType: "embedded" }),
    defineConfig({
      base, // Use relative URLs to allow the app to be hosted under any path
      publicDir: false, // Don't serve the public directory which only contains the favicon
      plugins: [
        generateFile([
          {
            type: "json",
            output: "./config.json",
            // NB: whatever is written here wins over DEFAULT_CONFIG for every embedded
            // (widget) deployment, which is the one our desktop app ships, so the
            // resilience defaults have to be kept in step with the ones in
            // src/config/ConfigOptions.ts rather than only being set there.
            data: {
              matrix_rtc_session: {
                wait_for_key_rotation_ms: 5000,
                delayed_leave_event_restart_ms: 4000,
                // Upstream uses 18s. On a connection that lags in bursts that is short
                // enough to eject people from calls they never left; see the comment on
                // DEFAULT_CONFIG for the trade-off against lingering ghost participants.
                delayed_leave_event_delay_ms: 30000,
              },
              sync_disconnect_grace_period_ms: 30000,
            },
          },
        ]),
      ],
    }),
  ),
);
