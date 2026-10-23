# Stakeholder demo checklist (PRD §27)

**Scenario:** the marketing team needs an image for a new campaign about setting up a business in Dubai.

## Before the meeting
- [ ] Settings shows **AI images: Connected** and **Image storage: Connected**. The header says "Connected".
- [ ] Usage today has room for at least 4 requests: 1 generate and 1 edit, plus one spare of each.
- [ ] Each AI step takes about a minute and uses Curvet credits. Check the balance in Settings. Plan to talk through the waiting screen; it shows a timer and a Cancel button.

## Step 1: Search existing images
- [ ] Open **Image Library** and type **Dubai business**. Previously used Dubai photos appear (DIFC, DWTC, Sheikh Zayed Road and others).
- [ ] Open one to show its details: size, format, tags, source, date. Then **Download** it as PNG or JPG.

## Step 2: Generate a new image
- [ ] Go to **Generate Image** and choose the **Corporate Photography** guideline.
- [ ] Enter: *"Create a premium realistic image of a professional entrepreneur standing inside a modern Dubai office, with soft natural lighting and empty space on the left."*
- [ ] Optional: open **See the full prompt** to show how the guideline and Arnifi rules are added.
- [ ] Click **Generate Image** and show the real result.
- [ ] Click **Save to Library**, with category *Campaigns* and tags *Dubai, business setup*.

## Step 3: Edit the image
- [ ] Click **Edit** on the result.
- [ ] Enter: *"Make the background slightly brighter and more minimal. Keep the entrepreneur and overall composition as similar as possible."*
- [ ] Click **Apply Changes**.

## Step 4: Compare
- [ ] The original and the edited version show side by side. Point out that the original is untouched.
- [ ] Mention the on-screen note: AI edits can shift small details, so exact text and logos belong in the Marketing Studio.

## Step 5: Save to Library
- [ ] Click **Save Edited Version**, then **View in Library**.
- [ ] Show the saved details: name, category, prompt (edit instructions), source "AI edited", date, and **Related versions** (v1 Original → v2 Edited).

## Step 6: Download
- [ ] Click **Download** → **PNG**.

## Key message
> "Arnifi Image Studio brings image discovery, AI generation, editing, and brand-specific prompt guidelines into one workspace. Teams can create and reuse consistent visual assets more easily, reducing repetitive work and tool switching."

## If something goes wrong
- **"AI isn't connected"**: `CURVET_API_KEY` is missing or wrong in Vercel. See `docs/live-site.md`.
- **"run out of credits"**: top up the Curvet balance. Have a result saved from a rehearsal as a backup.
- **"Saving isn't set up yet"**: the Firebase key isn't in `~/.config/arnifi-image-studio/`. See README → Connect storage.
