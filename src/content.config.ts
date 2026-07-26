import { defineCollection } from 'astro:content';
import { file } from 'astro/loaders';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';
import { isSafeHttpUrl, isSafeImageSource, isSafeProfileUrl } from '../scripts/content-safety.mjs';
import { FORTUNE_GRADES } from '../scripts/fortune-content.mjs';
import { normalizeThemeColor } from '../scripts/theme-color.mjs';
import { parseYoutubePlaylistId } from '../scripts/youtube-playlist.mjs';

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
    displayName: z.string(),
    title: z.string().optional(),
    avatar: imageSource.optional(),
    background: imageSource.optional(),
    location: z.string().optional(),
    archiveLabel: z.string().optional(),
    homeOrder: z.array(z.enum(['about', 'turntable', 'links', 'fortune', 'notion']))
      .length(5)
      .refine((items) => new Set(items).size === items.length, 'homeOrder cannot contain duplicates.')
      .default(['about', 'turntable', 'links', 'fortune', 'notion']),
    homeVisibility: z.array(z.enum(['about', 'turntable', 'links', 'fortune', 'notion']))
      .max(5)
      .refine((items) => new Set(items).size === items.length, 'homeVisibility cannot contain duplicates.')
      .default(['about', 'turntable', 'links', 'fortune', 'notion']),
    aboutHeading: z.string().default('About me'),
    linksHeading: z.string().default('Links'),
    sectionsLayout: z.enum(['list', 'grid']).default('list'),
    bodyFont: z.enum(['system', 'noto-sans-tc', 'noto-serif-tc', 'lxgw-wenkai-tc']).default('system'),
    displayFont: z.enum(['system', 'noto-sans-tc', 'noto-serif-tc', 'lxgw-wenkai-tc']).default('system'),
    mainColor: themeColor.default('#7A58A6'),
    fontScale: z.number().min(0.9).max(1.2).default(1),
    smallTextScale: z.number().min(0.9).max(1.35).default(1),
    tagline: z.union([z.string(), z.array(z.string())]).optional(),
  }),
});

const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: z.object({
    title: z.string(),
    url: z.string().refine(isSafeProfileUrl, 'URL must use http(s), mailto, or a page anchor.'),
    icon: z.string().default('arrow'),
    group: z.enum(['social', 'main', 'featured', 'footer']),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['icon', 'card', 'compact']).default('card'),
    style: z.enum(['primary', 'normal', 'subtle']).default('normal'),
    image: imageSource.optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const sections = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sections' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    image: imageSource.optional(),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['card', 'compact']).default('card'),
    tags: z.array(z.string()).default([]),
  }),
});

const blocks = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blocks' }),
  schema: z.object({
    title: z.string(),
    placement: z.enum(['before-links', 'between-links-sections', 'after-sections']),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['card', 'plain', 'image', 'embed', 'turntable', 'fortune']).default('card'),
    provider: z.enum(['notion', 'website', 'youtube']).optional(),
    url: z.string().refine(isSafeHttpUrl, 'Embed URL must use http(s).').optional(),
    embedMode: z.enum(['preview', 'inline']).default('preview'),
    playlistId: youtubePlaylist.optional(),
    continuousPlayback: z.boolean().default(true),
    height: z.number().int().min(320).max(1200).default(600),
    image: imageSource.optional(),
    imageAlt: z.string().max(300).default(''),
    imageLayout: z.enum(['full', 'split-left', 'split-right', 'poster']).default('full'),
    imageAspect: z.enum(['auto', 'landscape', 'square', 'portrait']).default('landscape'),
    imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right', 'top-left', 'top-right', 'bottom-left', 'bottom-right']).default('center'),
    tags: z.array(z.string()).default([]),
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
