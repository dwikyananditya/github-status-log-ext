# GH Status Log

Ekstensi browser untuk mencatat perubahan status project issue GitHub per anggota team.

## Setup

```sh
npm install
cp .env.example .env   # isi VITE_SUPABASE_URL dan VITE_TEAM_TOKEN
npm run dev               # Chromium
npm run dev:firefox       # Firefox
```

## Build

```sh
npm run compile         # type check
npm run build           # Chromium
npm run build:firefox   # Firefox
npm run zip             # package .zip
```

## Struktur

- `entrypoints/` — background, content script, injected script
- `entrypoints/popup/` — UI popup (React + Tailwind)
- `supabase/functions/ingest/` — edge function penerima data
- `supabase/migrations/` — skema DB
