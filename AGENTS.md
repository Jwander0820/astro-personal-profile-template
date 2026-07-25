# Personal profile setup instructions

This repository is an Astro personal-profile template. Markdown and JSON under `src/content/` are the source of truth for the rendered website and the defaults loaded by both Studio modes; browser-only drafts remain transient until exported or explicitly saved through the local adapter.

## Profile Studio architecture

- `/studio/` is the only Profile Studio UI. The public version edits a browser-local draft and downloads settings; `npm run studio` opens the same page and adds the loopback-only project-writing adapter.
- Port `4322` is an API adapter only. Do not restore or maintain a second Studio UI there.
- Studio preview must load the formal `/` page in an iframe and reuse the production `ProfileRenderer`, CSS, SVG icon catalog, and interactive components. Do not create a separate simulated preview.
- Formal Astro components and `src/scripts/profile-renderer.js` are two render entry points for the same visible document. When changing shared cards, copy, icons, or structure, update both paths and add or adjust a `check:ui` contract so they cannot drift again.
- The Studio entry card is rendered by `StudioLinkCard.astro` on the formal page and `renderStudioLinkCard()` in the live renderer. Keep their title, description, icon, and lack of extra badges in sync.
- Dynamic preview features must rebind after `profile-renderer:updated`. When their underlying configuration is unchanged, preserve the existing player or draw node so editing unrelated fields does not interrupt playback or clear a fortune result.
- Keep the six visible editor steps in this order: basic identity, public links, profile content, appearance, other features, and `06 完成設定`. ZIP/JSON export, import, AI JSON, reset, and local project save belong in the final step instead of the sticky header or unrelated panels.
- Requested configuration must be visible in Studio and shared with the rendered site. Wire changes through the relevant Astro content schema, answer-file validation, project writer, JSON Schema, preview bridge, documentation, and regression checks; a Studio-only field is incomplete.

## Studio data and deployment boundaries

- Browser-only drafts use `localStorage`; uploaded image blobs use IndexedDB. The public Studio must not write to GitHub, hold repository credentials, or silently upload drafts.
- Image fields accept a safe `/images/` project path or a public HTTPS URL. Uploaded files belong in `public/images/`; external URLs remain URLs. Standalone JSON does not contain uploaded image binaries, while the ZIP settings package does.
- Local project writes must remain explicit. No-op writes must preserve file mtime and avoid false Git or IDE changes.
- `ONLINE_STUDIO_MODE=auto|public|off` controls production output. `auto` requires an exact repository or site allowlist match; local development always keeps Studio available. Treat this as a build rule, not authentication.
- Do not expose the local adapter, tokens, secrets, or personal answer files in static output.

## When the user asks how to create or update their profile

Use the guided setup flow in `docs/AI_PROFILE_SETUP.md`.

1. Read `docs/profile-answers.schema.json` and `profile.answers.example.json` before asking questions.
2. Ask only for missing information. Start with the display name, then offer the optional short title, keywords, bio, social links, featured links, profile sections, playlist, and appearance choices.
3. Explain that every personal-content field except the display name is optional, including the short title, keywords, bio, location, social links, playlist, and interactive features. Never invent personal facts or URLs.
4. Convert confirmed answers to `profile.answers.json`. This file is gitignored because it can contain personal information.
5. Run `npm run profile:apply -- profile.answers.json`.
6. Run `npm run build`. Fix content validation errors, but do not redesign components unless the user explicitly requests a new visual feature.
7. Review the generated public content and Git diff. Summarize what will be public, including any location, email, employer, or private-looking URL, and tell the user they can run `npm run studio` for visual review in the unified `/studio/` interface.
8. If the user requested the end-to-end publish flow, wait for one explicit post-build confirmation before publishing. Then verify that `origin` belongs to the user rather than the upstream template, commit only the intended content and public assets, push the deployment branch (normally `main`), and report the GitHub Actions result or the exact remaining setup step.

Do not commit, push, publish, enable GitHub Actions, or change repository settings unless the user explicitly asks. Even when publishing was requested in the initial prompt, do not push before the post-build public-content summary and confirmation. Never push personal content to the upstream template repository. Never request or store GitHub passwords or personal access tokens in profile content.

## Content boundaries

- Basic identity and site-wide appearance: `src/content/profile/main.md`
- Social and featured links: `src/content/links/*.md`
- About-me cards: `src/content/sections/*.md`
- Playlist, fortune, and embeds: `src/content/blocks/*.md`
- Uploaded project images: `public/images/`; public HTTPS image URLs remain content values

Prefer the answer-file workflow for first-time setup. For a small existing-profile edit, update the relevant Markdown directly and preserve all unrelated frontmatter fields and custom files.

Supported `homeOrder` values are exactly: `about`, `turntable`, `links`, `fortune`, `notion`. Each value must appear once.

## Verification and Git habits

- On Windows, prefer `npm.cmd` and `npx.cmd` when PowerShell execution policy blocks `.ps1` shims.
- Run `npm.cmd run build` for the full verification chain. Also run `npm.cmd run check:template-defaults` when changing starter content or public template behavior.
- If Windows locks `dist` or Astro cache files with `EPERM`, do not treat that as a code failure. Run `npm.cmd exec astro check`, build to an isolated directory such as `.astro/codex-build`, then run `check:ui`, `check:profile-tools`, `check:template-safety`, `check:template-defaults`, and `git diff --check`.
- For Studio UI changes, use a real browser to verify the affected flow. Important smoke cases include interactive fortune draws, player retention, HTTPS image loading, the `06 完成設定` actions, and a 390 px mobile viewport without horizontal overflow.
- Before committing, confirm `src/content/`, `public/images/`, `profile.answers.json`, browser artifacts, and build output did not change unless they are intentionally in scope.
- Commit, push, tag, Release, and deployment are separate permissions. A request to commit authorizes the intended local commit, not push or publishing.

## Writing quality

- Match the language used by the user; default to Traditional Chinese for Chinese input.
- Preserve the user's meaning and level of formality. Offer concise revisions instead of turning every profile into marketing copy.
- When provided, keep the short title scannable, the bio personal, and card descriptions concrete.
- Ask before publishing sensitive details such as precise location, private email, phone number, employer-internal work, or private project URLs.
