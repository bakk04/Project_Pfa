# Next.js 14+ rPPG Biometric PWA — Annotated Project Structure

This tree describes the **target** layout for the modernized App Router project (Step 1 deliverable: worker + camera component; remaining files are scaffolding referenced by those modules and planned CI/PWA wiring).

```text
.
├── README.md                          # Runbook: env vars, Flask URL, HTTPS for camera
├── package.json                       # next@14+, react@18, typescript strict, tailwindcss@4,
│                                      # @mediapipe/tasks-vision, next-pwa, recharts (or lightweight chart)
├── package-lock.json / pnpm-lock.yaml
├── tsconfig.json                      # "strict": true, paths: "@/*" -> "./src/*"
├── next.config.mjs                    # next-pwa wrapper, worker webpack config if needed
├── postcss.config.mjs                 # Tailwind v4 PostCSS plugin
├── public/
│   ├── manifest.webmanifest           # PWA: name, icons, theme (light), display standalone
│   ├── icons/                         # maskable + standard PNG/WebP
│   └── offline.html                   # optional fallback route for SW
├── src/
│   ├── app/
│   │   ├── layout.tsx                 # Root layout: light theme class, font, providers
│   │   ├── page.tsx                   # Landing: mounts <BiometricCamera />, metadata export
│   │   ├── globals.css                # Tailwind v4 @import "tailwindcss"; design tokens (blue palette)
│   │   └── api/
│   │       └── health/route.ts        # optional local health for hosting checks
│   ├── components/
│   │   ├── ui/                        # Shared primitives: Card, Badge, RingGauge, GlassPanel
│   │   └── charts/
│   │       └── BvpSparkline.tsx       # Optional split: canvas/Recharts thin wrapper
│   ├── hooks/
│   │   ├── useRppgWorker.ts           # Worker lifecycle, typed postMessage bridge, reconnect batching
│   │   └── useIndexedDbQueue.ts       # Offline POST queue → sync when online
│   ├── lib/
│   │   ├── biometricPrecheck.ts       # Pure helpers: lux from histogram, FPS estimate, gating text
│   │   ├── flaskClient.ts             # POST { hr, hrv, bvp_segment, sqi, metadata } — no video
│   │   ├── mediapipe/
│   │   │   └── faceLandmarker.ts      # CDN asset paths, WASM init, single-flight load()
│   │   └── geometry/
│   │       └── roi.ts                 # Polygon from landmark indices → canvas path (testable)
│   ├── types/
│   │   ├── rppg-worker-messages.ts    # Shared mirror of worker message contracts (import type-only in app)
│   │   └── acquisition.ts           # Phase enum, UI state, calibration config
│   └── workers/
│       └── rppg.worker.ts             # Full DSP pipeline: resample 30 Hz, POS, Butterworth, SQI, HRV
├── workers/                           # **Deliverable path** (root-level mirror or symlink to `src/workers` in monorepos)
│   └── rppg.worker.ts                 # Bundler entry: `new URL('../workers/rppg.worker.ts', import.meta.url)`
├── components/
│   ├── BiometricCamera.tsx            # **Deliverable** — MediaPipe ROI sampling + worker bridge + UI
│   └── mediapipe-tasks-vision.d.ts    # Minimal typings until `@mediapipe/tasks-vision` is installed
├── tests/                             # Vitest (recommended) — unit tests import exported DSP from worker module
│   ├── dsp/
│   │   ├── resample.test.ts
│   │   ├── butterworth.test.ts
│   │   ├── pos.test.ts
│   │   └── sqi.test.ts
│   └── setup.ts
├── .eslintrc.cjs                      # @typescript-eslint strict, no-explicit-any
├── .prettierrc
└── .gitignore
```

## Notes

- **App Router only**: no `src/pages/**`. Dynamic `metadata` / `viewport` live beside routes under `src/app`.
- **DSP in worker**: React main thread runs MediaPipe + canvas sampling + UX only; all filtering, POS, PSD, and HRV live in `rppg.worker.ts`.
- **PWA**: `next-pwa` (or `@ducanh2912/next-pwa`) registers SW, precaches shell + static mediapipe WASM; optional runtime caching for model URLs.
- **Strict light Sehati UI**: `className` on `html`/`body` forces light scheme; blues + glass panels over `<video>` via stacked canvases / `backdrop-filter`.
- **Flask**: configure `NEXT_PUBLIC_RPPG_API_URL`; client batches failed requests in IndexedDB until `navigator.onLine`.
- **Step 1 paths**: `components/BiometricCamera.tsx` and `workers/rppg.worker.ts` at repo root match this brief; symlink or move into `src/` when wiring the App Router app.
