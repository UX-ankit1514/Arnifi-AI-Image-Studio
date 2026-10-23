# PRD — Arnifi Image Studio (source text)

_Converted from ~/Documents/PRD Arnifi AI Image Studio.rtf on 23 Oct 2026. The build decisions are in README.md → “Decisions”._

PRODUCT REQUIREMENTS DOCUMENT (PRD)
ARNIFI IMAGE STUDIO
AI Image Generation & Management Platform
Product: Arnifi Image Studio Version: 1.0 — MVP Platform: Desktop-first Web Application Development Environment: Claude Code Design System: Existing Arnifi Design System Product Type: Internal Marketing & Creative Operations Tool Status: MVP Development Specification Primary Stakeholders: Design Team, Marketing Team, Marketing Leadership

1. Executive Summary
1.1 Product Overview
Arnifi Image Studio is an internal AI-powered image creation and management platform that allows Arnifi teams to find, generate, edit, organize, and reuse visual assets from one centralized workspace.
Currently, image-related tasks may involve several independent activities:
Finding existing images.
Creating new visuals using AI.
Editing previously created visuals.
Writing effective image generation prompts.
Maintaining consistent brand styling.
Organizing images for blogs, catalogs, and marketing campaigns.
Arnifi Image Studio combines these activities into a single, streamlined experience.
The platform will include four core capabilities:
Image Library: Store, organize, search, and reuse existing brand assets.
AI Image Generation: Create original images using user prompts and brand guidelines.
AI Image Editing: Modify existing images through natural language instructions.
Prompt Library: Provide ready-made prompt guidelines for common marketing use cases.
The MVP must demonstrate a working end-to-end experience for all four capabilities.
1.2 Product Vision
Create one central place where Arnifi's internal teams can produce and manage consistent visual assets without switching between multiple image generation tools, editing applications, and storage locations.
Primary user journey:
Open Arnifi Image Studio → Find or Create an Image → Edit / Refine → Save to Library → Download
1.3 Product Principles
1. Simplicity First
Users should not need advanced knowledge of AI prompting or professional image editing.
2. Brand Consistency
Images should follow Arnifi's established visual guidelines whenever appropriate.
3. Reusability
Previously created assets should remain accessible for future use.
4. Creative Control
Users can write custom prompts, choose guidelines, and refine outputs.
5. Transparent AI Behavior
The application must distinguish between actual AI-generated images, uploaded images, and sample content.
6. Separate but Connected
The Image Studio must remain an independent product from the Marketing Design System.
7. MVP-Focused
Demonstrate the product's primary value without building an unnecessarily complex image editing or digital asset management platform.

2. Background and Problem Statement
2.1 Current Problem
Arnifi's design and marketing teams regularly require different kinds of images.
Examples include:
UAE business setup visuals.
Banking and accounting service images.
Blog illustrations.
Product catalog graphics.
Social media backgrounds.
Website imagery.
Campaign-specific creatives.
The work becomes repetitive when team members must use different tools for generation, editing, storage, and reuse.
Problem A — Scattered Assets
Images may exist across different folders, design files, and other storage locations.
Finding a previously used image can become time-consuming.
Problem B — Inconsistent AI Outputs
Different team members may use different prompts, visual styles, and instructions.
This can result in images that do not consistently follow the Arnifi brand.
Problem C — Repetitive Image Editing
Small changes, such as removing an object or adjusting a background, can require returning to an image generation tool or asking a designer.
Problem D — Poor Asset Reusability
Generated images may not be organized with their source, campaign, prompt, or relevant metadata.
This makes them harder to find and reuse later.
2.2 Proposed Solution
Build a self-service image workspace with:
A searchable image repository.
Built-in AI image generation.
AI-powered image modification.
Ready-made Arnifi prompt guidelines.
Image metadata and reusable asset organization.
Direct download and library saving.
2.3 Expected Outcome
The proposed experience should:
Reduce unnecessary tool switching.
Make image creation easier for non-designers.
Improve the consistency of brand imagery.
Reduce repetitive manual design work.
Encourage reuse of existing images.
Create a structured internal repository of visual assets.
These outcomes are product hypotheses to validate through MVP testing.

3. Product Goals and Success Metrics
3.1 Primary Product Goals
G1 — Centralized Image Management
Create one accessible location for reusable Arnifi visual assets.
G2 — Accessible AI Generation
Allow users to generate images without needing to understand advanced prompt engineering.
G3 — Easy Image Modification
Allow users to edit existing images using straightforward instructions.
G4 — Consistent Creative Direction
Provide a reusable prompt system based on Arnifi's visual identity.
G5 — Stakeholder Validation
Demonstrate the complete image creation, editing, and management workflow.
3.2 Proposed MVP Success Criteria
Metric
MVP Target
Core experiences
4 working journeys
Prompt guidelines
9 example guidelines
Image generation
1 successful real API workflow
Image editing
1 successful real API workflow
Asset management
Upload, search, view, save, download
Asset history
Track original and edited versions
Demo completion
All core journeys work end-to-end
User testing
Users can complete core tasks without developer assistance
Additional metrics to observe:
Time taken to find a reusable image.
Time taken to create an acceptable image.
Number of generation attempts.
Number of editing iterations.
Image reuse frequency.
Prompt template usage.
Rate of successful downloads.
Do not present assumed time savings or increased productivity as measured results.

