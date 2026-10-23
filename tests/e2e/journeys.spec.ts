import { expect, test, type Page } from "@playwright/test";
import sharp from "sharp";

/* PRD §25 end-to-end journeys, run with the test provider (its images are test patterns, labelled as such). */

const pngFile = async (name: string, w = 480, h = 320) => ({
  name,
  mimeType: "image/png",
  buffer: await sharp({ create: { width: w, height: h, channels: 3, background: { r: 120, g: 140, b: 200 } } }).png().toBuffer(),
});

async function downloadVia(page: Page, open: () => Promise<void>, format: "PNG" | "JPG") {
  const [download] = await Promise.all([page.waitForEvent("download"), (async () => {
    await open();
    await page.getByRole("menuitem", { name: new RegExp(`^${format}`) }).click();
  })()]);
  return download.suggestedFilename();
}

test("A — find an existing image: search, open, download", async ({ page }) => {
  await page.goto("/library");
  await expect(page.getByRole("heading", { name: "Image Library" })).toBeVisible();
  await expect(page.getByTestId("image-card")).toHaveCount(24);
  await page.getByLabel("Search images").fill("Dubai business");
  await expect(page).toHaveURL(/q=Dubai\+business/);
  await expect(page.getByText(/of 24 images/)).toBeVisible();
  await page.getByRole("link", { name: "DIFC Gate Building", exact: true }).click();
  await expect(page.getByRole("heading", { name: "DIFC Gate Building" })).toBeVisible();
  await expect(page.getByText("800 × 533 px")).toBeVisible();
  const name = await downloadVia(page, () => page.getByRole("button", { name: /Download/ }).click(), "PNG");
  expect(name).toBe("difc-gate-building.png");
});

test("B + E — generate with a guideline, save, and it survives a refresh", async ({ page }) => {
  await page.goto("/generate");
  await expect(page.getByText("Test provider")).toBeVisible();
  // Empty brief: nothing is sent, and the form explains why. (The button is aria-disabled but still clickable on
  // purpose, so it can explain; Playwright treats aria-disabled as disabled, hence force.)
  await page.getByRole("button", { name: /Generate Image/ }).last().click({ force: true });
  await expect(page.getByText("Describe the image first")).toBeVisible();

  await page.getByLabel("What image would you like to create?").fill("A founder signing documents in a bright Dubai office, empty space on the left.");
  await page.getByRole("button", { name: "No guideline — just my description" }).click();
  await page.getByRole("option", { name: /Corporate Photography/ }).click();
  await expect(page.getByTestId("selected-guideline")).toHaveText("Corporate Photography");
  await page.getByRole("button", { name: "See the full prompt" }).click();
  await expect(page.getByTestId("composed-prompt")).toContainText("STYLE GUIDELINE — Corporate Photography");

  await page.getByRole("button", { name: /Generate Image/ }).last().click();
  await expect(page.getByTestId("generating")).toBeVisible();
  await expect(page.getByTestId("generation-result")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText("384 × 256 px")).toBeVisible();

  await page.getByRole("button", { name: "Save to Library" }).click();
  await page.getByLabel("Title").fill("E2E Founder Signing");
  await page.getByLabel("Tags").fill("Dubai, founder");
  await page.getByRole("button", { name: "Save Image" }).click();
  await expect(page.getByText("Saved to the library")).toBeVisible();

  await page.goto("/library?q=E2E%20Founder");
  await page.reload();
  const card = page.getByTestId("image-card").filter({ hasText: "E2E Founder Signing" });
  await expect(card).toBeVisible();
  await expect(card.getByText("AI generated")).toBeVisible();
  await card.getByRole("link", { name: "E2E Founder Signing", exact: true }).click();
  await expect(page.getByText("Corporate Photography", { exact: true })).toBeVisible();
  await expect(page.getByText("A founder signing documents in a bright Dubai office")).toBeVisible();
});

