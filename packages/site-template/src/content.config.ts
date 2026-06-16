import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const pages = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/pages' }),
  schema: z.object({
    title: z.string().min(1).max(70),
    description: z.string().min(1).max(160),
    keywords: z.array(z.string()).default([]),
    ogImage: z.string().optional(),
    role: z.enum(['home', 'about', 'services', 'contact', 'page']).default('page'),
    draft: z.boolean().default(false),
    order: z.number().default(0),
  }),
});

export const collections = { pages };