4. Target Users
Persona A — Marketing Team Member
Primary User
Creates visual content for campaigns, social media, blogs, and marketing activities.
Needs
Quickly find relevant images.
Generate visuals without writing complicated prompts.
Edit images without using advanced software.
Download content for marketing use.
Main Pain Point
Too many independent tools and repeated reliance on designers.
Persona B — Product / Graphic Designer
Creates and manages visual assets across Arnifi's website and marketing activities.
Needs
Consistent AI outputs.
Greater control over visual prompts.
Reuse of previously generated assets.
Ability to refine specific images.
Organized catalog of visual assets.
Main Pain Point
Repeated image creation and manual asset management.
Persona C — Marketing Manager
Reviews images and ensures the output matches campaign requirements.
Needs
Consistent image quality.
Easy asset discovery.
Visibility into available assets.
Less repetitive production work.
Main Pain Point
Inconsistent visual outputs and unnecessary production dependencies.

5. MVP Scope and Priorities
5.1 P0 — Must-Have Features
ID
Feature
F01
Image Studio dashboard
F02
Image library
F03
Upload existing images
F04
Search and filter images
F05
Image details and metadata
F06
AI image generation
F07
Brand prompt guidelines
F08
Custom prompt input
F09
AI image editing
F10
Before/after comparison
F11
Generate another variation
F12
Save generated images to library
F13
Preserve original and edited versions
F14
Download PNG/JPG
F15
Generation states and error handling
F16
Basic API usage safeguards
5.2 P1 — Nice-to-Have Features
Only implement after all P0 requirements work.
Favorites.
Image collections.
Visual similarity search.
Batch image generation.
Selective editing with image masks.
Simple text overlays.
Prompt history and saved custom prompts.
Bulk downloading.
Multiple image generation providers.
Advanced asset tagging.
Custom image cropping.
5.3 Out of Scope for MVP
Do not build:
A full Photoshop-like editor.
Complex multi-layer graphic design.
Video generation.
Team collaboration and comments.
Enterprise digital asset management workflows.
Full marketing campaign management.
Direct social media publishing.
Automatic website publishing.
Live Marketing Design System integration.
Figma-to-image synchronization.
Payment subscriptions.
Multiple organizational workspaces.
A custom-trained image generation model.
The goal is a working internal image platform, not an enterprise creative suite.

6. Product Information Architecture
The application should use a clean, simple structure with four main destinations.
Primary Navigation
Image Library
Generate Image
Edit Image
Prompt Library
Additional supporting screens:
Image Details
Image Preview
Generation Results
Settings / Connection Status
Avoid creating unnecessary dashboard pages or complicated navigation hierarchies.

7. Core User Journey A — Image Library
7.1 Objective
Help users quickly discover, manage, and reuse existing Arnifi images.
7.2 Complete Journey
Step 1 — Open Application
The user opens Arnifi Image Studio.
They see the primary navigation and image library.
Step 2 — Browse Images
The user sees a gallery of existing images.
Examples of possible categories:
Marketing
Blogs
Catalog
Website
Campaigns
Categories must reflect the actual assets available.
Step 3 — Search or Filter
The user enters a keyword, such as:
"Dubai business setup"
The application displays matching images using titles, categories, and metadata.
Step 4 — Select Image
The user opens the image details view.
The application shows:
Full-size preview.
Image name.
Dimensions.
File format.
Category.
Tags.
Source type.
Date added.
Prompt, if generated by AI.
Related original or edited version, if available.
Step 5 — Take Action
The user can:
Download the image.
Open it in the Image Editor.
Update its name or tags.
View related versions.
Step 6 — Reuse
The user downloads the image for a blog, campaign, or marketing creative.
7.3 Success Condition
The user can locate and download an existing image without recreating it.
7.4 Library Requirements
The library must provide:
Image thumbnail grid.
Image search.
Category filter.
Upload action.
Image preview.
Basic metadata editing.
Download.
Edit Image entry point.
The library must contain real uploaded, seeded, or generated assets—not permanently hardcoded decorative placeholders.

8. Core User Journey B — AI Image Generation
8.1 Objective
Allow users to create high-quality images using simple instructions.
8.2 Complete Journey
Step 1 — Select Generate Image
The user opens the image generation workspace.
Step 2 — Enter Image Brief
A large text field asks:
"What image would you like to create?"
Example:
"Create a realistic image of a professional entrepreneur standing in a modern Dubai office. Use soft natural lighting and leave negative space on the left."
Step 3 — Choose Prompt Guideline
The user can select an optional Arnifi guideline.
Examples:
Professional Photography
Minimal Architectural Visual
Corporate Business Imagery
Product Illustration
Social Media Background
Step 4 — Select Image Properties
The user chooses:
Aspect ratio: Square, Portrait, or Landscape.
Quality: Standard or High.
Background: Normal or Transparent, where supported.
Use only settings the connected image provider supports.
The tool must not pretend an unsupported ratio or output mode is available.
Step 5 — Generate
The user clicks Generate Image.
The application builds a final prompt using:
Selected guideline.
User brief.
Applicable Arnifi visual rules.
Supported output settings.
The final prompt is sent to the configured image generation provider.
Step 6 — Processing
The interface displays an honest generation state:
"Generating image…"
Provide a loading indicator and allow appropriate retry handling.
Step 7 — Review Generated Image
Once completed, display the actual generated image.
The user may:
Download.
Save to library.
Edit.
Generate another variation.
Step 8 — Save Image
The user chooses Save to Library.
The application stores:
Output image.
Original user prompt.
Applied prompt guideline.
Provider/model identifier.
Output dimensions.
Creation time.
Image metadata.
8.3 Success Condition
A user can create and save a new image using one prompt and an optional brand guideline.
8.4 Generation Rules
Do not automatically add marketing text to every image.
Do not force all images into a single visual style.
Preserve the user's creative intent.
Apply brand guidelines when selected.
Allow a fully custom prompt.
Keep output settings understandable.
Allow generation without choosing a preset.
Never silently replace actual generation with a static sample image.