test("C — edit an upload, compare, refine, download, save as a version", async ({ page }) => {
  await page.goto("/edit");
  await page.getByTestId("file-input").setInputFiles(await pngFile("meeting-room.png"));
  await expect(page.getByTestId("editor-source-title")).toHaveText("meeting room");
  await page.getByRole("button", { name: "Make the background lighter." }).click();
  await page.getByRole("button", { name: /Apply Changes/ }).click();
  await expect(page.getByTestId("edit-pending")).toBeVisible();
  await expect(page.locator('img[alt^="Edited:"]')).toBeVisible({ timeout: 20_000 });
  await expect(page.locator("figcaption", { hasText: "Original" })).toBeVisible();
  await expect(page.locator("figcaption", { hasText: "After" })).toBeVisible();

  const name = await downloadVia(page, () => page.getByRole("button", { name: /Download/ }).first().click(), "PNG");
  expect(name).toMatch(/\.png$/);

  // Refine the result further, then save; the original upload is saved alongside as v1.
  await page.getByLabel("Describe the change").fill("Add a soft morning light");
  await page.getByRole("button", { name: /Apply Changes/ }).click();
  await expect(page.getByText("Edit 2", { exact: false }).first()).toBeVisible();
  await expect(page.getByTestId("save-edit")).toBeVisible({ timeout: 20_000 });
  await page.getByTestId("save-edit").click();
  await expect(page.getByText(/original will be saved to the library too/)).toBeVisible();
  await page.getByRole("button", { name: "Save Image" }).click();
  await page.getByRole("link", { name: /Saved — View in Library/ }).click();
  await expect(page.getByText("Related versions")).toBeVisible();
  await expect(page.getByText("v1 · Original")).toBeVisible();
  await expect(page.getByText(/v2 · Edited/)).toBeVisible();
  await expect(page.getByText("Edit 1: Make the background lighter. → Edit 2: Add a soft morning light")).toBeVisible();
});

test("D — prompt guideline: read, customise, copy, use", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.goto("/prompts");
  await expect(page.getByTestId("prompt-card")).toHaveCount(9);
  await page.getByTestId("prompt-card").filter({ has: page.getByRole("heading", { name: "Business Setup", exact: true }) }).getByRole("button", { name: "View & Copy" }).click();
  await page.getByLabel("Try it: your brief").fill("A small business owner reviewing documents in Dubai");
  await page.getByLabel("Country").fill("the UAE");
  await expect(page.getByTestId("composed-prompt")).toContainText("A small business owner reviewing documents in Dubai");
  await expect(page.getByTestId("composed-prompt")).toContainText("in the UAE");
  await page.getByRole("button", { name: "Copy Prompt" }).click();
  expect(await page.evaluate(() => navigator.clipboard.readText())).toContain("STYLE GUIDELINE — Business Setup");
  await page.getByRole("button", { name: "Use Prompt" }).click();
  await expect(page).toHaveURL(/\/generate$/);
  await expect(page.getByTestId("selected-guideline")).toHaveText("Business Setup");
  await expect(page.getByLabel("What image would you like to create?")).toHaveValue("A small business owner reviewing documents in Dubai");
  // Remove the guideline: generation still works without one.
  await page.getByRole("button", { name: "Remove the Business Setup guideline" }).click();
  await expect(page.getByRole("button", { name: "No guideline — just my description" })).toBeVisible();
});

test("states — no results, bad upload, provider refusal", async ({ page }) => {
  await page.goto("/library?q=zzzz-nothing");
  await expect(page.getByText("No images match “zzzz-nothing”")).toBeVisible();
  await page.getByRole("button", { name: "Clear Search & Filters" }).click();
  await expect(page.getByTestId("image-card").first()).toBeVisible();

  await page.getByRole("button", { name: "Upload Image" }).first().click();
  await page.getByTestId("file-input").setInputFiles({ name: "anim.gif", mimeType: "image/gif", buffer: Buffer.from("GIF89a....") });
  await expect(page.getByRole("alert").filter({ hasText: "PNG, JPG or WebP" })).toBeVisible();
  // A file renamed to .png is still checked by its real contents on the server.
  await page.getByTestId("file-input").setInputFiles({ name: "fake.png", mimeType: "image/png", buffer: Buffer.from("definitely not an image") });
  await page.getByRole("button", { name: "Upload Image" }).last().click();
  await expect(page.getByText("The image wasn’t uploaded")).toBeVisible();
  await page.keyboard.press("Escape");

  await page.goto("/generate");
  await page.getByLabel("What image would you like to create?").fill("Trigger a refusal [[fail:content_refused]]");
  await page.getByRole("button", { name: /Generate Image/ }).last().click();
  await expect(page.getByTestId("generation-failed")).toContainText("The request was declined", { timeout: 20_000 });
  await expect(page.getByTestId("generation-result")).toHaveCount(0);
});

test("mobile — browse, search and preview at 390 px @mobile", async ({ page }) => {
  await page.goto("/library");
  await page.getByLabel("Search images").fill("Riyadh");
  await expect(page.getByTestId("image-card")).toHaveCount(1);
  await page.getByRole("button", { name: "Preview Riyadh Skyline at Sunset" }).click();
  await expect(page.getByRole("dialog")).toContainText("Riyadh Skyline at Sunset");
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
