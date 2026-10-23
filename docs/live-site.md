# The live site (Vercel)

**Live site:** https://arnifi-ai-image.vercel.app. Share this link and the passcode. Nobody installs anything, and no computer needs to stay on.

## How images are made

```
Browser ──► arnifi-ai-image.vercel.app (passcode) ──► Curvet API ──► OpenAI GPT Image model
                     │                                    (your Curvet key and balance)
                     └── Firestore: library, image files, request status
```

The website's own server, on Vercel, sends each request to **Curvet** with the studio's API key. Curvet runs it on OpenAI's **GPT Image** model (`gpt-image-2` by default). The server downloads the result and stores it in Firestore. Each image is paid from your **Curvet balance**.

## Settings in Vercel (Production)

| Name | What it is |
|---|---|
| `STUDIO_PASSCODE` | The passcode people type to open the site. Required |
| `FIREBASE_SERVICE_ACCOUNT` | The contents of the Firebase key file. It holds the library and images |
| `CURVET_API_KEY` | Your Curvet app key, with the **Image** category on. It makes the images |
| `CURVET_IMAGE_MODEL` | Optional. A different GPT image model id from Curvet's list |

After changing any setting: **Deployments → ⋯ → Redeploy**. Settings only apply to new deployments.

## Costs and limits

- Each generate or edit request uses Curvet credits, including requests that fail.
- The studio also has its own caps: 40 requests a day for everyone and 15 an hour per browser. Change them with `MAX_IMAGE_REQUESTS_PER_DAY` and `MAX_REQUESTS_PER_SESSION_PER_HOUR`.
- You can add a cap on the key itself in Curvet: API Keys → the key → "Set a request limit".
- Settings → "AI images" shows the current Curvet balance.

## If something's wrong

| What you see | What to do |
|---|---|
| "One step before this site opens" | Set `STUDIO_PASSCODE` in Vercel, then redeploy |
| Settings → Image storage "Not set up" | `FIREBASE_SERVICE_ACCOUNT` is missing or isn't the whole file. Paste it again, then redeploy |
| "No Curvet API key is set up" | Add `CURVET_API_KEY` in Vercel, then redeploy |
| "The Curvet API key was rejected" | Create a new key in Curvet (Image category on) and update `CURVET_API_KEY` |
| "run out of credits" | Top up the Curvet balance |
| "isn't allowed to use the image model" | In Curvet, edit the key so the Image category (and the model) is allowed |