9. Core User Journey C — AI Image Editing
9.1 Objective
Allow users to change existing images without recreating the entire visual.
9.2 Complete Journey
Step 1 — Open Edit Image
The user can start by:
Uploading an image.
Selecting an existing library image.
Selecting a newly generated image.
Step 2 — Preview Original
Display the full original image.
Step 3 — Describe Changes
Provide an instruction field.
Examples:
"Remove the person in the background."
"Make the background lighter."
"Change the lighting to soft morning light."
"Replace the office background with a modern Dubai skyline."
"Remove the existing text from the document."
"Keep the composition the same and make the subject smile slightly."
Step 4 — Submit Edit
The user clicks Apply Changes.
The application sends the source image and editing instructions to the image provider.
Step 5 — Display Results
Display:
Original image.
Edited image.
Editing prompt.
Allow a before/after comparison.
Step 6 — Continue Refinement
The user can:
Accept the result.
Enter another modification.
Retry with a different instruction.
Return to the original.
Download the edited version.
Step 7 — Save Edited Version
When saved, the edited image becomes a new asset version.
The original image must remain recoverable.
9.3 Success Condition
A user can upload an image, request a modification, review the result, and download the edited asset.
9.4 Important Technical Limitation
AI image editing is generative, not a guaranteed pixel-perfect modification.
Even when the user asks to preserve everything else, the model may change unrelated pixels.
The interface should not promise that every unchanged area will remain perfectly identical.
For precise text placement, logos, or brand elements, deterministic overlays or the Marketing Design System are more appropriate.

10. Core User Journey D — Prompt Library
10.1 Objective
Help users generate brand-consistent images without needing expert prompt-writing skills.
10.2 Complete Journey
Step 1 — Open Prompt Library
The user sees a curated gallery of prompt guidelines.
Step 2 — Browse Guidelines
Each guideline contains:
Title.
Use case.
Short description.
Example output or reference image, if available.
Reusable prompt instructions.
Recommended settings.
Step 3 — Select Guideline
The user chooses an appropriate style.
Example:
"Realistic Corporate Photography"
Step 4 — Customize Brief
The application opens the generation workspace with the selected guideline active.
The user enters the actual image requirement.
Example:
"A small business owner reviewing documents in Dubai."
Step 5 — Generate or Copy
The user chooses:
Generate Image: use the guideline within the application.
Copy Prompt: copy the assembled prompt for use elsewhere.
Step 6 — Review Output
The user evaluates the image.
They can modify their brief and generate another output.
10.3 Success Condition
A user can select a guideline, customize it, and generate a relevant image without manually assembling a lengthy technical prompt.

11. Initial Prompt Library
The MVP should contain nine editable, reusable prompt templates.
The following are suggested defaults. They are not claimed to be existing approved Arnifi prompts.
The actual guidelines should be refined using the brand instructions already supplied inside Claude Code.
Prompt 1 — Corporate Photography
Use Case: Website and marketing visuals featuring professionals.
Base Direction:
"Create realistic, premium corporate photography featuring [SUBJECT] in [LOCATION]. Use natural expressions, professional styling, realistic materials, soft lighting, and a clean contemporary environment. Avoid exaggerated cinematic effects, excessive visual clutter, and artificial-looking skin textures."
Prompt 2 — UAE Architecture
Use Case: UAE business setup and jurisdiction-related visuals.
Base Direction:
"Create a realistic, modern architectural image of [LOCATION / BUILDING TYPE] in the UAE. Use clean compositions, subtle daylight, accurate architectural proportions, restrained colors, and a premium corporate photography style."
Prompt 3 — Minimal Marketing Background
Use Case: Social media creative backgrounds.
Base Direction:
"Create a clean, minimal background featuring [SUBJECT]. Leave clear negative space at [POSITION] for marketing content. Use a modern, professional aesthetic with controlled lighting, restrained details, and balanced visual hierarchy."
Prompt 4 — Product Visual
Use Case: Catalog and service visuals.
Base Direction:
"Create a premium commercial image featuring [PRODUCT / OBJECT]. Use realistic materials, soft shadows, clean surfaces, neutral styling, and a professional studio composition. Keep the product as the primary visual focus."
Prompt 5 — Banking & Finance
Use Case: Business banking, accounting, and finance services.
Base Direction:
"Create a realistic conceptual image representing [BANKING / FINANCE TOPIC]. Use sophisticated business imagery, clean compositions, subtle visual metaphors, and a professional modern corporate aesthetic."
Prompt 6 — Business Setup
Use Case: Company formation campaigns.
Base Direction:
"Create a premium, realistic image showing [BUSINESS ACTIVITY / ENTREPRENEUR SCENARIO] in [COUNTRY]. The image should communicate confidence, simplicity, and professionalism through natural interactions and uncluttered surroundings."
Prompt 7 — Blog Hero Image
Use Case: Blog headers and editorial imagery.
Base Direction:
"Create a premium editorial image illustrating [ARTICLE TOPIC]. Prioritize a clear visual concept, realistic details, relevant subject matter, balanced composition, and sufficient room for page content."
Prompt 8 — Existing Image Modification
Use Case: Editing previously created visuals.
Base Direction:
"Edit the provided image by [DESCRIBE CHANGE]. Preserve the overall composition, subject characteristics, lighting direction, and other relevant visual details as closely as possible. Avoid unrelated modifications."
Prompt 9 — Background Replacement / Cleanup
Use Case: Background changes and image refinement.
Base Direction:
"Use the supplied image as a reference. Replace or simplify [BACKGROUND AREA] while preserving [MAIN SUBJECT]. Maintain realistic shadows, consistent perspective, natural lighting, and visually coherent edges."
Prompt System Rules
Each template must support placeholders rather than fixed content.
The application must:
Store the prompt template separately from the user's brief.
Combine both when generating.
Show which guideline is selected.
Allow the user to remove or change the guideline.
Allow copying the composed prompt.
Preserve the guideline ID in generated image metadata.
Avoid contradictory prompt instructions.
The prompt guideline system must be configurable rather than embedded directly into individual UI components.

