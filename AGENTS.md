# Personal profile setup instructions

This repository is an Astro personal-profile template. Markdown under `src/content/` is the source of truth for both the website and the local Profile Studio.

## When the user asks how to create or update their profile

Use the guided setup flow in `docs/AI_PROFILE_SETUP.md`.

1. Read `docs/profile-answers.schema.json` and `profile.answers.example.json` before asking questions.
2. Ask only for missing information. Start with identity, then offer optional social links, featured links, profile sections, playlist, and appearance choices.
3. Explain that location, social links, playlist, and interactive features are optional. Never invent personal facts or URLs.
4. Convert confirmed answers to `profile.answers.json`. This file is gitignored because it can contain personal information.
5. Run `npm run profile:apply -- profile.answers.json`.
6. Run `npm run build`. Fix content validation errors, but do not redesign components unless the user explicitly requests a new visual feature.
7. Summarize the generated content and tell the user to run `npm run studio` for visual review.

Do not commit, push, publish, enable GitHub Actions, or change repository settings unless the user explicitly asks. Never request or store GitHub passwords or personal access tokens in profile content.

## Content boundaries

- Basic identity and site-wide appearance: `src/content/profile/main.md`
- Social and featured links: `src/content/links/*.md`
- About-me cards: `src/content/sections/*.md`
- Playlist, fortune, and embeds: `src/content/blocks/*.md`
- Images: `public/images/`

Prefer the answer-file workflow for first-time setup. For a small existing-profile edit, update the relevant Markdown directly and preserve all unrelated frontmatter fields and custom files.

Supported `homeOrder` values are exactly: `about`, `turntable`, `links`, `fortune`, `notion`. Each value must appear once.

## Writing quality

- Match the language used by the user; default to Traditional Chinese for Chinese input.
- Preserve the user's meaning and level of formality. Offer concise revisions instead of turning every profile into marketing copy.
- Keep the short title scannable, the bio personal, and card descriptions concrete.
- Ask before publishing sensitive details such as precise location, private email, phone number, employer-internal work, or private project URLs.
