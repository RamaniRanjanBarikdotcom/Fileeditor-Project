# Approved Cleanup Manifest — 2026-09-03

Scope: remove the superseded Vite/React Router frontend after the Next.js App Router replacement passed its production build.

Authorization: the project owner requested removal of unnecessary code/files and completion of all pending cleanup work.

## Equivalence evidence before deletion

- `corepack pnpm run node:build` passed and generated all 29 Next.js routes.
- `rg` found no imports from active Next.js source into `src/App.tsx`, `src/main.tsx`, `src/views/*`, or `src/components/Layout.tsx`.
- The legacy files depend on `react-router-dom` and Vite; the active application uses Next.js routes.

## Files approved for removal

- `apps/web/index.html`
- `apps/web/vite.config.ts`
- `apps/web/tsconfig.app.json`
- `apps/web/tsconfig.node.json`
- `apps/web/src/main.tsx`
- `apps/web/src/App.tsx`
- `apps/web/src/App.css`
- `apps/web/src/vite-env.d.ts`
- `apps/web/src/views/Auth.tsx`
- `apps/web/src/views/Dashboard.tsx`
- `apps/web/src/views/Editor.tsx`
- `apps/web/src/views/History.tsx`
- `apps/web/src/views/Settings.tsx`
- `apps/web/src/components/Layout.tsx`
- `apps/web/src/assets/react.svg`
- `apps/web/src/assets/vite.svg`

## Dependencies/scripts approved for removal

- `react-router-dom`
- `@tailwindcss/vite`
- `@vitejs/plugin-react`
- `vite`
- `dev:vite`
- `build:vite`

## Required post-cleanup gates

1. Refresh `pnpm-lock.yaml`.
2. Run the production build.
3. Run self-contained tests.
4. Run `git diff --check`.
5. Record results in `PROJECT_EXECUTION_MEMORY.md`.