12. Dashboard & Screen Requirements
Screen 1 — Image Library
Layout
Top
Page heading: Image Library.
Search field.
Upload Image action.
Generate Image action.
Main Content
Image grid.
Categories/filters.
Image thumbnails.
Image title or identifier.
Quick actions.
Image Card Actions
Open preview.
Edit.
Download.
View details.
Avoid displaying excessive technical metadata on every card.
Screen 2 — Generate Image
Layout
Left — Generation Controls
Prompt input.
Select guideline.
Aspect ratio.
Quality.
Background option.
Generate action.
Right — Results Workspace
Generated image.
Loading state.
Download.
Edit.
Save to library.
Generate variation.
The generation interface should make the prompt and result easy to understand.
Screen 3 — Edit Image
Layout
Left Panel
Upload/select image.
Edit instruction input.
Apply Changes.
Editing history.
Center / Right Workspace
Original image.
Edited result.
Before/after comparison.
Save and download actions.
Do not make users navigate away after every editing request.
Screen 4 — Prompt Library
Layout
Prompt categories.
Guideline cards.
Prompt preview.
Copy Prompt.
Use Prompt.
Show understandable descriptions instead of technical AI terminology.
Screen 5 — Image Details
Content
Large image preview.
Title.
Category.
Tags.
Dimensions.
Format.
Created date.
Source.
Prompt information when available.
Related versions.
Download.
Edit.

13. Image Library Data Requirements
The image library is more than a collection of thumbnails.
Each stored image should have a structured record.
13.1 Required Metadata
Field
Purpose
Image ID
Unique asset identifier
Title
Human-readable image name
Category
Marketing, Blog, Catalog, etc.
Tags
Search and organization
Source Type
Uploaded, Generated, Edited
File Location
Stored image reference
Width & Height
Image dimensions
File Format
PNG, JPG, WebP
File Size
Storage information
Created Date
Asset history
Original Prompt
Generation or edit instructions, if applicable
Prompt Guideline
Selected guideline, if applicable
Provider
Model/provider used
Parent Image ID
Link edited images to originals
Version Number
Asset version tracking
Optional fields:
Campaign name.
Related blog/catalog reference.
Notes.
Usage context.
Content owner.
Rights/source attribution.
The original discussion called for catalog images to retain their relevant data. The full metadata schema above is a proposed MVP implementation of that requirement.
13.2 Asset Rules
Never overwrite the source image when editing.
Each generated or edited image must receive a new ID.
Maintain references between versions.
Store image metadata independently from the image file.
Keep image categories editable.
Prevent duplicate IDs.
Support download from the stored file.
Keep timestamps and source information.

14. AI Generation Architecture
14.1 Provider Strategy
Use one real AI image provider for the MVP.
Recommended initial implementation:
OpenAI Image API
The implementation should support two separate operations:
Text-to-image generation.
Image-to-image editing.
Suggested starting models:
gpt-image-2.5-flare for everyday generation.
gpt-image-2.5-sunburst for precision-oriented editing.
Claude Code must verify current model availability, account access, API parameters, and provider documentation during implementation.
Model names and provider-specific settings must remain configurable.
Do not hardcode an assumption that every account has access to every model.
14.2 API Integration Rules
The AI integration must:
Run through the application's server.
Use an authorized API key.
Validate prompts and supported input files.
Validate generation settings.
Process the actual provider response.
Return the generated image to the interface.
Save completed outputs when requested.
Handle provider errors.
Respect provider rate limits.
Support retrying failed requests safely.
API keys must never be exposed in the browser.
14.3 Provider Abstraction
Create a reusable image service interface.
Conceptual operations:
generateImage()
editImage()
getSupportedOptions()
normalizeImageResult()
handleProviderError()
The application should not require changes throughout the UI if a different image model is introduced later.
For the MVP, only one provider implementation is necessary.
14.4 Prompt Composition
Generation requests should combine three inputs.
Layer 1 — Brand Guidelines
Existing Arnifi image-related visual rules.
Layer 2 — Selected Prompt Template
Chosen prompt guideline, if any.
Layer 3 — User Request
The subject, action, scene, and specific requirements entered by the user.
The final generation request must respect the user's brief.
Do not override explicit user requirements with unrelated default imagery.
Keep generation instructions separate from UI styling instructions.
14.5 AI Generation States
A generation request must have a clear state:
Idle.
Validating.
Generating.
Completed.
Failed.
The interface must provide appropriate feedback for each state.
Never claim a generation succeeded before the provider has returned a valid result.

15. Image Editing Architecture
15.1 Editing Input
A user editing an image must provide:
One supported source image.
A nonempty editing instruction.
For future versions, the system may accept multiple reference images or user-defined masks.
15.2 Editing Workflow
Load source image.
Submit the source and editing prompt to the server.
Server validates input.
Server calls the provider's image editing capability.
Receive the actual edited image.
Display it next to the original.
Let the user accept, refine, or discard the result.
Save approved output as a separate version.
15.3 Editing History
The interface should record a simple sequence of edits.
Example:
Original Image → Edit 1 → Edit 2
Each edit should preserve:
Previous version reference.
Instruction used.
Output image.
Timestamp.
Do not implement a full Photoshop-style editing history system.
15.4 Before/After Comparison
For the MVP, side-by-side comparison is sufficient.
Optional future improvement:
Draggable comparison slider.
Users should be able to see both outputs without losing the original.
15.5 Text Editing Limitation
Text generated inside an image is normally part of its pixels.
It is not automatically an editable text layer.
The MVP can request AI to remove or replace visual text, but must not promise perfect letter-by-letter control.
Precise text overlays can be introduced as a separate lightweight enhancement.

