# UniVybe Creation User Portal

Responsive React/TypeScript portal for admins, educators, tutors, contributors and moderators. It uses the existing Laravel API and Sanctum bearer tokens. No replacement backend or production fixture data is included.

## Local setup

Use Node **24.x** and npm **11.x** (verified with Node 24.15.0 / npm 11.12.1). Exact dependency versions are pinned in package.json and package-lock.json.

```powershell
npm ci
# Only if .env does not already exist:
Copy-Item .env.example .env
npm run dev
```

The existing `.env` is preserved. Set `VITE_API_URL` to the complete API root, currently `http://127.0.0.1:8000/api/v1`. Vite prints the actual development URL, normally `http://localhost:5173`. Keep Laravel running separately. Its CORS configuration must permit the frontend origin. `VITE_API_BASE_URL` is accepted as a compatibility alias; `VITE_API_URL` takes precedence. Optional `VITE_STUDENT_PORTAL_URL` supports links to the public student portal. All VITE variables are public; never put credentials or signing secrets in them. Production API configuration requires HTTPS outside local development.

Sign in using an existing account. Credentials are deliberately absent from source, examples and fixtures. Tokens are held in sessionStorage for the current tab; they are treated as opaque Sanctum tokens. Logout/401 clears private query data, and obsolete session responses cannot restore it.

## Application

Feature folders implement authentication/OTP/onboarding, restricted account states, profile/security, course content authoring and preview, resource attachment and direct uploads, opportunity drafts and lifecycle, feed moderation, administration, coins, analytics, reports and search. Creators browse cards; admins operate tables. Forms retain failed drafts, expose indexed validation errors and guard unsaved navigation. Course publication submits to review. Resource rejection and opportunity rejection use their separate workflows.

Cloudinary media signing/upload/registration is separate from R2 resource upload authorization/direct PUT/token registration. No bearer token is attached to third-party storage requests. Payouts are manual: the portal records confirmed outcomes against server snapshots. Report download responses are displayed as metadata, never represented as a ready file.

Architecture: `src/app` for router/providers/config; `src/shared` for transport/session/forms/uploads/UI; `src/features` for domain workflows. Tiptap, charts and route screens are lazy loaded. Tailwind v4 supplies semantic CSS tokens; supplied UniVybe wordmarks and artwork are included. Final student-brand reconciliation remains outstanding.

## Verification

```powershell
npm run typecheck
npm run lint
npm run test:run
npm run test:e2e
npm run build
npm run preview
```

Playwright uses installed Microsoft Edge on Windows. On Linux, install its Chromium browser with `npx playwright install --with-deps chromium`. Browser fixtures intercept requests only inside tests; the application always uses configured APIs. CI repeats a clean install and the checks. `tests/live-smoke.mjs` is an opt-in read-only authenticated smoke test against local port 5173; set `PORTAL_SMOKE_EMAIL` and `PORTAL_SMOKE_PASSWORD` in the process environment and clear them after use. It writes ignored local screenshots to `docs/qa`.

Verified on 2 October 2026: typecheck, lint, unit/contract tests, browser behavior tests and production build; local admin login/session/logout, management reads, and desktop/mobile dashboard inspection. Live mutations, OTP delivery and storage transfers need controlled accounts/records. See the implementation status for the precise boundary. The build currently reports one initial bundle size warning; deployment/performance validation has not been performed.

## Known dependencies

The local Laravel database has no `opportunities` table; both management lists return 500. The frontend shows the error, and opportunity behavior is verified with isolated fixtures. Backend migrations must be handled by its owner. This project did not write to `edu-lift`.

Private resource/credential retrieval, password recovery and a complete privileged role lookup have missing API contracts. Quiz blank/tap grading conventions are not supplied; the portal stores documented authoring fields and offers presentation/answer inspection without fabricated grading. Storage CORS/provider setup and multi-role mutation validation remain external integration work.

- [Persistent implementation and verification checklist](docs/implementation-status.md)
- [Contract decisions and unresolved contracts](docs/api-contract-notes.md)
- [Backend concerns for the owner](docs/backend-concerns.md)

Nothing has been deployed, and no course approval, financial outcome, migration or content deletion was performed during live verification.
