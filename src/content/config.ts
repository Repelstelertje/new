import { defineCollection, z } from "astro:content";

const tipSchema = z.object({
  title: z.string(),
  type: z.enum(["general","city"]),
  // slug is reserved by Astro; do not put it in the schema
  metaDescription: z.string().min(120).max(180),
  intro: z.string().min(100), // we valideren globaal; niet hard op 250
  city: z.string().optional(),
  province: z.string().optional(),
  profiles: z.object({
    source: z.enum(["popular","province"]),
    limit: z.number().min(3).max(24).default(9),
  }).default({ source: "popular", limit: 9 }),
  cta: z.object({
    label: z.string(),
    href: z.string(), // mag intern pad zijn
  }),
});

const datingtips = defineCollection({
  type: "content",
  schema: tipSchema,
});

export const collections = { datingtips };