16. Recommended Technical Stack
The product must be a web application.
Stack
Layer
Recommended Technology
Frontend
React + TypeScript
Full-stack Framework
Next.js App Router
Styling
Existing Arnifi Design System
UI Components
Existing project components
State Management
Zustand where shared client state is needed
AI Image Provider
OpenAI Image API
Server API
Next.js Route Handlers
Storage
Supabase Storage
Metadata Database
Supabase PostgreSQL
Authentication
Reuse existing auth or minimal internal access protection
Input Validation
Zod
Image Utilities
Sharp where server-side processing is needed
Unit Testing
Vitest
End-to-End Testing
Playwright
Deployment
Vercel or compatible hosting
16.1 Tech Stack Selection Rules
Before implementing, inspect the existing Claude Code project.
If a working stack already exists, reuse it where practical.
Do not migrate a functional project merely to follow this recommendation.
Preserve the existing design system.
Use maintained and compatible dependencies.
Avoid unnecessary architectural complexity.
16.2 Why Next.js?
The application requires both a UI and secure server-side AI requests.
Next.js provides both in a single project.
The server must protect API credentials and handle image generation/editing requests.
16.3 Why Supabase?
The image repository requires persistent file storage and searchable image metadata.
Supabase provides:
Object storage.
PostgreSQL database.
Image metadata records.
Storage security controls.
Optional authentication.
Use private storage for internal image assets unless an asset is intentionally approved for public access.
16.4 Backend Requirements
The server must handle:
Image generation requests.
Image edit requests.
File validation.
File uploads.
Storage operations.
Metadata updates.
Secure downloads.
Usage limits.
Error responses.
Do not call a paid AI endpoint directly from the browser.
16.5 Local MVP and Missing Credentials
If external storage or AI credentials have not been configured:
Keep the application usable with clearly marked demo fixtures.
Show a helpful setup message.
Do not fake successful generation or editing.
Enable real functionality once valid credentials are provided.
Do not commit keys or secrets into the repository.
A production-hosted MVP must use persistent storage, not an ephemeral server filesystem.

17. Recommended Application Architecture
Use a modular structure.
src/
  app/
    page.tsx

    library/
      page.tsx

    generate/
      page.tsx

    edit/
      page.tsx

    prompts/
      page.tsx

    api/
      images/
      generate/
      edit/
      upload/

  components/
    layout/
    common/

  features/
    image-library/
      ImageLibrary.tsx
      ImageCard.tsx
      ImageDetails.tsx

    image-generation/
      GenerationForm.tsx
      GenerationResult.tsx
      GenerationSettings.tsx

    image-editor/
      ImageEditor.tsx
      ComparisonView.tsx
      EditHistory.tsx

    prompt-library/
      PromptLibrary.tsx
      PromptCard.tsx
      PromptDetails.tsx

  lib/
    ai/
      imageProvider.ts
      openaiProvider.ts

    storage/
      imageStorage.ts

    database/
      imageRepository.ts

    prompts/
      promptComposer.ts

    validation/

  data/
    promptTemplates.ts

  types/
    image.ts
    prompt.ts
    generation.ts

  styles/

tests/
  unit/
  integration/
  e2e/
This is a recommended structure, not a requirement to overwrite an existing working repository.

18. Database and Storage Design
18.1 Required Collections / Tables
Images
Stores image metadata and file references.
Prompt Templates
Stores prompt guidelines, names, descriptions, and template content.
Image Jobs
Stores generation or editing request status and related output references.
Image Versions
May be represented through parent-child image relationships for the MVP instead of requiring a separate table.
18.2 Example Image Record
{
  "id": "image-001",
  "title": "Dubai Office Visual",
  "category": "Marketing",
  "tags": ["Dubai", "Office", "Business"],
  "sourceType": "generated",
  "storagePath": "images/image-001.png",
  "width": 1024,
  "height": 1536,
  "format": "png",
  "prompt": "A modern Dubai office...",
  "promptTemplateId": "corporate-photography",
  "provider": "openai",
  "model": "configured-image-model",
  "parentImageId": null,
  "version": 1,
  "createdAt": "2026-10-23T10:00:00Z"
}
The example is illustrative and is not an actual generated asset.
18.3 Storage Rules
Persist uploaded and generated images.
Generate unique storage paths.
Validate MIME type and actual file contents.
Preserve original files.
Avoid overwriting assets during edits.
Store searchable metadata in the database.
Keep internal assets private.
Use authorized access or expiring URLs for downloading.
Handle deleted/missing assets gracefully.

