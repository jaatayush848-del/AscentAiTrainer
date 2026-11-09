# Ascent AI Trainer

An independent, fully-free, gamified AI workout app.
No subscription, no ads, no accounts, no analytics. You bring your own API key
for [Token Harbor](https://tokenharbor.ai) (`https://tokenharbor.ai/v1`), and a
council of 50+ models builds your program, coaches you and generates your
progress images.

> **Branding:** this build uses only original, generic wording ("Ascent",
> "Athlete", "rank", "build-up ramp"). It ships no artwork, fonts, icons or
> names from any existing app.

> **Status:** source-complete but **never compiled or run**. There is no build
> tooling in the environment this was written in, so expect to fix a few type
> errors on the first `tsc` run. See "Known rough edges" below.

---

## What it does

| Screen | What it does |
|---|---|
| `app/index.tsx` | Gate: no key → setup, no profile → onboarding, no program → generate |
| `app/setup.tsx` | Paste your `thk_live_...` key, test it, save (also reached from the You tab to change it) |
| `app/onboarding/index.tsx` | Chat-style AI interview (15 questions) incl. **"in how many days do you want to become what?"** |
| `app/generate.tsx` | Runs the council and shows live per-model progress while the program is written |
| `app/(tabs)/home.tsx` | Motivation line, player card (rank/level/XP/streak), **deadline countdown**, today's mission, daily quests, 6 quick actions |
| `app/(tabs)/plan.tsx` | Full program: weekly schedule, 8-day build-up ramp, nutrition targets |
| `app/workout/[day].tsx` | Workout player: last-time targets, per-set kg/lb + reps, rest timer with bar, session note, live XP projection |
| `app/(tabs)/coach.tsx` | Free-form AI coach — answers **any** question. Streaming fast path, Stop button, council toggle |
| `app/(tabs)/progress.tsx` | Weight trend chart, body measurements, photo gallery, session history |
| `app/progress-photo.tsx` | **Progress image generator**: council analysis → offline poster (always works) + AI illustration (optional) |
| `app/(tabs)/profile.tsx` | Your key, connection test, streaming/council toggles, council model picker, chat model, image model, units, regenerate, erase data |
| `app/rank.tsx` | E → D → C → B → A → S → Contender → Elite ladder with XP gates |
| `app/achievements.tsx` | 18 achievements across bronze/silver/gold/mythic, each with a live progress bar and XP bounty |
| `app/history.tsx` | 14-week consistency heatmap, tap-a-day detail, full session log with sets/volume/XP |
| `app/productivity.tsx` | Weekly rhythm, day plan, "when will you actually train?" notes |

### Two posters, on purpose

`src/components/PosterCard.tsx` draws the transformation poster with plain React
Native views, so it renders on every device with no extra dependency — this is
the guaranteed path. `buildPosterSvg()` in `src/lib/progressImage.ts` writes the
same design to a 1080×1350 SVG file for high-resolution sharing. Both read the
same `PosterStats`, which is stored on each `ProgressPhoto`, so the gallery can
redraw any past poster natively (React Native's `Image` cannot display SVG).

## Progress, rewards and the deadline

Three layers keep the loop going:

1. **Achievements** (`src/lib/achievements.ts`) — every badge is a pure function
   over data you actually recorded: sessions, completed sets, total volume in kg,
   minutes trained, streak, body logs, progress images, quests and level. Nothing
   can be unlocked by pretending, and XP is paid exactly once (a `useRef` mirror
   guards against double-award). Unlocks surface as an animated toast from
   `src/components/AchievementToast.tsx`, mounted above the navigator.
2. **Ranks** — the E→Elite ladder, with XP-to-next and a session estimate.
3. **Deadline** — home shows "N days left" and a percentage bar against the
   `goalDays` you answered during onboarding, and turns red in the last week.
   The You tab repeats the promise verbatim ("YOUR MISSION").

## How the "50+ models work together" works

`src/lib/orchestrator.ts` runs a four-stage pipeline on every heavy request:

1. **ROUTE** — pick models by role (`planner`, `coach`, `nutrition`, `analyst`,
   `motivator`, `critic`) with a **max 2 models per vendor** cap so you never get
   five Claudes.
2. **DRAFT** — all drafters run in parallel via `Promise.all`. One model failing
   never kills the request; failures are recorded per model.
3. **SYNTH** — the heaviest model merges every draft into one superior answer,
   removing contradictions and filler.
4. **FALLBACK** — if synthesis fails, the highest-weighted successful draft is
   returned.

Program generation, progress analysis and council-mode chat all use this path.
Fast chat uses a single model. Nothing is faked locally: if the gateway is
unreachable, the app says so.

## Getting a key

1. Sign up at <https://tokenharbor.ai>.
2. Create a key at <https://tokenharbor.ai/dashboard/api-keys> — it is shown once.
3. Paste it into the app's setup screen.

Model ids ending in **`:free`** never charge your balance. Exact-repeat calls
within 5 minutes are billed at $0. See <https://tokenharbor.ai/docs>.

## Running it

**Prerequisites:** Node 18+.

```bash
cd AscentAITrainer
npm install

# generate the app icon + splash into assets/ (pure Node, no packages)
npm run assets

# if any expo package versions look off, let expo pick them:
npx expo install --fix

# typecheck
npm run typecheck      # == npx tsc --noEmit

# quickest way to try it: Expo Go on your phone (no build, no SDK)
npx expo start
```

`npm run assets` writes `assets/icon.png`, `assets/adaptive-icon.png`,
`assets/monochrome-icon.png` and `assets/splash.png`. It uses only Node's
built-in `zlib`, so there is nothing to install. The artwork is an original
"ascent chevron" mark. Re-run it only if you change the design.

## Getting an installable APK (no Android SDK needed)

Building locally needs the Android SDK **and** a JDK 17 toolchain, which most
people do not have. Two easier routes both produce a real APK in the cloud:

**Option 1 — EAS (simplest).** Free Expo account, ~10–20 minutes:

```bash
npx eas login
npx eas build -p android --profile preview
```

The `preview` profile in `eas.json` is already set to build an **APK**. EAS
prints a download link when it finishes.

**Option 2 — GitHub Actions (no Expo account).** Push this folder to a GitHub
repository, then open the **Actions** tab, pick **Build Android APK** and press
**Run workflow**. When it turns green, download the APK from the run's
**Artifacts** section. See `.github/workflows/build-apk.yml`.

Both routes run `npm run assets` for you, so the icons are included automatically.

> **No computer? Phone-only step-by-step (Hinglish):** see
> [`BUILD_APK_GUIDE.md`](./BUILD_APK_GUIDE.md) — it walks through zipping the
> folder, pushing it to GitHub from a phone browser, running the workflow and
> installing the APK.

## Project layout

```
app/                    expo-router routes (file = screen)
src/lib/tokenHarbor.ts  gateway client: chat, SSE streaming, models, ping
src/lib/models.ts       56-model catalog with roles/vendor/weight
src/lib/orchestrator.ts  the council pipeline (route → draft → synth → fallback)
src/lib/ai.ts           onboarding questions, program gen, analysis, coach, motivation
src/lib/gamification.ts XP curve, ranks, daily quests, streak
src/lib/progressImage.ts AI image call + dependency-free 1080×1350 SVG poster
src/lib/achievements.ts  18 achievements + volume/sets/minutes/streak stats
src/lib/storage.ts      AsyncStorage persistence
src/context/AppContext.tsx  single source of truth for all state + achievement engine
src/components/ui.tsx   Screen, Card, GlowCard, Btn, Chip, Pill, Progress
src/components/PosterCard.tsx  transformation poster, drawn natively
src/components/AchievementToast.tsx  animated unlock celebration
scripts/generate-assets.mjs  builds icon.png / adaptive-icon / splash (pure Node)
```

Everything is local-first: profile, program, sessions, photos, quests, level and
chat history live in AsyncStorage. The only network calls are to the gateway
your own key points at.

## Billing note

The developer pays nothing. Each user spends their own Token Harbor balance, and
free-tier model ids cost nothing at all. There is no server of ours in the loop.

## Known rough edges

- **Never compiled.** `npx tsc --noEmit` has not been run on a real machine.
  Most likely issues: `useLocalSearchParams` generic typing in
  `app/onboarding/index.tsx`, `app/generate.tsx` and `app/workout/[day].tsx`,
  `AbortController` typings, `expo-file-system` `EncodingType` usage, and an
  `expo-font` version mismatch (fix with `npx expo install --fix`).
- **No prebuilt APK ships with this repository.** It cannot be built in the
  environment this source was written in. Use EAS or the GitHub Actions
  workflow above to get one.
- Streaming only applies to the fast single-model path. Council answers arrive in
  one piece because they must be merged from several drafts first.
- The AI image endpoint (`POST /images/generations`) may not be enabled on every
  account. The dependency-free poster in `src/components/PosterCard.tsx` (plain
  RN views) is the guaranteed path and always produces an on-screen image; the
  SVG written by `savePoster()` is a separate, high-resolution file for sharing.

## Legal

This is an original work. It ships **no** assets, fonts, images or branding from
any existing app. The visual language (dark canvas, blue/gold accents, rank
ladder) is generic and the wording ("Ascent", "Athlete", "rank", "build-up
ramp") is original.

Workout and nutrition output is generated by language models and **is not
medical advice**. Talk to a professional before starting a new program,
especially with a heart condition, pregnancy, injury or medication. Stop if you
feel pain, dizziness or shortness of breath.
