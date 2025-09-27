import { z } from "zod";
import { config } from "./config";

const BASE = config.api.baseUrl.replace(/\/$/, "");
const endpointTemplates = config.api.endpoints;

const endpoints = {
  popular: (limit: number) =>
    `${BASE}${endpointTemplates.popular.replace("{limit}", encodeURIComponent(String(limit)))}`,
  // Belangrijk: API verwacht exacte provincienaam (hoofdlettergevoelig), GEEN slug.
  province: (province: string, limit: number, page: number) => {
    const path = endpointTemplates.province
      .replace("{provincie}", encodeURIComponent(province))
      .replace("{limit}", encodeURIComponent(String(limit)));
    const url = new URL(`${BASE}${path}`);
    if (page > 1) url.searchParams.set("page", String(page));
    return url.toString();
  },
};

const RETRY_DELAYS = [250, 500, 1000];
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchJson<T>(url: string): Promise<T> {
  const timeoutMs = config.api.limits?.timeoutMs ?? 8000;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const ct = res.headers.get("content-type") || "";
      if (!ct.includes("application/json")) {
        // Non-JSON respons (bv. "Onkende provincie") → geef leeg object terug
        return {} as T;
      }
      return (await res.json()) as T;
    } catch (e) {
      if (attempt >= RETRY_DELAYS.length) return {} as T;
      await wait(RETRY_DELAYS[attempt++]);
    } finally {
      clearTimeout(t);
    }
  }
}

const imageSourceSchema = z
  .union([
    z.string().min(1),
    z
      .object({
        src: z.string().optional(),
        url: z.string().optional(),
        alt: z.string().optional(),
        srcset: z.string().optional(),
        sizes: z.string().optional(),
      })
      .passthrough(),
  ])
  .optional();

const rawProfileSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    age: z.union([z.number(), z.string()]),
    province: z.string(),
    description: z.string().optional(),
    deeplink: z.string().optional(),
    url: z.string().optional(),
    link: z.string().optional(),
    image: imageSourceSchema,
    avatar: imageSourceSchema,
    picture: imageSourceSchema,
    images: z.array(imageSourceSchema).optional(),
    img: imageSourceSchema,
  })
  .passthrough();

export type Profile = {
  id: string;
  name: string;
  age: number;
  province: string;
  description?: string;
  deeplink: string;
  img: { src: string; alt: string; srcset?: string; sizes?: string };
};

function resolveImageSource(raw: z.infer<typeof imageSourceSchema>): Profile["img"] {
  if (!raw) throw new Error("Afbeelding ontbreekt");
  if (typeof raw === "string") return { src: raw, alt: "" };
  const src = raw.src ?? raw.url;
  if (!src) throw new Error("Afbeelding mist src/url");
  return { src, alt: raw.alt ?? "", srcset: raw.srcset, sizes: raw.sizes };
}

function appendUtm(deeplink: string, province: string, id: string | number) {
  const { base, utm, subidParam } = config.api.deeplink;
  let url: URL;
  try {
    url = new URL(deeplink, base);
  } catch {
    url = new URL(base);
  }
  const rep = (v?: string) => v?.replace("{provincie}", province).replace("{id}", String(id));
  const src = rep(utm?.source);
  const med = rep(utm?.medium);
  const camp = rep(utm?.campaign);
  if (src) url.searchParams.set("utm_source", src);
  if (med) url.searchParams.set("utm_medium", med);
  if (camp) url.searchParams.set("utm_campaign", camp);
  if (subidParam) url.searchParams.set(subidParam, String(id));
  return url.toString();
}

const profileSchema = rawProfileSchema.transform((raw) => {
  const age = typeof raw.age === "string" ? Number.parseInt(raw.age, 10) : raw.age;
  if (!Number.isFinite(age)) throw new Error("Leeftijd ongeldig");
  const deeplink = raw.deeplink ?? raw.url ?? raw.link ?? config.api.deeplink.base;
  const imageSource =
    raw.image ?? raw.avatar ?? raw.picture ?? raw.img ?? raw.images?.find((img): img is NonNullable<typeof img> => Boolean(img));
  return {
    id: String(raw.id),
    name: raw.name,
    age,
    province: raw.province,
    description: raw.description,
    deeplink: appendUtm(deeplink, raw.province, raw.id),
    img: resolveImageSource(imageSource),
  } as Profile;
});

const profilesArraySchema = z.array(profileSchema);
const numeric = z.union([z.number(), z.string()]).optional();

const profileResponseSchema = z
  .object({
    data: z
      .object({
        profiles: profilesArraySchema.optional(),
        items: profilesArraySchema.optional(),
        results: profilesArraySchema.optional(),
        count: numeric,
        total: numeric,
        totalCount: numeric,
        pages: numeric,
        pageCount: numeric,
      })
      .optional(),
    profiles: profilesArraySchema.optional(),
    items: profilesArraySchema.optional(),
    results: profilesArraySchema.optional(),
    count: numeric,
    total: numeric,
    totalCount: numeric,
    pages: numeric,
    pageCount: numeric,
  })
  .passthrough();

type ProfileResponse = z.infer<typeof profileResponseSchema>;

function extractProfiles(r: ProfileResponse) {
  return r.profiles ?? r.items ?? r.results ?? r.data?.profiles ?? r.data?.items ?? r.data?.results ?? [];
}
function toNum(v: unknown) {
  if (typeof v === "number") return Number.isFinite(v) ? v : undefined;
  if (typeof v === "string") {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : undefined;
  }
}
function extractTotal(r: ProfileResponse) {
  return toNum(r.count) ?? toNum(r.total) ?? toNum(r.totalCount) ?? toNum(r.data?.count) ?? toNum(r.data?.total) ?? toNum(r.data?.totalCount);
}
function extractPageCount(r: ProfileResponse) {
  return toNum(r.pageCount) ?? toNum(r.pages) ?? toNum(r.data?.pageCount) ?? toNum(r.data?.pages);
}

export async function getPopular(limit: number) {
  const json = await fetchJson<unknown>(endpoints.popular(limit));
  const parsed = profileResponseSchema.safeParse(json);
  if (!parsed.success) return [];
  return extractProfiles(parsed.data);
}

export async function getProvince(province: string, pageSize: number, page: number) {
  try {
    const json = await fetchJson<unknown>(endpoints.province(province, pageSize, page));
    const parsed = profileResponseSchema.safeParse(json);
    if (!parsed.success) {
      return { province, page, pageSize, profiles: [], totalCount: 0, totalPages: 1 };
    }
    const profiles = extractProfiles(parsed.data);
    const totalCount = extractTotal(parsed.data) ?? profiles.length;
    const totalPages = extractPageCount(parsed.data) ?? Math.max(1, Math.ceil((totalCount || 0) / pageSize));
    return { province, page, pageSize, profiles, totalCount, totalPages };
  } catch {
    return { province, page, pageSize, profiles: [], totalCount: 0, totalPages: 1 };
  }
}

export { BASE };
