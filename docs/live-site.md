# The live site (Vercel) and the helper Mac

**Live site:** https://arnifi-ai-image.vercel.app

## Why the live site needs a helper Mac

The website runs on Vercel's servers. Vercel can't run the Codex app, and it can't use anyone's "Sign in with ChatGPT". Running `codex login` on your own laptop doesn't change that, which is why the live site said "AI not connected".

So the live site **queues** each image request in Firestore. A **helper Mac**, one Mac that is signed in to Codex with your ChatGPT plan, picks the requests up, makes the images, and sends them back. Everyone with the link gets real AI images, and nobody else installs anything.

```
Stakeholder's browser ──► arnifi-ai-image.vercel.app ──► Firestore queue ◄── helper Mac (Codex + ChatGPT plan)
                          (passcode)                     (images, details)    makes the image, sends it back
```

---

## One-time setup (you)

### 1. Get the Firebase key
1. Open https://console.firebase.google.com/project/arnifi-image-studio/settings/serviceaccounts/adminsdk
2. Click **Generate new private key** → **Generate key**. A `.json` file downloads.
3. Rename it to `firebase-sa.json` and move it to `~/.config/arnifi-image-studio/`. In Finder, press ⌘⇧G and paste that path. The helper Mac uses this file.

### 2. Add three settings in Vercel
In vercel.com, open this project → **Settings** → **Environment Variables**. Add these for **Production**:

| Name | Value |
|---|---|
| `STUDIO_PASSCODE` | A passcode you choose. Share it with the team. **Required:** without it, the site shows a setup page |
| `FIREBASE_SERVICE_ACCOUNT` | The *contents* of `firebase-sa.json`. Open the file in TextEdit, press ⌘A, ⌘C, then paste it here |
| `IMAGE_PROVIDER` | Leave it out. On Vercel, the studio uses the helper Mac automatically |

Then go to **Deployments** → ⋯ on the latest deployment → **Redeploy**.

### 3. Fill the library (once)
In Terminal, in the project folder, run `npm run seed`. This copies the 24 starting photos into Firestore, so the live site shows them too.

### 4. Start the helper
On the Mac that's signed in to Codex, double-click **`Start Image Studio Helper.command`** in the project folder. Terminal opens and says **"✓ Helper is running"**.

Open the live site → **Settings**. "AI images" should say **Connected — Images are made by the helper Mac "<your Mac's name>"**.

---

## Every day

- **Keep the helper running** while people need Generate or Edit:
  - Leave the Terminal window open.
  - Keep the Mac on power and on the internet.
  - The helper stops the Mac from going to sleep while it runs. Closing the lid still makes most Macs sleep.
- **Without the helper,** browsing, searching and downloading still work. Generate and Edit say "the helper Mac is offline" instead of failing silently.
- **One image at a time,** about 1–2 minutes each. ChatGPT plan limits apply to the whole team, because everyone shares this Mac's plan.

## For stakeholders (nothing to install)

1. Open **https://arnifi-ai-image.vercel.app** on any laptop or browser, including incognito.
2. Enter the passcode.
3. Use the library, generate, edit and download.

---

## If something's wrong

| What you see | What to do |
|---|---|
| "One step before this site opens" | `STUDIO_PASSCODE` isn't set in Vercel. Add it, then redeploy |
| Settings → Image storage "Not set up" | `FIREBASE_SERVICE_ACCOUNT` is missing or isn't the whole file. Paste it again, then redeploy |
| "No helper Mac has connected yet" / "is offline" | Start `Start Image Studio Helper.command` on the helper Mac |
| "The helper Mac is running, but: Codex isn't signed in" | On that Mac, run `codex login` and choose "Sign in with ChatGPT" |
| "Image limit reached for now" | The ChatGPT plan's limit. The message says when to try again |

## Alternative: no helper Mac

If keeping a Mac on isn't practical, the live site can make images on its own with an OpenAI API key, billed per image:
1. Add `IMAGE_PROVIDER=openai` and `OPENAI_API_KEY` in Vercel.
2. Ask for this change: the website would then run requests itself, so its queue needs a small update before this works on Vercel.
