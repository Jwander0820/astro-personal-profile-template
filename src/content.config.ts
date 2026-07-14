import { defineCollection, z } from 'astro:content';
import { file } from 'astro/loaders';
import { glob } from 'astro/loaders';

const profile = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/profile' }),
  schema: z.object({
    displayName: z.string(),
    title: z.string(),
    avatar: z.string().optional(),
    background: z.string().optional(),
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
    fontScale: z.number().min(0.9).max(1.2).default(1),
    smallTextScale: z.number().min(0.9).max(1.35).default(1),
    tagline: z.union([z.string(), z.array(z.string()).min(1)]),
  }),
});

const links = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/links' }),
  schema: z.object({
    title: z.string(),
    url: z.string(),
    icon: z.string().default('arrow'),
    group: z.enum(['social', 'main', 'featured', 'footer']),
    order: z.number().default(100),
    visible: z.boolean().default(true),
    layout: z.enum(['icon', 'card', 'compact']).default('card'),
    style: z.enum(['primary', 'normal', 'subtle']).default('normal'),
    image: z.string().optional(),
    tags: z.array(z.string()).optional(),
  }),
});

const sections = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/sections' }),
  schema: z.object({
    title: z.string(),
    slug: z.string(),
    image: z.string().optional(),
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
    layout: z.enum(['card', 'plain', 'embed', 'turntable', 'fortune']).default('card'),
    provider: z.enum(['notion', 'youtube']).optional(),
    url: z.string().url().optional(),
    embedMode: z.enum(['preview', 'inline']).default('preview'),
    playlistId: z.string().regex(/^[A-Za-z0-9_-]{10,}$/, 'Invalid YouTube playlist ID.').optional(),
    continuousPlayback: z.boolean().default(true),
    height: z.number().int().min(320).max(1200).default(600),
    image: z.string().optional(),
    tags: z.array(z.string()).default([]),
  }).superRefine((data, context) => {
    if (data.layout === 'embed' && !data.url) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['url'],
        message: 'Embed blocks require a public URL.',
      });
    }
    if (data.layout === 'turntable' && data.provider !== 'youtube') {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['provider'],
        message: 'Turntable blocks require provider: youtube.',
      });
    }
    if (data.layout === 'turntable' && !data.playlistId) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['playlistId'],
        message: 'Turntable blocks require a YouTube playlist ID.',
      });
    }
  }),
});

const fortunes = defineCollection({
  loader: file('src/content/fortunes.json'),
  schema: z.object({
    grade: z.enum(['大吉', '中吉', '小吉']),
    category: z.enum(['blessing', 'joke']),
    message: z.string().trim().min(1, 'Fortune messages cannot be empty.'),
    note: z.string().trim().min(1).optional(),
    visible: z.boolean().default(true),
  }),
});

export const collections = { profile, links, sections, blocks, fortunes };
