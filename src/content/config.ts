import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blogSchema = z.object({
  title: z.string(),
  description: z.string(),
  pubDate: z.coerce.date(),
});

const blogDe = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog/de' }),
  schema: blogSchema,
});

const blogEn = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/blog/en' }),
  schema: blogSchema,
});

export const collections = {
  'blog-de': blogDe,
  'blog-en': blogEn,
};
