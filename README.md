# Arnifi Image Studio

One place to **find, generate, edit and reuse Arnifi images**. Built from the PRD (`docs/PRD.md`) using the Arnifi Design System.

| Module | What it does |
|---|---|
| **Image Library** | Search by words ("Dubai business"), filter by category and source, preview, download as PNG or JPG, upload, edit an image's details, see its versions |
| **Generate Image** | Describe an image, optionally pick an Arnifi guideline, choose a shape, and get a real AI image. Save it, download it, edit it, or make a variation |
| **Edit Image** | Upload or pick an image, describe a change, and compare before and after side by side. Keep refining, then save the result as a new version. The original is never changed |
| **Prompt Library** | Nine ready-made guidelines. Read one, try it with your brief, copy the exact prompt, or use it. Guidelines can be edited and reset |
| **Settings** | Shows whether AI and storage are connected, today's usage, and step-by-step fixes |

---

## Start it

**Easiest:** double-click **`Start Image Studio.command`** in this folder. It prepares the app (about a minute), then opens <http://127.0.0.1:3109>. Keep that Terminal window open while you work; close it to stop the studio.

**From Terminal** (in this folder):

```sh
export PATH="/opt/homebrew/opt/node@22/bin:$PATH"   # this Mac's working Node.js
npm install                                         # first time only
npm run dev                                         # http://127.0.0.1:3109
```

`npm run dev:emulator` runs the app against a **local test database** instead of the real one. It starts empty; run `FIRESTORE_EMULATOR_HOST=127.0.0.1:8181 npm run seed` in a second window to add the starting photos.

On a Mac, the studio only accepts connections from that Mac (127.0.0.1). The live site is behind a passcode.

---

## What it needs (credentials and setup)

| Thing | Status | How |
|---|---|---|
| **AI images: Curvet (GPT Image)** | Needs the key | The server calls the Curvet API with your app key (Image category). The model is OpenAI's `gpt-image-2`, which you can change with `CURVET_IMAGE_MODEL`. Paid from your Curvet balance. No computer has to stay on |
| **Storage: Firestore** | ⚠️ Needs one step | The Firebase project **`arnifi-image-studio`** exists, with its database (Doha region, `me-central1`). Its security rules block all direct access, and only this app's server can read or write. The one missing piece is the key file, below |
| **Starting photos** | ✅ Ready | 24 text-free Arnifi photos listed in `seed/manifest.json`. They're read from their original folders and never moved |

### Connect storage (one time)

1. Open <https://console.firebase.google.com/project/arnifi-image-studio/settings/serviceaccounts/adminsdk>
2. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
3. Rename it to `firebase-sa.json` and move it to `~/.config/arnifi-image-studio/`. In Finder, press ⌘⇧G and paste that path.
4. In Terminal, in this folder, run `npm run seed`. This copies the 24 starting photos into the library, once.
5. Restart the studio.

Until the key is there, the library shows the starting photos as **"Demo fixtures — not saved"**. Uploading and saving explain that setup is needed. Nothing pretends to save.

**Never** paste the key into chat, email or this folder. `.env.local` only holds the *path* to the key. Both `.env*` and `*-sa.json` are git-ignored.

---

## How it works (plain version)

- **Everything lives in Firestore.**
  - Image details go in `images`.
  - The files themselves are split into pieces of 900 KB or less, in `blobs/…/chunks`, and checked with a fingerprint (SHA-256) when read back. Thumbnails go in `thumbs`.
  - Guideline edits go in `promptTemplates`, request history in `jobs`, and daily usage in `usage`.
  - This stays on Firebase's free plan: about 1 GB in total (roughly 300–500 images), 50,000 reads and 20,000 writes a day.
- **AI requests** go from the studio's server to Curvet (GPT Image), never from the browser. Each one takes about a minute. You can leave the page; it keeps going.
- **Honest options.** Shapes come out at exact sizes: 1024 × 1024, 1024 × 1536 or 1536 × 1024. Quality and transparent backgrounds aren't available through Curvet yet, so they're shown as unavailable rather than as switches that do nothing.
- **Prompts** are built in this order:
  1. Your words, which always win.
  2. The guideline, if you picked one. Empty fill-in fields follow your words.
  3. Arnifi visual rules, if switched on. The no-text rule drops out when you ask for text.

  "See the full prompt" and "Copy Prompt" show exactly what is sent.
- **Versions.** Saving an edit creates a new image with a new id. It links to its parent and gets the next version number, and the original stays exactly as it was. If you edit an unsaved upload or a fresh generation, the original is saved too, as version 1.
- **Unsaved results** stay on this Mac for 24 hours in `.data/drafts`, then are removed.
- **Safeguards:**
  - One request at a time per browser; double-clicks don't send twice.
  - 15 requests an hour per browser and 40 a day for the whole studio. Change these in `.env.local`.
  - Uploads must be PNG, JPG or WebP, under 10 MB and 40 MP, checked by their real contents.
  - Optional passcode: set `STUDIO_PASSCODE` in `.env.local`.

