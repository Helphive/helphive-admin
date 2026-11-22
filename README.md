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

`.env` is ignored by git. The console reads three build-time variables and nothing else:

| Variable               | Purpose                                                                                                     |
| ---------------------- | ----------------------------------------------------------------------------------------------------------- |
| `VITE_APP_API_URL`     | Base URL of the HelpHive API, e.g. `https://api.helphive.himaiz.com` or `http://localhost:8080`.            |
| `VITE_APP_BUILD`       | Commit the build came from, shown in the account menu. The production build sets it; leave it out locally.  |
| `VITE_APP_STRIPE_MODE` | `live` makes Stripe links open the live dashboard. Unset means test mode, which is what the apps use today. |

Everything in a `VITE_` variable is shipped to every visitor's browser. Never put a secret in one.

The live API only accepts browser calls from the production sites, so a console on localhost needs a local API
(`http://localhost:8080`, started with `NODE_ENV=development`). If a local console is ever pointed at the live API, it
shows an amber **Local, live data** badge in the top bar and on the sign-in page.

## Scripts

| Script                            | Does                                      |
| --------------------------------- | ----------------------------------------- |
| `npm run dev`                     | Dev server with hot reload.               |
| `npm run build`                   | Type-checks, then builds to `dist/`.      |
| `npm run preview`                 | Serves `dist/` locally.                   |
| `npm run typecheck`               | `tsc -b`.                                 |
| `npm run lint` / `lint:fix`       | ESLint (flat config, `eslint.config.js`). |
| `npm run format` / `format:check` | Prettier over `src`.                      |

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

The shared infrastructure (API, Cloudflare zone, secrets, client attestation, data) is described in
[helphive-backend/docs/infrastructure.md](https://github.com/Helphive/helphive-backend/blob/main/docs/infrastructure.md).
The console's part, checked against the live setup on 2026-11-22:

- **Hosting:** Cloudflare Worker `helphive-admin`, serving static assets from `dist/` with a single-page-app fallback
  (`wrangler.jsonc`). `workers_dev` and preview URLs are off. The old Firebase Hosting site is disabled.
- **Domain:** `admin.helphive.himaiz.com`, a custom domain of the Worker in the shared Cloudflare zone `himaiz.com`.
- **CI:** `.github/workflows/lint.yml` runs on every pull request. It runs `npm ci`, applies lint and format fixes and
  pushes them to the PR branch, then fails on type errors (`npm run typecheck`), lint warnings or formatting.
- **CD:** Cloudflare Workers Builds deploys every push to `main`:

    | Setting         | Value                                                                                            |
    | --------------- | ------------------------------------------------------------------------------------------------ |
    | Branch          | `main` (preview builds off)                                                                      |
    | Root directory  | `/`                                                                                              |
    | Watch paths     | `*` (every change)                                                                               |
    | Build command   | `VITE_APP_BUILD=$WORKERS_CI_COMMIT_SHA npm run build`                                            |
    | Deploy command  | `npx wrangler deploy`                                                                            |
    | Build variables | `NODE_VERSION` (22.12.0), `VITE_APP_API_URL`, `SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK` (1) |

    `SWC_NATIVE_BINDING_CACHE_SKIP_SECURITY_CHECK=1` is needed because `@swc/core` 1.16.13 and later refuses the build
    image's cache folders and fails with "Failed to load native binding". Builds started by hand rather than by a push
    have no commit SHA, so they show the build as `local`. Build logs are in the Worker's Deployments tab. There are no
    manual deploy steps and no preview deployments: the live API only accepts the production origins.

- **Rollback:** roll back to an earlier version in the Worker's Deployments tab (or `npx wrangler rollback`), or
  revert the commit on `main`.
- **Cloudflare:** the console is behind the shared `himaiz.com` zone WAF, whose rules are managed centrally in
  `maiznadeem/OracleVMOps`. It follows Pattern B for static sites: the security headers (CSP, HSTS, no framing) and
  caching are in `public/_headers`. The CSP's `script-src` holds the hash of the inline colour-scheme script in
  `index.html`; update it whenever that script changes.
- **Secrets:** none. The console holds only public build values; GitHub Actions secrets aren't used.
- **Access:** admins sign in with a password and two-step verification (`POST /admin/login`). Client attestation
  doesn't apply to the console. The API allows its origin through `ADMIN_CONSOLE_ORIGINS`.
- **Data:** none of its own. Everything goes through the API's `/admin` routes; provider documents open through
  short-lived signed Cloud Storage URLs.