19. Functional Requirements and Acceptance Criteria
FR-01 — Image Library
Requirement: Users can access reusable images.
Acceptance Criteria:
Images display as a gallery.
Uploaded and saved generated images appear.
Users can search by title/tags.
Users can filter by category.
Each image opens a details view.
Download works.
FR-02 — Upload
Requirement: Users can upload existing images.
Acceptance Criteria:
Supports PNG, JPG/JPEG, and WebP where processing permits.
Rejects unsupported formats.
Validates file size using a documented application limit.
Creates an image record.
Shows upload success or failure.
Uploaded image can be edited and downloaded.
FR-03 — AI Generation
Requirement: Generate a real image from a prompt.
Acceptance Criteria:
User enters a prompt.
User can optionally select a guideline.
Application validates inputs.
Server calls the configured provider.
Actual output appears.
User can download or save the image.
Provider failures display meaningful errors.
FR-04 — Prompt Library
Requirement: Provide reusable Arnifi image prompt guidelines.
Acceptance Criteria:
Nine guidelines are available.
User can read the guideline.
User can apply it to generation.
User can copy the composed prompt.
User can enter a custom brief.
Guideline selection is retained during generation.
FR-05 — Image Editing
Requirement: Users can edit an image through natural-language instructions.
Acceptance Criteria:
User selects or uploads an image.
User enters edit instructions.
Provider returns an actual edited image.
Original remains accessible.
Result can be downloaded or saved.
User can perform an additional refinement.
FR-06 — Before/After Preview
Requirement: Users can compare original and edited versions.
Acceptance Criteria:
Original and output are visibly distinguishable.
Comparison works after an edit.
User can return to previous versions.
FR-07 — Save to Library
Requirement: Users can persist created assets.
Acceptance Criteria:
Successful save creates an image record.
Actual image file is stored.
Image appears in the library.
Metadata is preserved.
Saving an edited output does not overwrite the original.
FR-08 — Download
Requirement: Users can download images.
Acceptance Criteria:
PNG download works.
JPG download works.
Downloaded image is not watermarked by the application.
Image is not unintentionally resized.
Transparent images retain transparency when exported as PNG.
JPG export handles transparency with an appropriate opaque background.
FR-09 — Error Handling
Requirement: Errors must be understandable and recoverable.
Acceptance Criteria:
Missing API configuration is explained.
Invalid uploads are rejected.
Failed AI requests can be retried.
Network errors are handled.
Missing library images show an appropriate state.
No fake result is displayed as a successful generation.

20. Design System and UX Requirements
20.1 Mandatory Design System Rule
Claude Code must use the existing Arnifi design system already available in the project.
Do not create a new brand identity.
Do not introduce arbitrary colors, gradients, shadows, or typography outside the established system.
Use the project's existing:
Color tokens.
Typography styles.
Inter and Lora font usage rules.
Buttons.
Input fields.
Cards.
Spacing scale.
Border and radius conventions.
Icons.
Navigation patterns.
Only introduce new components when necessary and make them consistent with the existing design language.
20.2 Visual Direction
The application should feel:
Professional.
Premium.
Minimal.
Calm.
Modern.
Practical.
Easy to understand.
Avoid:
Unnecessary gradient effects.
Excessive decorative illustrations.
Crowded dashboards.
Overcomplicated navigation.
Distracting motion.
Childish AI-themed UI patterns.
20.3 UX Principles
Clear Primary Action
Each screen should have one obvious primary action.
Progressive Disclosure
Show essential controls first and place advanced options behind optional sections.
Visual Preview
Image-based workflows must prioritize large previews.
Recoverability
Never force users to permanently lose their original image when editing.
Consistent Navigation
All four modules must use shared navigation and interface conventions.
Helpful Empty States
If the library is empty, encourage users to upload or generate their first image.

21. AI Safety, Security, and Cost Controls
Image generation is a paid external service.
The MVP must include basic safeguards.
21.1 API Security
Store API keys server-side.
Never expose credentials in browser bundles.
Validate requests on the server.
Do not allow unrestricted anonymous use of paid endpoints.
Protect the internal application through existing authentication or an appropriate internal demo access mechanism.
21.2 Usage Controls
Implement:
A limit on image requests per user/session or internal account.
Basic server-side rate limiting.
A configurable maximum output count per request.
A configurable usage/budget safeguard.
Protection against repeated accidental submissions.
Do not invent fixed pricing or cost guarantees.
21.3 Input Safety
Validate uploaded file formats.
Enforce provider-compatible size limits.
Reject malformed files.
Respect provider content policies.
Do not execute uploaded files.
Do not allow user prompts to override server-side security controls.
21.4 Asset Privacy
Images uploaded for internal Arnifi workflows should not become publicly discoverable by default.
Provide appropriate access restrictions and avoid unnecessary retention of sensitive uploaded material.
21.5 Generation Transparency
Display clear errors for:
Invalid requests.
Provider refusal.
Insufficient API access.
Usage limits.
Service unavailability.
Storage failure.

22. Edge Cases
Scenario
Expected Behavior
No images in library
Show useful empty state
Unsupported upload
Show file format error
Oversized image
Show size error
Missing API key
Show setup/connection error
Prompt is empty
Disable generation and explain
Provider request fails
Show retry action
Result cannot be saved
Keep result available in the current session and show storage error
Image has transparent background
Preserve transparency in PNG
User changes guideline
Update generation instructions
User retries an edit
Preserve source image
User cancels before submitting
No request should be sent
User closes an editor
Warn about unsaved relevant changes
User searches with no matches
Show no-results state
External asset is missing
Display recoverable error
Provider rejects content
Display a clear, non-misleading explanation

23. Non-Functional Requirements
23.1 Performance
Pages should remain responsive.
Image grids should use optimized thumbnails.
Large images should not block the entire UI.
Loading indicators must appear during actual processing.
Multiple clicks must not accidentally trigger duplicate paid requests.
23.2 Reliability
Saved images remain available after refresh.
Original images are preserved.
Image metadata remains associated with the correct file.
Errors do not crash the application.
Failed storage operations do not claim success.
23.3 Browser Support
Prioritize current desktop versions of:
Chrome.
Safari.
Edge.
23.4 Responsiveness
The product is desktop-first, but basic viewing, searching, and downloading should remain usable on smaller screens.
Complex editing does not need a fully optimized mobile experience in MVP.
23.5 Accessibility
Accessible form labels.
Keyboard-operable actions.
Visible focus indicators.
Readable error messages.
Accessible dialogs and controls.