---

## Tests (all passing on 23 Oct 2026)

| Command | What it checks | Result |
|---|---|---|
| `npm run typecheck` / `npm run lint` | Code correctness and style | Clean |
| `npm test` | 46 unit tests: prompt building, validation, file checks, metadata, versions, search, file chunks, Curvet requests and error handling, limits, demo fixtures, live-site mode, key-from-setting | 46 passed |
| `npm run test:integration` | 25 tests of the real API routes against a local Firestore. Covers upload, search, download (PNG keeps transparency, JPG turns it white, no resizing), generate, save, edit chains, versions, duplicate and limit guards, failures and guideline edits. Also covers **live-site mode**: the server makes the image, cancel, picking up orphaned requests, uploads in pieces, and every server seeing new images | 25 passed |
| `npm run test:e2e` | 6 browser journeys (PRD §25 A–E plus error states and a phone-width check) on a production build with the test provider | 6 passed |
| `npm run test:live` | **Real** Curvet: one generation and one edit (costs the credits for 2 images) | See below |
| `npm run build` | Production build | Passes |

**Real-provider check:** see the latest live Curvet run noted at the end of this README.

Automated tests use a **test provider** that draws plain test patterns. It only switches on with `STUDIO_TEST_MODE=1`, and the header then shows a "Test provider" badge, so test images can never pass for AI results.

---

## The live site (Vercel)

**https://arnifi-ai-image.vercel.app**: stakeholders open the link and enter the passcode. Nothing to install, and no computer needs to stay on.

The website's server sends each request to Curvet (GPT Image) and stores the result in Firestore. The settings, costs and troubleshooting are in [`docs/live-site.md`](docs/live-site.md).

On Vercel, each request can reach a different server, so the live site works a little differently from the Mac version:
- Requests and unsaved results are kept in Firestore.
- Each image is made by the server that received the request, after it has answered. It gets up to 5 minutes.
- Uploads over 4 MB are sent in pieces, and downloads over 4 MB are streamed, because of Vercel's 4.5 MB limit.
- A passcode is required.

## Known limitations

- **Edits aren't pixel-perfect.** The AI redraws the picture, and small details can shift. Text inside images isn't editable lettering. The editor says this on screen.
- **Curvet limits.** Curvet's own rate limits and your balance apply. When hit, the app says so and when to try again, if Curvet reports it.
- **Every request costs Curvet credits**, including failed ones. The studio's daily and hourly caps limit the spend.
- **Search size.** Search reads all image details into memory. That's fine for hundreds or a few thousand images, but a larger library would need a search index.
- **No deleting from the UI.** Images can't be deleted yet; this isn't required by the PRD.
- **P1 features not built:** favourites, collections, masks, batch generation, text overlays, bulk download, multiple providers in the UI.
- **Rights.** The 24 starting photos come from the Arnifi listing-card archive. Their original source and rights weren't verified; the attribution field says where they came from.
- **Light theme only.** It's an internal desktop tool, and the Design System file has no dark screens.
- **Browsers.** Tested in Chrome on macOS. Safari and Edge are not yet checked.

---

## Decisions (from the PRD and your answers)

- **AI:** the Curvet API with a GPT image model. This replaced the first approach, ChatGPT via Codex plus a helper Mac, so that no computer has to stay on.
- **Storage:** everything in Firestore, files included, in a new dedicated Firebase project.
- **Seed:** 24 clean Arnifi photos. I left out the licence mock-ups, because they have text and third-party logos baked in.
- **Design:** the Arnifi Design System tokens and components, copied from the DesignSync QA build:
  - Lora for page titles, Inter for everything else.
  - Arnique-900 primary buttons with the arrow segment, field anatomy label → field → helper.
- **Stack:** Next.js 16 + React 19 + TypeScript, Tailwind 4 with DS tokens, Zustand, Zod, sharp, firebase-admin, Vitest, Playwright.

## Folder map

```
src/app/              screens (library, generate, edit, prompts, settings) and api/ routes
src/features/         the four modules' UI
src/components/       shared UI (Design System parts, header, dialogs)
src/lib/ai/           image providers: curvetProvider (GPT Image via Curvet), mockProvider (tests)
src/lib/database/     Firestore: images, guidelines, jobs, demo fixtures
src/lib/storage/      file chunks in Firestore, unsaved drafts on disk
src/lib/prompts/      prompt composer
src/lib/jobs/         request queue
src/data/             the 9 guidelines, Arnifi visual rules, categories
seed/manifest.json    the 24 starting photos
docs/                 PRD text, demo checklist
tests/                unit, integration (emulator), e2e (Playwright)
```
