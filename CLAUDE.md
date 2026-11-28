# @xeplr/ui-jobs — map

The screens for `@xeplr/jobs` (list, run, pause, edit, run history, "After this job" rules),
shipped as `<Route>` elements a host mounts (xeplr-bi at `/workspace/jobs`) or run standalone
via `dev/`. It does NOT own routing/auth/layout (host's) and does NOT import workflow code:
"After this job" talks to the workflow API over HTTP. Only partly MVC: one big page
(`src/pages/Jobs.jsx`) holds its own state; pure logic is in `src/lib/` and `src/pages/*.js`.
No design-validation layer.

## Where things are
- `src/index.jsx` — `registerJobsUI(config)` → `{ routes, path }`; calls `configureJobsApi`, `configureOptionSources`, `configureChainsApi`; spreads the whole `config` into `JobsPage`. Also exports `jobsRoutes`, `CronScheduleField`, `CRON_PRESETS`, `describeCron`, `newJobQuery`.
- `src/routes.js` — `ROUTES.jobs(base)` → `base + '/jobs'`.
- `src/api/jobs.js` — model, module-level `API_BASE`: `listJobs`, `listActiveRuns` (`/jobs/active`), `listOccurrences` (all, `limit=0`), `listJobOccurrences`, `listJobActions`, `saveJob`, `deleteJob`, `triggerJob`, `pauseJob`, `resumeJob`, `fetchOccurrenceLogs` (`/logs`, NOT under `API_BASE`), `getRunContract`, option sources (`createOptionSources` from `@xeplr/ui-utils`).
- `src/api/jobChains.js` — `configureChainsApi`, `chainsEnabled`, `getChain`, `putChain` against `<chainsApiBase>/workflows/by-key|by-trigger|save`.
- `src/lib/jobChainModel.js` — rules ⇄ form rows (`rulesToRows`, `rowsToRules`, `sameRules`, `blankRow`) and rules ⇄ workflow (`rulesToWorkflow`, `workflowToRules`, `shortcutKey` = `after-job-<id>`); `trigger.` prefixing of fields/bindings; `acceptableFields`.
- `src/lib/incrementalModel.js` — "Each run takes": `incrementalChoices`, `incrementalDraft`, `incrementalBody` (none / `period` / `watermark` + `reloadDays`).
- `src/lib/newJobModel.js` — `newJobFrom(params, actions)` (untrusted link → draft), `newJobQuery()`, `NEW_JOB_KEYS`.
- `src/lib/parametersModel.js` — procedure parameter rows ⇄ text, `{window.from}`/`{window.to}` bindings from the run contract.
- `src/pages/jobsList.js` — pure: `jobState`, `isSystemJob`, `describeCron`, `nextRunLabel`, `prepareJobs` (search/sort), `latestByJob`, `progressStale` (`SILENT_MS`), `timezoneProblem`. `multiPick.js`, `relativeTime.js` — small helpers.
- Controllers: `src/useJobsUrl.js` (all screen state in the query: `edit`, `step`, `runs`, `log`, `q`, `sort`, `action`, `inputs`, `name`), `src/useJobChainController.js` (After-this-job rows, `check`, `save`), `src/useRunContract.js` (module-cached `GET /jobs/run-contract`).
- `src/pages/Jobs.jsx` — default `Jobs({ breadcrumb, uploadLink })`: list, live polling, `JobRuns`, `OccurrenceLogs`, `JobEditor` (steps `BASE_STEPS` + `AFTER_STEP`), `ActionInput`, `RemoteSelect`, `fromFieldValues`, `badJson`. `Jobs.css` (`jb-*`).
- `src/components/` — `CronScheduleField.jsx` (`csf-*`), `JobChainSection.jsx` (view for `useJobChainController`), `ParametersField.jsx` (`NameBox` suggestions).
- `dev/` — standalone shell (ui-account login, `registerMTs`, `registerJobsUI({})`); `vite.config.js` proxies to `API_URL`/`AUTH_URL`.

## Flow
- Mount: host `<Routes>{registerJobsUI({ basePath, apiBase, optionSources, chainsApiBase, breadcrumb, uploadLink }).routes}</Routes>`.
- Page load: `Jobs` `load()` → `listJobs` + `listOccurrences` + `listJobActions`. Live: `setInterval(tick, anyRunning ? 2000 : 15000)` → `listActiveRuns()`; one `load()` on the running→idle edge.
- Save: `JobEditor` submit → `badJson` → `incrementalBody` → `chain.check()` → existing job: `chain.save()` first → `saveJob([job])` (`POST /jobs/save`) → new job: `chain.save(newId)` after.

## To change X, edit Y
- New jobs endpoint → `src/api/jobs.js`
- Editor steps / their order → `Jobs.jsx` → `BASE_STEPS`, `AFTER_STEP`, `JobEditor`
- Input control per field type → `Jobs.jsx` → `ActionInput` (remote lists → `RemoteSelect`, params → `ParametersField`)
- Typed conversion of inputs on save → `Jobs.jsx` → `fromFieldValues`, `toFieldValue`
- Job state pill / labels → `jobsList.js` → `jobState`, `STATE_LABELS`; `Jobs.jsx` → `StatePill`, `RunPill`
- Cron sentence → `jobsList.js` → `describeCron` (public export; hosts reuse it with `CronScheduleField`); presets → `CronScheduleField.jsx` → `CRON_PRESETS`
- Search/sort → `jobsList.js` → `prepareJobs`
- Poll speeds → `Jobs.jsx` live-updates effect
- "After this job" storage shape → `jobChainModel.js` → `rulesToWorkflow` / `workflowToRules`
- Pre-filled new job link → `newJobModel.js`
- URL keys → `useJobsUrl.js` → `KEYS`

## Rules and traps
- Jobs never start each other: "After this job" is an ordinary workflow keyed `after-job-<jobId>`; `chainsApiBase` unset → `chainsEnabled()` false → step hidden. A workflow reshaped elsewhere → `editedElsewhere`, not editable here.
- Module-level config (`API_BASE`, `CHAINS_BASE`, `_optionSources`) is set by `registerJobsUI` before first render; one config per JS process.
- Never send credentials: fields with `system: true` are not rendered; `actionName` is a registry reference.
- A kind with no option source → plain text input, on purpose.
- System jobs (`isSystemJob`) get Run now only; no edit/delete/pause.
- Uses its own `useSearchParams` helper (`useJobsUrl`), not `@xeplr/ui-utils` `useUrlParams`. Opening/closing pushes history; typing/steps use `{ replace: true }`.
- Requests use `authFetch` from `@xeplr/ui-account` directly; polls are not aborted.

## Test
- `npm test` → `node test/run.mjs`: runs each `test/*.test.mjs` as a plain Node script (no framework, no services). Covers `jobsList.js`, `jobChainModel.js`, `incrementalModel.js`, `newJobModel.js`, `parametersModel.js`, `multiPick.js`. No tests for `Jobs.jsx`, controllers or the API module.