24. Development Roadmap
Phase 1 — Project Inspection and Setup
Tasks
Inspect the existing project and folder structure.
Identify the Arnifi design system.
Verify dependencies.
Check available environment configuration.
Set up the application shell.
Create shared navigation.
Establish the AI provider and storage interfaces.
Deliverable
Working application foundation.
Phase 2 — Image Library
Tasks
Build the image gallery.
Add upload capability.
Create the image metadata model.
Add storage integration.
Implement search and categories.
Build image detail view.
Implement image download.
Deliverable
Functional image asset repository.
Phase 3 — Prompt Library
Tasks
Add nine reusable prompt guidelines.
Build the guideline gallery.
Create prompt detail view.
Implement prompt composition.
Add copy prompt functionality.
Connect guideline selection to image generation.
Deliverable
Functional brand prompt guidance system.
Phase 4 — AI Image Generation
Tasks
Configure the AI image provider.
Implement server-side generation.
Add prompt and settings form.
Implement request validation.
Show generation states.
Display actual results.
Implement save and download.
Deliverable
Working text-to-image experience.
Phase 5 — AI Image Editing
Tasks
Implement source image selection.
Add editing instruction input.
Integrate the provider's image editing API.
Display original and edited images.
Preserve edit history.
Support further edits.
Save edited versions.
Implement download.
Deliverable
Working image-to-image editing experience.
Phase 6 — QA and Polish
Tasks
Test all four core journeys.
Fix image storage issues.
Test API failure scenarios.
Verify export quality.
Test key browsers.
Verify rate-limit safeguards.
Check typography and visual consistency.
Prepare stakeholder demonstration.
Deliverable
Stakeholder-ready MVP.

25. Testing Strategy
Claude Code must implement and run appropriate tests.
Unit Tests
Test:
Prompt composition.
Input validation.
Image metadata mapping.
File type validation.
Image version relationships.
Provider response normalization.
Integration Tests
Test:
Generation API integration.
Editing API integration.
Image storage.
Database metadata operations.
Download flow.
Use mocked provider responses for automated tests where appropriate to avoid unnecessary paid API calls.
End-to-End Tests
Test the following user journeys:
Test A — Find Existing Image
Open Library → Search → Select → Download
Test B — Generate Image
Open Generate → Enter Prompt → Choose Guideline → Generate → Save
Test C — Edit Image
Open Edit → Upload Image → Enter Instruction → Apply → Compare → Download
Test D — Prompt Guideline
Open Prompt Library → Select Guideline → Customize → Copy or Generate
Test E — Persistence
Save Image → Refresh Application → Open Library → Verify Asset Exists
At least one authorized real provider test must confirm that generation and editing work outside mocked environments.

26. MVP Definition of Done
The MVP is complete only when the following requirements are satisfied.
Product
User can open all four main sections. 
User can browse existing images. 
User can search and filter images. 
User can upload an image. 
User can read and apply prompt guidelines. 
User can generate an actual AI image. 
User can edit an actual image using AI. 
User can compare original and edited images. 
User can save images to the library. 
User can download images. 
Original image versions remain accessible. 
Design
Existing Arnifi design system is followed. 
Layouts are consistent. 
Forms and controls are understandable. 
Image previews render correctly. 
Empty, loading, error, and success states are implemented. 
Technical
API credentials are protected. 
Uploads are validated. 
Storage is persistent. 
Image records contain required metadata. 
Failed requests are handled. 
Usage safeguards work. 
Application runs locally. 
Production build passes. 
Critical end-to-end flows are tested. 
A UI with fake generation buttons or only static image samples is not considered a completed MVP.

27. Stakeholder Demonstration Journey
The MVP should support this exact demonstration.
Scenario
Arnifi's marketing team needs an image for a new campaign about setting up a business in Dubai.
Step 1 — Search Existing Images
Open Arnifi Image Studio.
Search the library for "Dubai Business".
Show how previously used images can be discovered and reused.
Step 2 — Generate a New Image
Go to Generate Image.
Choose the Corporate Photography prompt guideline.
Enter:
"Create a premium realistic image of a professional entrepreneur standing inside a modern Dubai office, with soft natural lighting and empty space on the left."
Click Generate.
Display the actual AI result.
Step 3 — Edit the Image
Open the generated image in the editor.
Enter:
"Make the background slightly brighter and more minimal. Keep the entrepreneur and overall composition as similar as possible."
Click Apply Changes.
Show the edited result.
Step 4 — Compare
Display the original and modified images side by side.
Explain that the source image remains preserved.
Step 5 — Save to Library
Save the edited image.
Show that the application stores relevant information such as:
Asset name.
Category.
Prompt.
Source.
Date.
Related version.
Step 6 — Download
Download the final image as PNG.
Stakeholder Message
"Arnifi Image Studio brings image discovery, AI generation, editing, and brand-specific prompt guidelines into one workspace. Teams can create and reuse consistent visual assets more easily, reducing repetitive work and tool switching."

28. Relationship With Marketing Design System
Arnifi Image Studio and Arnifi Marketing Design System are two independent applications.
They solve different but related problems.
Arnifi Image Studio
Responsibility:
Create, edit, organize, and provide individual image assets.
Arnifi Marketing Design System
Responsibility:
Turn layouts, images, headings, descriptions, logos, and footers into finished marketing posts.
MVP Connection
The user can:
Generate an image in Arnifi Image Studio.
Download the image.
Open the Marketing Design System.
Select a poster template.
Upload the image.
Finish the poster.
Export the marketing creative.
This is a manual connection between the two tools.
Future Connection
A later version can share the same asset repository.
Possible functionality:
"Use in Marketing Studio" action.
Shared asset browser.
Direct image insertion into template placeholders.
Common brand asset management.
Do not implement these integrations for the first Image Studio MVP.

