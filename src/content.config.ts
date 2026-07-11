import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const profile = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/profile' }),
  schema: z.object({
    name: z.string(),
    displayName: z.string(),
    title: z.string(),
    avatar: z.string().optional(),
    background: z.string().optional(),
    location: z.string().optional(),
    archiveLabel: z.string().optional(),
    homeOrder: z.array(z.enum(['about', 'turntable', 'links', 'notion']))
      .length(4)
      .refine((items) => new Set(items).size === items.length, 'homeOrder cannot contain duplicates.')
      .default(['about', 'turntable', 'links', 'notion']),
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
    layout: z.enum(['card', 'plain', 'embed', 'turntable']).default('card'),
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

export const collections = { profile, links, sections, blocks };
