import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { isSafeHttpUrl, isSafeImageSource, isSafeProfileUrl } from '../scripts/content-safety.mjs';
import { contentText, contentTextArray, contentTextMax } from '../scripts/content-text-schema.mjs';
import { FORTUNE_GRADES } from '../scripts/fortune-content.mjs';
import { normalizeThemeColor } from '../scripts/theme-color.mjs';
import { parseYoutubePlaylistId } from '../scripts/youtube-playlist.mjs';
import { APPEARANCE_DEFAULTS, APPEARANCE_RANGES, EMBED_URL_MAX_LENGTH } from '../scripts/profile-contract.mjs';

const imageSource = z.string().refine(
  isSafeImageSource,
  'Images must use a safe path under /images/ or a public HTTPS URL.',
);
const youtubePlaylist = z.string()
  .refine((value) => Boolean(parseYoutubePlaylistId(value)), 'Invalid YouTube playlist URL or ID.')
  .transform((value) => parseYoutubePlaylistId(value) ?? value);
const themeColor = z.string()
  .refine((value) => Boolean(normalizeThemeColor(value)), 'Main color must be a 3 or 6 digit hex color.')
  .transform((value) => normalizeThemeColor(value) ?? value);

const profile = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/profile' }),
  schema: z.object({
    displayName: contentText,
    title: contentText.optional(),
    avatar: imageSource.optional(),
    background: imageSource.optional(),
    location: contentText.optional(),
    // Backward compatibility only. Profiles created before the cover-label removal may still contain it.
    archiveLabel: contentText.optional(),
    homeOrder: z.array(z.enum(['about', 'turntable', 'links', 'fortune', 'notion']))
      .length(5)
      .refine((items) => new Set(items).size === items.length, 'homeOrder cannot contain duplicates.')
      .default(['about', 'turntable', 'links', 'fortune', 'notion']),
    homeVisibility: z.array(z.enum(['about', 'turntable', 'links', 'fortune', 'notion']))
      .max(5)
      .refine((items) => new Set(items).size === items.length, 'homeVisibility cannot contain duplicates.')
      .default(['about', 'turntable', 'links', 'fortune', 'notion']),
    aboutHeading: contentText.default('About me'),
    linksHeading: contentText.default('Links'),
    sectionsLayout: z.enum(['list', 'grid']).default(APPEARANCE_DEFAULTS.sectionsLayout),
    bodyFont: z.enum(['system', 'noto-sans-tc', 'noto-serif-tc', 'lxgw-wenkai-tc']).default(APPEARANCE_DEFAULTS.bodyFont),
    displayFont: z.enum(['system', 'noto-sans-tc', 'noto-serif-tc', 'lxgw-wenkai-tc']).default(APPEARANCE_DEFAULTS.displayFont),
    mainColor: themeColor.default(APPEARANCE_DEFAULTS.mainColor),
    fontScale: z.number().min(APPEARANCE_RANGES.fontScale.minimum).max(APPEARANCE_RANGES.fontScale.maximum).default(APPEARANCE_DEFAULTS.fontScale),
    smallTextScale: z.number().min(APPEARANCE_RANGES.smallTextScale.minimum).max(APPEARANCE_RANGES.smallTextScale.maximum).default(APPEARANCE_DEFAULTS.smallTextScale),
    tagline: z.union([contentText, contentTextArray]).optional(),
  }),
});

const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: z.object({
    title: contentText,
    url: z.string().refine(isSafeProfileUrl, 'URL must use http(s), mailto, or a page anchor.'),
    icon: z.string().default('arrow'),
    group: z.enum(['social', 'main', 'featured', 'footer']),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['icon', 'card', 'compact']).default('card'),
    style: z.enum(['primary', 'normal', 'subtle']).default('normal'),
    image: imageSource.optional(),
    tags: contentTextArray.optional(),
  }),
});

const sections = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sections' }),
  schema: z.object({
    title: contentText,
    slug: z.string(),
    image: imageSource.optional(),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['card', 'compact']).default('card'),
    tags: contentTextArray.default([]),
  }),
});

const blocks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blocks' }),
  schema: z.object({
    title: contentText,
    placement: z.enum(['before-links', 'between-links-sections', 'after-sections']),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['card', 'plain', 'image', 'embed', 'turntable', 'fortune']).default('card'),
    provider: z.enum(['notion', 'website', 'youtube']).optional(),
    url: z.string().max(EMBED_URL_MAX_LENGTH).refine(isSafeHttpUrl, 'Embed URL must use http(s).').optional(),
    embedMode: z.enum(['preview', 'inline']).default('preview'),
    playlistId: youtubePlaylist.optional(),
    continuousPlayback: z.boolean().default(true),
    height: z.number().int().min(320).max(1200).default(600),
    image: imageSource.optional(),
    imageAlt: contentTextMax(300).default(''),
    imageLayout: z.enum(['full', 'split-left', 'split-right', 'poster']).default('full'),
    imageAspect: z.enum(['auto', 'landscape', 'square', 'portrait']).default('landscape'),
    imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).default('center'),
    tags: contentTextArray.default([]),
  }).superRefine((data, context) => {
    if (data.layout === 'image' && !data.image) {
      context.addIssue({
        code: 'custom',
        path: ['image'],
        message: 'Image blocks require an image path.',
      });
    }
    if (data.layout === 'embed' && !data.url) {
      context.addIssue({
        code: 'custom',
        path: ['url'],
        message: 'Embed blocks require a public URL.',
      });
    }
    if (data.layout === 'turntable' && data.provider !== 'youtube') {
      context.addIssue({
        code: 'custom',
        path: ['provider'],
        message: 'Turntable blocks require provider: youtube.',
      });
    }
    if (data.layout === 'turntable' && !data.playlistId) {
      context.addIssue({
        code: 'custom',
        path: ['playlistId'],
        message: 'Turntable blocks require a YouTube playlist ID.',
      });
    }
  }),
});

const fortunes = defineCollection({
  loader: file('src/content/fortunes.json'),
  schema: z.object({
    grade: z.enum(FORTUNE_GRADES),
    category: z.enum(['blessing', 'joke']),
    message: z.string().trim().min(1, 'Fortune messages cannot be empty.'),
    note: z.string().trim().min(1).optional(),
    visible: z.boolean().default(true),
  }),
});

export const collections = { profile, links, sections, blocks, fortunes };
