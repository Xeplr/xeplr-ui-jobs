# @xeplr/ui-jobs

**The screens for [`@xeplr/jobs`](https://www.npmjs.com/package/@xeplr/jobs).** Create a job, schedule it with cron, run it now, pause and resume it, and watch its occurrences and logs. It ships as React routes your app registers, or as a small standalone app.

(The package name on npm is `@xeplr/ui-jobs` — the GitHub repo and folder are named `xeplr-ui-jobs`.)

## Why

Jobs is a product: a scheduler, an HTTP API **and** the screens for both. Without this package, every app that wanted to schedule something rebuilt those screens itself, and each copy drifted from the backend it talked to.

So the UI belongs to the jobs product, and a host supplies only the **infrastructure** it already has: the router, the auth gate, the layout. That is the same split the backend makes — `registerJobs()` mounts into an Express app you already have, or stands up its own.

## Install

```sh
npm i @xeplr/ui-jobs
```

Peer dependencies: `react ^18 || ^19`, `react-router-dom ^6 || ^7`, `@xeplr/ui-account` (authenticated requests) and `@xeplr/ui-utils` (confirm dialogs and snackbars).

Your bundler must compile JSX and import CSS from the package (Vite does both out of the box).

The backend is [`@xeplr/jobs`](https://www.npmjs.com/package/@xeplr/jobs). By default the screens call its routes at your API root: `/jobs`, `/job-occurrences` and `/actions`.

## Embed it in your app

```jsx
import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { AccessProvider } from '@xeplr/ui-account'
import { registerJobsUI } from '@xeplr/ui-jobs'

const jobs = registerJobsUI({ basePath: '/workspace' })   // → /workspace/jobs

export function App() {
  return (
    <BrowserRouter>
      <AccessProvider>
        <Routes>
          {/* ...your routes... */}
          {jobs.routes}
        </Routes>
      </AccessProvider>
    </BrowserRouter>
  )
}

// Point your own navigation at the same path instead of retyping it:
// <Link to={jobs.path}>Jobs</Link>
```

There is no embedded/standalone switch. `registerJobsUI()` returns `<Route>` elements; what differs is who wraps them.

## `registerJobsUI(config)`

| option | type | default | notes |
|---|---|---|---|
| `basePath` | string | `''` | prefix for the jobs page path, e.g. `'/workspace'` → `/workspace/jobs` |
| `apiBase` | string | `''` | prefix for API calls, if you mounted the jobs router somewhere other than the root |
| `optionSources` | object | — | where a *kind* of thing is listed, for action inputs that declare `optionsFrom` (see below) |
| `breadcrumb` | component | — | your breadcrumb, rendered above the page |
| `uploadLink` | element \| string | — | a link to wherever your app loads files, shown in the empty state |
| `connectLink` | element | — | a link to a workflow canvas, for starting one job when another finishes |

Returns `{ routes, path }`.

### Option sources

An action input can say it wants a choice from a kind of thing — `optionsFrom: 'connections'`. This package never learns what a connection is; your app says once where each kind is listed:

```js
registerJobsUI({
  optionSources: {
    connections: { url: '/connectioninfo', label: 'label' },
    databases:   { url: '/databases', label: 'name' }
  }
})
```

A kind with no source gets a plain text input. Standalone, with no catalogue to pick from, a text box is the right answer; an empty dropdown would look broken.

## Other exports

| export | what |
|---|---|
| `CronScheduleField` | the cron input with presets and a plain-English reading — `<CronScheduleField value={cron} onChange={setCron} />` |
| `CRON_PRESETS` | the presets it offers |
| `describeCron(expr)` | a cron expression as a sentence — `'*/15 * * * *'` → "Every 15 minutes", `'0 0 1 * *'` → "Monthly on day 1 at 00:00"; `null` for a pattern it has no sentence for |
| `jobsRoutes` | `{ jobs(base) }` — the page path, for building links |

## Run it standalone

```sh
npm install
npm run dev            # http://localhost:19004 — set API_URL, AUTH_URL, UI_PORT in .env to change
```

`dev/` holds the standalone shell: login screens from `@xeplr/ui-account`, an auth gate, and one call to `registerJobsUI({})`, the same call a host makes. `vite.config.js` proxies the API paths to `API_URL` (default `http://localhost:19003`). None of `dev/` is published.

## Theming

Styles use the xeplr theme variables — `--accent`, `--surface`, `--ink`, `--muted`, `--hair`, `--plane` and the `--xeplr-*` status, tag and input colours. Each has a light-theme fallback, so the screens look right in an app that defines none of them. Define them to restyle.

## Files

```
src/
  index.jsx                  ─ registerJobsUI and the public exports
  routes.js                  ─ page paths
  api/jobs.js                ─ API calls, option sources
  pages/Jobs.jsx · Jobs.css  ─ the jobs screen
  pages/jobsList.js          ─ pure: job state, cron descriptions, next run, durations
  pages/relativeTime.js      ─ pure: "3 minutes ago"
  components/CronScheduleField.jsx · .css
dev/                         ─ standalone app shell (not published)
test/                        ─ plain Node scripts, no framework
```

## Tests

```sh
npm test
```

## License

MIT
