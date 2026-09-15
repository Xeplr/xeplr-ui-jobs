# @xeplr/ui-jobs

**The screens for [`@xeplr/jobs`](https://www.npmjs.com/package/@xeplr/jobs).** Create a job, schedule it with cron, run it now, pause and resume it, and watch its runs, live progress and logs. It ships as React routes your app registers, or as a small standalone app.

```jsx
import { registerJobsUI } from '@xeplr/ui-jobs'

const jobs = registerJobsUI({ basePath: '/workspace' })   // page at /workspace/jobs

<Routes>
  {/* …your routes… */}
  {jobs.routes}
</Routes>
```

## How the pieces fit

| what | where |
|---|---|
| The jobs page | `registerJobsUI()` → `<Route>` elements for your `<Routes>` |
| Router, auth gate, layout, breadcrumb | **your app** — the package owns only the jobs screen |
| Authenticated requests (token, tenant headers) | `authFetch` from `@xeplr/ui-account` |
| Confirm dialogs, error toasts | `raiseConfirm`, `raiseSnackbar` from `@xeplr/ui-utils` |
| The API, the scheduler, the action registry | `@xeplr/jobs` on the server: `init()`, then `router()`, then `startScheduler()` |
| The input form for a job | generated from the chosen action's `inputSchema`, as served by `GET /actions` |

Why the UI lives here: jobs is one product — a scheduler, an HTTP API **and** its screens. Before this package, a host that wanted to schedule something rebuilt the screens, and each copy drifted from the backend. A host now supplies only the infrastructure it already has, the same split the backend makes (`@xeplr/jobs`' `router()` mounts in your Express app, or `start()` / `xeplr-jobs-server` stands up its own).

## Install

```sh
npm i @xeplr/ui-jobs
```

Peers: `react` 18 or 19, `react-router-dom` 6 or 7, `@xeplr/ui-account`, `@xeplr/ui-utils`.

The package ships `src/` untranspiled — JSX, and CSS imported from the components — so your bundler must compile both (Vite does).

### The backend

```js
// server
var jobs = require('@xeplr/jobs')

await jobs.init({ database: process.env.DB_JOBS, connection: appConnection, mts: appMtConfig })
app.use(jobs.router({ auth: authMiddleware }))
jobs.startScheduler()
```

See the [`@xeplr/jobs` README](https://www.npmjs.com/package/@xeplr/jobs) for migrations, the permissions in `migrations-auth/` (`jobs:view`, `jobs:create`, `jobs:run`, `jobs:manage`) and which actions a job may run.

## Embed it in your app

```jsx
import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import { configure, AccessProvider } from '@xeplr/ui-account'
import { registerJobsUI } from '@xeplr/ui-jobs'

configure(import.meta.env.VITE_API_URL)                 // where authFetch sends requests
const jobs = registerJobsUI({ basePath: '/workspace', breadcrumb: MyBreadcrumb })

export function App() {
  return (
    <BrowserRouter>
      <AccessProvider>
        <nav><Link to={jobs.path}>Jobs</Link></nav>
        <Routes>
          {jobs.routes}
        </Routes>
      </AccessProvider>
    </BrowserRouter>
  )
}
```

There is no embedded / standalone switch: `registerJobsUI()` returns `<Route>` elements, and what differs is who wraps them.

## `registerJobsUI(config)`

| option | default | |
|---|---|---|
| `basePath` | `''` | prefix for the page path: `'/workspace'` → `/workspace/jobs` |
| `apiBase` | `''` | prefix for the jobs API paths, when `router()` is mounted under a path rather than at your API root |
| `optionSources` | `{}` | where a kind of thing is listed, for action inputs with `optionsFrom` — see below |
| `breadcrumb` | — | a component, rendered as `<Breadcrumb items={[{ label: 'Jobs' }]} />` above the page |
| `uploadLink` | — | element or string, shown in the page footnote ("Loading a file into a table is recorded separately — see …"); without it the footnote says "the upload screen" |
| `connectLink` | — | element shown in the header before **+ New job** — a link to a workflow canvas for chaining jobs. Passed in rather than imported, so this package does not depend on workflow (which already calls jobs over HTTP) |

Returns `{ routes, path }`: one `<Route>` at `path`, and the path itself so your navigation does not retype it.

`apiBase` and `optionSources` are module-level settings — the last `registerJobsUI()` call wins.

## Requests

Every call goes through `authFetch`, which prefixes the base URL `@xeplr/ui-account` was `configure`d with and adds the token and tenant headers.

| call | route (after `apiBase`) |
|---|---|
| job list | `GET /jobs?limit=0` |
| what is running (polled) | `GET /jobs/active` |
| last run per job, recent runs | `GET /job-occurrences?limit=0` |
| one job's history | `GET /jobs/:id/occurrences?limit=50` |
| action catalogue | `GET /actions` |
| save | `POST /jobs/save` with `[job]` |
| delete | `POST /jobs/delete` with `{ ids: [id] }` |
| run now | `POST /jobs/:id/trigger` |
| pause / resume | `POST /jobs/:id/pause`, `POST /jobs/:id/resume` |
| a run's log lines | `GET /logs?referenceId=<occurrenceId>` — **not** under `apiBase` |
| an option list | `GET <source.url>?limit=0` — under `apiBase` |

`/logs` is the platform's generic log route, not part of `@xeplr/jobs`. A host without it answers 404 and the panel shows an error in place of the log. Log lines are keyed by occurrence id because an action writes under the `referenceId` it is handed.

## The screen

- **Jobs table** — name, state (Running, Paused, Manual only, Scheduled), schedule in words (`describeCron`, else "Custom"), next run ("in 3 hours", "due now"), last run, an **on / paused switch**, and **Run now**, **Edit**, **Delete** (confirmed; run history is kept). Search matches name, description and action; sort by name, next run or action.
- **Run history** — the last-run cell opens that job's newest 50 runs, each with its log.
- **Recent runs** — the 12 latest runs across all jobs, with duration, trigger and error message.
- **Live updates** (on by default) — polls `GET /jobs/active` every **2 s** while anything runs and every **15 s** otherwise, so a cron run that starts by itself appears; when the last run finishes, the page reloads once to pick up the final status. Rows show rows read (`1.2K rows`) and flag a run with no progress update for 2 minutes. Uncheck to stop polling.

State shows **Running** over **Paused**: a pause takes effect at the next pick, and "paused" over a live run invites starting a second one. A job with no schedule has its switch off and disabled — there is nothing for the scheduler to pick.

### The editor

Three steps, all reachable at any time, with **Save job** on each:

1. **Job** — name, description, action.
2. **Inputs** — a control per field of the action's `inputSchema`: a select for `options`, true/false for `boolean`, a number input, a JSON textarea for `object` / `array` (invalid JSON blocks the save), text otherwise. Fields marked `system: true` are never shown — the server fills them, and rendering them would ask for a credential. Optional fields with a `default` are under **Advanced**, whose summary lists their values. Values are converted to the declared types on save, since `@xeplr/schema-handler` rejects `"1000"` for a number.
3. **Schedule** — cron (`CronScheduleField`), status, **Start from** (`startAt`), **Retry on failure** (0–3, default 0), **Give up after** (`timeoutMinutes`, blank = server default of 30).

A new job with a schedule defaults to **Paused**, so it can be written now and started later. A job with no schedule is saved as `ready` and runs only when triggered.

## Option sources

An input field can ask for a choice from a kind of thing — `optionsFrom: 'connections'`. This package never learns what a connection is; your app says where each kind is listed:

```js
registerJobsUI({
  optionSources: {
    connections: { url: '/connectioninfo', label: 'label' },
    tables:      { url: '/warehouse/tables', key: 'tables', value: 'name', label: 'name' }
  }
})
```

| source key | default | |
|---|---|---|
| `url` | — | fetched with `?limit=0` |
| `label` | — | row field shown |
| `value` | `'id'` | row field stored |
| `key` | `'dataArray'` | response property holding the rows — named, not guessed, because a wrong guess is an empty dropdown with no error |

- **A kind with no source gets a plain text input.** An empty dropdown looks broken; a text box is what you have without a catalogue.
- A field with `dependsOn: 'connectionInfoId'` stays disabled until that field has a value, then requests `?connectionInfoId=<value>` and keeps only rows whose `connectionId` equals it.
- A failed fetch says "Could not load the list" rather than showing an empty one.

## Other exports

| export | |
|---|---|
| `CronScheduleField` | `<CronScheduleField value={cron} onChange={setCron} id? />` — presets, a custom cron input and a plain-English reading |
| `CRON_PRESETS` | manual only, every 15 minutes, hourly, daily 02:00, weekly Monday 06:00, monthly 1st 03:00 |
| `describeCron(expr)` | five-field cron → sentence: `'*/15 * * * *'` → "Every 15 minutes", `'30 */6 * * *'` → "Every 6 hours, at 30 past", `'0 6 * * 1'` → "Every Monday at 06:00", `'0 3 1 * *'` → "Monthly on day 1 at 03:00". **`null` for ranges, lists or anything else** — a wrong reading is worse than the raw cron |
| `jobsRoutes` | `{ jobs(base) }` → `base + '/jobs'` |

## Run it standalone

```sh
npm install
npm run dev        # http://localhost:19004
```

`dev/` is the shell a host would otherwise provide: `@xeplr/ui-account`'s login routes, a `ProtectedRoute`, tenancy headers `x-company-id` / `x-workspace-id` (keep them in step with the API's `registerMTs`), and the same `registerJobsUI({})` call. `vite.config.js` proxies `/auth/api` to `AUTH_URL` and `/me`, `/companies`, `/workspaces`, `/jobs`, `/job-occurrences`, `/actions` to `API_URL` (default `http://localhost:19003`, the `xeplr-jobs-server` port). `UI_PORT` changes the dev port. `/logs` is not proxied. `dev/` is not published.

## Theming

Styles read `--accent`, `--surface`, `--ink`, `--muted`, `--hair`, `--plane` and `--xeplr-*` tokens (`--xeplr-accent`, `--xeplr-accent-soft`, `--xeplr-text`, `--xeplr-text-secondary`, `--xeplr-muted-2`, `--xeplr-hover`, `--xeplr-border-secondary`, `--xeplr-border-strong`, `--xeplr-input-bg`, `--xeplr-input-border`, `--xeplr-input-text`, `--xeplr-tag-bg`, `--xeplr-tag-text`, `--xeplr-success`, `--xeplr-warning`, `--xeplr-danger`, `--xeplr-error`, `--xeplr-status-good`, `--xeplr-status-warn`, `--xeplr-status-critical` and their `-soft` variants), each with a fallback. Class names are prefixed `jb-` (page) and `csf-` (cron field).

## Tests

```sh
npm test
```

Plain Node scripts, no framework (`test/run.mjs` runs each `*.test.*` file): job state, `describeCron`, next-run and duration labels, latest run per job, search and sort.

## License

MIT
