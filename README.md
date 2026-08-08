# Remess Call

The call engine behind [Remess](https://github.com/nn80nn/element-web) — a fork of
[Element Call](https://github.com/element-hq/element-call), the MatrixRTC/LiveKit video and
voice app that Element embeds as a widget.

You don't install this on its own. It gets built as an embedded widget and bundled into the
Remess desktop app; this repository exists so the call side of the product can be changed
independently of the client around it.

Everything here is client-side. The protocol, the signalling and the SFU interaction are
untouched, so a Remess user and an Element user can be in the same call without noticing.

---

## What's different from Element Call

### Local noise suppression

Neither of these sends audio anywhere — both run in an `AudioWorklet` on your own machine,
plugged into LiveKit's audio `TrackProcessor` interface (the same extension point background
blur uses).

- **RNNoise**, via [`@sapphi-red/web-noise-suppressor`](https://github.com/sapphi-red/web-noise-suppressor).
  On by default. Good at steady background noise — fans, hum, hiss.
- **DTLN**, via [`@workadventure/noise-suppression`](https://github.com/workadventure/noise-suppression).
  Off by default, second checkbox in the audio settings, takes priority over RNNoise when
  both are on. It was added on the theory that its training set covers transient noise
  (keyboard clicks, knocks) that RNNoise is inherently weak at. In practice the difference
  turned out to be barely audible, so it's kept as a parked option rather than promoted.

Worth knowing if you're thinking of trying other models here: **NSNet2** was investigated
and rejected — the released ONNX graph exposes no recurrent-state I/O, so it only does
offline whole-file inference and would need re-exporting from training code for real-time
use. **DeepFilterNet** has no browser build at all; it's Rust/Python only, and porting it
would be a project in its own right, not a wrapper.

### Riding out a bad connection

Upstream drops you out of a call after about ten seconds of trouble — the effective window
is `min(sync grace period, delayed leave delay)`. On a connection that lags in bursts,
that's short enough to eject people from calls they never left.

| | Element Call | Remess Call |
|---|---|---|
| Delayed leave event | 18s | 30s |
| Sync disconnect grace period | 10s | 30s |
| LiveKit reconnect budget | 10 attempts, ~45s | ~3 minutes |
| Initial LiveKit connect | 1 retry, 15s timeouts | 3 retries, 30s timeouts |

The cost is a longer ghost participant: someone who crashes or loses power stays visible in
the call until the server fires their leave event. A homeserver that caps delayed events
below this is handled — the membership manager clamps to whatever the server allows.

> ⚠️ These numbers live in **two** places. `DEFAULT_CONFIG` in
> [`src/config/ConfigOptions.ts`](src/config/ConfigOptions.ts) is what standalone
> deployments get, but the embedded build *generates its own* `config.json` inline in
> [`vite-embedded.config.ts`](vite-embedded.config.ts), and that wins. Change one without
> the other and the tuning silently doesn't reach the desktop app.

### Appearance

Compound's `accent` token family is remapped from green to the shipped `purple` scale, for
a Discord-like blurple. This is safe to do wholesale because `accent` and `success` are
separate token families — encryption and status greens are untouched.

## Building

```bash
pnpm install
pnpm build:embedded
```

Output lands in `dist/`, which is what gets copied over the client's bundled widget.

On Windows the `build:embedded` script fails, because it's written as
`NODE_OPTIONS=... vite build` and cmd.exe can't parse that. Either run it from a POSIX
shell, or invoke vite directly:

```bash
pnpm exec vite build --config vite-embedded.config.ts
```

In practice you don't need to do any of this by hand — the client's
`apps/desktop/remess/build.ps1` builds this repo, overlays it onto the widget, and verifies
a fork-only marker made it into the bundle before packaging.

### Running it standalone

`pnpm dev` serves the full app. Two things reliably waste an afternoon otherwise:

- `public/config.json` must exist, even as `{}`. Vite's SPA fallback answers the missing
  file with `index.html` and HTTP 200, `Config.ts` tries to parse HTML as JSON, and the app
  hangs on "Loading…" with nothing in the console.
- The dev server is HTTPS with a self-signed cert by default, which trips mixed-content
  blocking when embedded in the desktop app's `vector://` page. For local widget testing
  it's far easier to serve plain HTTP than to fight certificate trust.

## Relationship to upstream

This tracks `element-hq/element-call` on the `livekit` branch and is not affiliated with
Element. Upstream's README — architecture, configuration reference, deployment guide — is
preserved at [README.upstream.md](README.upstream.md).

Licensing is unchanged from upstream: AGPL-3.0-only OR LicenseRef-Element-Commercial, see
[LICENSE-AGPL-3.0](LICENSE-AGPL-3.0).
