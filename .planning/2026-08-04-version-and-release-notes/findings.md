# Findings

- Documentation is loaded from `src/docs/*.md`, sorted by front matter `order`.
- `package.json` supplies `__APP_VERSION__` through Vite; `public/sw.js` has a separate cache version.
- Current tracked version references are `0.1.0` in `package.json`, `package-lock.json`, and `public/sw.js`.
- Recent release-relevant commits on 2026-08-04 add AI image markers and history pagination, plus a fix for creating new API profiles.
