import { z } from "zod";
import { config } from "./config";
import { canonicalProvince } from "./provinces";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const FALLBACK_IMG = "/img/fallback.svg";

const BASE = config.api.baseUrl.replace(/\/$/, "");
const endpointTemplates = config.api.endpoints;

// ---- endpoint helpers ----
export const endpoints = {
  popular: (limit: number) =>
    `${BASE}${endpointTemplates.popular.replace("{limit}", encodeURIComponent(String(limit)))}`,
  province: (province: string, limit: number, page: number) => {
    // API wil exacte casing zoals "Drenthe", "Noord-Holland"
    const canonical = canonicalProvince(province);
    const path = endpointTemplates.province
      .replace("{provincie}", encodeURIComponent(canonical))
      .replace("{limit}", encodeURIComponent(String(limit)));
    const url = new URL(`${BASE}${path}`);
    if (page > 1) url.searchParams.set("page", String(page));
    return url.toString();
  },
};

// ---- tiny fetch helpers ----
async function fetchText(url: string, timeoutMs = config.api.limits?.timeoutMs ?? 8000) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json,*/*" } });
    const text = await res.text(); // pak *altijd* tekst eerst
    if (!res.ok) throw new Error(`HTTP ${res.status}: ${text.slice(0, 140)}`);
    return text;
  } finally {
    clearTimeout(t);
  }
}

async function fetchJson<T>(url: string): Promise<T> {
  const text = await fetchText(url);
  return JSON.parse(text) as T;
}

// Schrijf naar public/_debug én dist/_debug
function debugDump(provinceSlug: string, page: number, body: string) {
  const files = [
    join(process.cwd(), "public", "_debug", `province-${provinceSlug}-p${page}.txt`),
    join(process.cwd(), "dist", "_debug", `province-${provinceSlug}-p${page}.txt`),
  ];
  for (const file of files) {
    try {
      mkdirSync(join(file, ".."), { recursive: true });
      writeFileSync(file, body, "utf8");
    } catch {
      // stil falen; alleen diagnostisch
    }
  }
}

// ---- zod schemas (tolerant) ----
const imageSourceSchema = z
  .union([
    z.string().min(1),
    z.object({
      src: z.string().optional(),
      url: z.string().optional(),
      alt: z.string().optional(),
      srcset: z.string().optional(),
      sizes: z.string().optional(),
    }).passthrough(),
  ])
  .optional();

const rawProfileSchema = z
  .object({
    id: z.union([z.string(), z.number()]),
    name: z.string(),
    age: z.union([z.number(), z.string()]),
    province: z.string().optional().default(""),
    city: z.string().optional(),
    description: z.string().optional(),
    aboutme: z.string().optional(),
    deeplink: z.string().optional(),
    url: z.string().optional(),
    link: z.string().optional(),
    // image gerelateerde velden
    src: z.string().optional(),
    picture_url: z.string().optional(),
    basename: z.string().optional(),
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
  city?: string;
  relationship?: string;
  height?: string;
  description?: string;
  deeplink: string;
  img: {
    src: string;
    alt: string;
    srcset?: string;
    sizes?: string;
  };
};

function resolveImageSource(raw: z.infer<typeof imageSourceSchema>): Profile["img"] {
  if (!raw) return { src: FALLBACK_IMG, alt: "" };
  if (typeof raw === "string") return { src: raw, alt: "" };
  const src = raw.src ?? raw.url ?? FALLBACK_IMG;
  return { src, alt: raw.alt ?? "", srcset: raw.srcset, sizes: raw.sizes };
}

function coerceNumber(n: unknown): number | undefined {
  if (typeof n === "number" && Number.isFinite(n)) return n;
  if (typeof n === "string") {
    const p = parseInt(n, 10);
    if (Number.isFinite(p)) return p;
  }
  return undefined;
}

// TOLERANTE respons: kan array of object met diverse velden zijn
const responseObjectSchema = z.object({
  data: z.any().optional(),
  profiles: z.any().optional(),
  items: z.any().optional(),
  results: z.any().optional(),
  count: z.union([z.number(), z.string()]).optional(),
  total: z.union([z.number(), z.string()]).optional(),
  totalCount: z.union([z.number(), z.string()]).optional(),
  pages: z.union([z.number(), z.string()]).optional(),
  pageCount: z.union([z.number(), z.string()]).optional(),
}).passthrough();

const profileSchema = rawProfileSchema.transform((raw) => {
  const age = typeof raw.age === "string" ? Number.parseInt(raw.age, 10) : raw.age;
  if (!Number.isFinite(age)) {
    throw new Error("Leeftijd is ongeldig");
  }

  const deeplink = raw.deeplink ?? raw.url ?? raw.link ?? config.api.deeplink.base;

  const imageSource =
    raw.image ??
    raw.avatar ??
    raw.picture ??
    raw.img ??
    raw.images?.find((img): img is NonNullable<typeof img> => Boolean(img));

  // Extra velden uit API mappen
  const description =
    (raw as any).description ??
    (raw as any).aboutme ??
    (raw as any).bio ??
    undefined;

  const city = (raw as any).city ?? undefined;
  const relationship = (raw as any).relationship ?? undefined;
  const height = (raw as any).length ?? undefined;

  return {
    id: String(raw.id),
    name: raw.name,
    age,
    province: raw.province,
    city,
    relationship,
    height,
    description,
    deeplink: appendUtm(deeplink, raw.province, raw.id),
    img: resolveImageSource(imageSource),
  } satisfies Profile;
});

const profileResponseSchema = z.union([z.array(z.unknown()), responseObjectSchema]);

type ProfileResponse = z.infer<typeof profileResponseSchema>;

function isProfileResponseObject(value: ProfileResponse): value is z.infer<typeof responseObjectSchema> {
  return !Array.isArray(value);
}

function extractProfilesFlexible(json: unknown): z.infer<typeof rawProfileSchema>[] {
  // 1) kale array
  if (Array.isArray(json)) return json as any[];

  // 2) object -> vind array veld
  const obj = responseObjectSchema.safeParse(json);
  if (!obj.success) return [];

  const src =
    (obj.data?.profiles ?? obj.data?.items ?? obj.data?.results) ??
    obj.data ??
    obj.value.profiles ??
    obj.value.items ??
    obj.value.results;

  if (Array.isArray(src)) return src as any[];
  // fallback: geen array gevonden
  return [];
}

function extractTotalsFlexible(json: unknown, pageSize: number) {
  if (Array.isArray(json)) {
    return { totalCount: json.length, totalPages: Math.max(1, Math.ceil(json.length / pageSize)) };
  }
  const obj = responseObjectSchema.safeParse(json);
  if (!obj.success) return { totalCount: undefined, totalPages: undefined };

  const totalCount =
    coerceNumber(obj.value.totalCount) ??
    coerceNumber(obj.value.total) ??
    coerceNumber(obj.value.count) ??
    coerceNumber(obj.value.data?.totalCount) ??
    coerceNumber(obj.value.data?.total) ??
    coerceNumber(obj.value.data?.count);

  const totalPages =
    coerceNumber(obj.value.pageCount) ??
    coerceNumber(obj.value.pages) ??
    coerceNumber(obj.value.data?.pageCount) ??
    coerceNumber(obj.value.data?.pages) ??
    (totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : undefined);

  return { totalCount, totalPages };
}

function extractProfiles(data: ProfileResponse): Profile[] {
  const rawProfiles = extractProfilesFlexible(data);
  const profiles: Profile[] = [];
  for (const raw of rawProfiles) {
    try {
      profiles.push(toProfile(raw));
    } catch (err) {
      console.warn("[API] Ongeldig profiel overgeslagen", err, raw);
    }
  }
  return profiles;
}

function extractTotal(data: ProfileResponse): number | undefined {
  if (Array.isArray(data)) return data.length;
  if (!isProfileResponseObject(data)) return undefined;

  return (
    coerceNumber(data.totalCount) ??
    coerceNumber(data.total) ??
    coerceNumber(data.count) ??
    coerceNumber((data.data as any)?.totalCount) ??
    coerceNumber((data.data as any)?.total) ??
    coerceNumber((data.data as any)?.count)
  );
}

function extractPageCount(data: ProfileResponse): number | undefined {
  if (Array.isArray(data)) return undefined;
  if (!isProfileResponseObject(data)) return undefined;

  return (
    coerceNumber(data.pageCount) ??
    coerceNumber(data.pages) ??
    coerceNumber((data.data as any)?.pageCount) ??
    coerceNumber((data.data as any)?.pages)
  );
}

export function appendUtm(deeplink: string, province: string, id: string | number) {
  const { base, deeplink: dl } = { base: (config.api.deeplink?.base || '').trim(), deeplink: config.api.deeplink };
  // vaste affiliate/bron-params (geen UTM, geen subid)
  const refParam = dl?.extraParams?.refParam ?? 'ref';
  const refValue = dl?.extraParams?.refValue ?? '32';
  const sourceParam = dl?.extraParams?.sourceParam ?? 'source';
  const subsourceParam = dl?.extraParams?.subsourceParam ?? 'subsource';

  // source = sitenaam gesimplificeerd (lowercase, spaties weg, non-alnum weg)
  const siteSource =
    config.site?.name
      ?.toLowerCase()
      .replace(/\s+/g, '')
      .replace(/[^a-z0-9-]/g, '') || 'site';

  let url: URL;
  try {
    url = new URL(deeplink, base || undefined);
  } catch {
    url = new URL(base || 'https://example.com/');
  }

  // Alleen deze 3 params zetten/overschrijven
  url.searchParams.set(refParam, refValue);
  url.searchParams.set(sourceParam, siteSource);
  url.searchParams.set(subsourceParam, String(id));

  return url.toString();
}

// ---- Public API ----
export async function getPopular(limit: number) {
  const url = endpoints.popular(limit);
  const text = await fetchText(url);
  const json = JSON.parse(text);
  const raw = extractProfilesFlexible(json);
  return raw.map((r: any) => toProfile(r));
}

export async function getProvince(province: string, pageSize: number, page: number) {
  try {
    const url = endpoints.province(province, pageSize, page);
    const json = await fetchJson<unknown>(url);
    const parsed = profileResponseSchema.safeParse(json);

    if (!parsed.success) {
      console.warn(`[API] Ongeldige response voor provincie=${province} page=${page}`, parsed.error);
      return {
        province,
        page,
        pageSize,
        profiles: [],
        totalCount: 0,
        totalPages: 1,
      };
    }

    const data = parsed.data;
    const profiles = extractProfiles(data);
    const totalCount = extractTotal(data) ?? profiles.length ?? 0;
    const totalPages =
      extractPageCount(data) ?? (totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : 1);

    return {
      province,
      page,
      pageSize,
      profiles,
      totalCount,
      totalPages,
    };
  } catch (err) {
    console.error(`[API] Fout bij ophalen provincie=${province} page=${page}:`, err);
    return {
      province,
      page,
      pageSize,
      profiles: [],
      totalCount: 0,
      totalPages: 1,
    };
  }
}

// normalise 1 profiel
function toProfile(raw: z.infer<typeof rawProfileSchema>): Profile {
  return profileSchema.parse(raw);
}

export { BASE };
