# HackTrack project notes

- npm workspaces: `client/` (React + Vite + React Router 8 + Tailwind 4) and `server/` (Express 5 + MongoDB driver, run with tsx).
- `npm run dev` starts both; Vite proxies `/api` to Express on port 4000. Env vars live in the root `.env.local` and are loaded only by the server (`server/src/env.ts`).
- The server imports `HackathonView` from `client/src/lib/types.ts` as a type only; keep that file free of runtime code the server would need.
- Server code uses NodeNext module resolution, so relative imports need `.js` extensions.
- Design tokens (colors, fonts, `.btn`, `.field`) are defined in `client/src/index.css`; use them instead of raw Tailwind colors.
- Check with `npm run typecheck` and `npm run lint`.
