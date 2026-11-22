# HelpHive Console

The internal operations console for HelpHive. Today it reviews provider applications and shows an
overview of onboarding; later phases add analytics, observability, risk, finance and support on the
same shell.

Built with Vite, React 18, TypeScript (strict), MUI 6, React Router 6, Redux Toolkit with RTK Query,
TanStack Table and Apache ECharts. It shares the "Direction B" design system with the customer web
app (`helphive-web`); the theme and primitives are copied into `src/theme` and `src/components/ui`.

## Run it

Node version: see `.nvmrc`.

```bash
npm install
cp .env.example .env      # then set VITE_APP_API_URL
npm run dev               # http://localhost:3001
```

`.env` is ignored by git. The console reads two build-time variables and nothing else:

| Variable | Purpose |
|---|---|
| `VITE_APP_API_URL` | Base URL of the HelpHive API, e.g. `https://api.helphive.himaiz.com` or `http://localhost:8080`. |
| `VITE_APP_BUILD` | Commit the build came from, shown in the account menu. CI sets it; leave it out locally. |

Everything in a `VITE_` variable is shipped to every visitor's browser. Never put a secret in one.

A console running on localhost against the live API shows an amber **Local, live data** badge in
the top bar and on the sign-in page. Decisions made there are real.

## Scripts

| Script | Does |
|---|---|
| `npm run dev` | Dev server with hot reload. |
| `npm run build` | Type-checks, then builds to `dist/`. |
| `npm run preview` | Serves `dist/` locally. |
| `npm run typecheck` | `tsc -b`. |
| `npm run lint` / `lint:fix` | ESLint (flat config, `eslint.config.js`). |
| `npm run format` / `format:check` | Prettier over `src`. |

A husky pre-commit hook runs lint-staged (Prettier, then ESLint with no warnings allowed) on staged
files.

## Layout

```
src/
  app/          store, router, navigation registry
  components/
    ui/         design-system primitives (Panel, PageHeader, StatusPill, KeyValue, icons, ...)
    data/       DataTable, FilterBar, SearchField, DateRangeField, KpiTile/KpiRow
    charts/     ECharts wrapper and TimeSeries, Bar, Donut, Heatmap charts
    detail/     DetailLayout, Timeline, JsonView, DiffView, DocumentViewer
    feedback/   toasts
  features/
    auth/       session token module, guards, sign-in, permissions
    shell/      console layout, navigation, top bar, breadcrumbs, command palette
    overview/   landing page
    applications/  provider application queue, history, detail and decisions
    system/     not-found and route error pages
  lib/          API base query, env, formatting, CSV, URL safety, hooks
  theme/        tokens and MUI theme
```

The full guide to adding a section and using each building block lives with the team's working
notes (`scratch/admin/console-guide.md` in the HelpHive workspace).

## Sign-in and sessions

`POST /admin/login` returns a bearer token, kept by `src/features/auth/session.ts` (the only module
that touches it). On load, a stored token is confirmed with `GET /admin/account` before anything
protected renders. A 401 or 403 from any call ends the session and returns to sign-in with a
message. The base query already calls `refreshSession()` once before giving up, so short-lived
tokens with a refresh step only need that function filled in.

Permissions: pages ask `can('applications.decide')`, never about roles. Roles map to permissions in
`src/features/auth/permissions.ts`; every role has every permission until the API defines roles.

## Deployment

Cloudflare Workers static assets: Worker `helphive-admin` on `admin.helphive.himaiz.com` (`wrangler.jsonc`), with a
single-page-app fallback. Security headers (CSP, HSTS, no framing) and caching are in `public/_headers`. The old
Firebase Hosting site is disabled.

- Deploy: every push to `main` builds and deploys through Cloudflare Workers Builds (build
  `VITE_APP_BUILD=$WORKERS_CI_COMMIT_SHA npm run build`, deploy `npx wrangler deploy`; `VITE_APP_API_URL` and
  `NODE_VERSION` are build variables on the Worker, plus `SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK=1`, because
  `@swc/core` 1.16.13+ refuses the build image's cache folders otherwise). Build logs are under the Worker's
  Deployments tab.
- `.github/workflows/lint.yml`: on pull requests, applies lint and format fixes, pushes them, then
  fails on type errors, lint warnings or formatting.

There are no preview deployments: the live API only accepts the production origins.