29. V2 Product Opportunities
Potential future capabilities include:
Advanced Editing
Select specific regions for changes.
Mask-based AI edits.
Background removal.
Advanced text replacement.
Multiple reference images.
Asset Management
Smart AI tagging.
Semantic image search.
Duplicate detection.
Favorites and collections.
Campaign-based asset grouping.
Generation
Multiple AI models.
Bulk generation.
Style references.
Saved custom prompt presets.
Consistency across campaign image sets.
Integration
Marketing Design System asset sharing.
Figma asset workflows.
Approved blog/catalog publishing integrations.
Governance
Team permissions.
Image approvals.
Usage tracking.
Asset ownership.
Brand compliance checks.
These capabilities are not required for MVP.

30. Risks and Dependencies
Risk
Proposed Mitigation
AI outputs vary in quality
Use prompt guidelines and allow refinement
Unexpected API costs
Implement usage limits and monitor usage
Image editing changes unintended details
Preserve originals and display before/after
Uploaded images are too large
Validate and process supported formats
Assets become difficult to find
Store searchable metadata
Users expect pixel-perfect edits
Explain AI limitations
Provider API becomes unavailable
Isolate provider integration and show recoverable errors
Existing brand guidance is incomplete
Reuse verified design rules and flag missing requirements
Storage credentials are missing
Provide honest setup/demo mode
Scope grows into full design software
Keep advanced editing outside MVP

31. Claude Code — Mandatory System Implementation Instructions
You are the engineering team responsible for building Arnifi Image Studio.
Your objective is to deliver a functional web application following this PRD.
The product owner is a product designer without coding experience.
You must handle the technical implementation and explain progress in simple, understandable language.
Rule 1 — Inspect the Existing Project First
Before writing new code:
Inspect the project structure.
Identify the existing framework.
Inspect the available Arnifi design system.
Check installed dependencies.
Check existing environment configuration.
Identify reusable components.
Do not overwrite existing work unnecessarily.
Rule 2 — Follow the Existing Arnifi Design System
The design system is already available.
Do not invent a new design language.
Reuse the current typography, colors, spacing, components, and interaction patterns.
Rule 3 — Build Functional Workflows
All critical actions must work.
Do not build decorative buttons that have no functionality.
Do not create fake image generation responses and present them as real.
Rule 4 — Keep the Product Independent
This is a separate application from the Marketing Design System.
Share design standards where appropriate, but do not merge both products into one large application.
Rule 5 — Use Real API Integration
Image generation and editing must call an authorized image generation provider through secure server routes.
Check current official API documentation before implementing requests.
Use supported models and request settings.
Rule 6 — Protect Credentials
Never expose API keys in frontend code or commit them into source control.
Use environment variables and secure server-side API access.
Rule 7 — Build Persistent Asset Storage
The image library must retain uploaded and saved images across refreshes and deployments.
Do not rely on temporary in-memory arrays for real saved content.
Rule 8 — Keep the Architecture Modular
Keep separate modules for:
Image storage.
Prompt guidelines.
AI provider.
Image generation.
Image editing.
Asset metadata.
Downloads.
Do not hardcode all functionality into a single component.
Rule 9 — Maintain Honest Error States
If generation fails, report failure.
If an API key is missing, show the required configuration.
If external access is unavailable, do not pretend the operation succeeded.
Rule 10 — Test Before Completion
Run appropriate tests and verify:
The application launches.
The library works.
Upload works.
Real image generation works with configured credentials.
Real image editing works with configured credentials.
Image saving works.
Downloads work.
Production build succeeds.
Rule 11 — Make Reasonable MVP Decisions
Do not repeatedly stop for minor implementation decisions.
Choose maintainable, simple implementations that match the PRD.
Ask for input only where genuinely required, such as missing credentials, permissions, or unavailable source assets.
Rule 12 — Deliver a Demonstrable Product
Do not stop after creating a project plan.
Build the app, run it, fix issues, and complete the primary user journeys.

32. Required Final Development Deliverables
After implementation, provide:
Working Arnifi Image Studio web application.
Completed four-module navigation.
Functional image library.
Functional prompt library.
Real image generation integration.
Real AI image editing integration.
Persistent asset storage.
Working image downloads.
Test results.
Instructions to run the application locally.
Deployment instructions.
A list of credentials or external configuration still required.
Known limitations and incomplete requirements.
Stakeholder demonstration checklist.
Explain each deliverable without assuming the user knows programming terminology.

33. Final Product Outcome
Arnifi Image Studio should demonstrate a unified internal workflow:
Find an Image → Generate or Edit → Apply Brand Guidelines → Save → Download
The application should make image-related work simpler while maintaining consistent creative quality.
The completed MVP should prove three things:
1. Usability: A non-designer can create or modify an image.
2. Efficiency: Existing images and prompt guidelines can be reused.
3. Scalability: The initial implementation can support a larger image library and future integration with the Marketing Design System.
The product is successful when stakeholders can experience these benefits through a functioning application rather than static mockups.

34. START IMPLEMENTATION
Follow this order:
Read and understand this complete PRD.
Inspect the existing Arnifi project and design system.
Establish the application architecture.
Build the image library and prompt guidelines.
Integrate secure image generation.
Integrate image editing.
Implement persistent saving and downloads.
Test the complete user journeys.
Prepare the stakeholder-ready MVP.
Do not expand the scope beyond the MVP until its core journeys work reliably.
Final instruction: Build Arnifi Image Studio as a clean, brand-consistent, fully functional internal image creation and management web application.
