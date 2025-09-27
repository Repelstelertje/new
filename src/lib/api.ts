import { z } from "zod";
import { config } from "./config";
import { provinceToSlug } from "./provinces";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const BASE = config.api.baseUrl.replace(/\/$/, "");
const endpointTemplates = config.api.endpoints;

// ---- endpoint helpers ----
export const endpoints = {
  popular: (limit: number) =>
    `${BASE}${endpointTemplates.popular.replace("{limit}", encodeURIComponent(String(limit)))}`,
  province: (province: string, limit: number, page: number) => {
    const slug = provinceToSlug(province);
    const path = endpointTemplates.province
      .replace("{provincie}", encodeURIComponent(slug))
      .replace("{limit}", encodeURIComponent(String(limit)));
    // Sommige APIs ondersteunen ?page, andere niet; alleen toevoegen >1
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

function debugDump(provinceSlug: string, page: number, body: string) {
  try {
    const dir = join(process.cwd(), "public", "_debug");
    mkdirSync(dir, { recursive: true });
    const file = join(dir, `province-${provinceSlug}-p${page}.txt`);
    writeFileSync(file, body, "utf8");
  } catch {
    // zwijgend falen; alleen voor diagnosetool
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

const rawProfileSchema = z.object({
  id: z.union([z.string(), z.number()]),
  name: z.string().optional(),
  age: z.union([z.number(), z.string()]).optional(),
  province: z.string().optional(),
  description: z.string().optional(),
  deeplink: z.string().optional(),
  url: z.string().optional(),
  link: z.string().optional(),
  image: imageSourceSchema,
  avatar: imageSourceSchema,
  picture: imageSourceSchema,
  images: z.array(imageSourceSchema).optional(),
  img: imageSourceSchema,
}).passthrough();

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
  if (!raw) return { src: "/favicon.svg", alt: "" };
  if (typeof raw === "string") return { src: raw, alt: "" };
  const src = raw.src ?? raw.url ?? "/favicon.svg";
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

export function appendUtm(deeplink: string, province: string, id: string | number) {
  const { base, utm, subidParam } = config.api.deeplink;
  const slug = provinceToSlug(province);
  let url: URL;
  try { url = new URL(deeplink, base); } catch { url = new URL(base); }
  const repl = (v?: string) => v?.replace("{provincie}", slug).replace("{id}", String(id));
  const s = repl(utm?.source); const m = repl(utm?.medium); const c = repl(utm?.campaign);
  if (s) url.searchParams.set("utm_source", s);
  if (m) url.searchParams.set("utm_medium", m);
  if (c) url.searchParams.set("utm_campaign", c);
  if (subidParam) url.searchParams.set(subidParam, String(id));
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
  const slug = provinceToSlug(province);
  const url = endpoints.province(province, pageSize, page);

  const text = await fetchText(url);
  debugDump(slug, page, text); // <<< schrijf naar public/_debug/…

  let json: unknown;
  try { json = JSON.parse(text); } catch { json = []; } // als geen JSON: leeg (maar debug staat op schijf)

  const raw = extractProfilesFlexible(json);
  const profiles = raw.map((r: any) => toProfile(r));
  const totals = extractTotalsFlexible(json, pageSize);

  return {
    province,
    page,
    pageSize,
    profiles,
    totalCount: totals.totalCount ?? profiles.length,
    totalPages: totals.totalPages ?? 1,
  };
}

// normalise 1 profiel
function toProfile(raw: z.infer<typeof rawProfileSchema>): Profile {
  const safe = rawProfileSchema.parse(raw);
  const id = String(safe.id ?? "");
  const name = (safe as any).name ?? "Anoniem";
  const age = coerceNumber((safe as any).age) ?? 18;
  const province = (safe as any).province ?? "";
  const deeplink = appendUtm(safe.deeplink ?? safe.url ?? safe.link ?? config.api.deeplink.base, province, id);
  const img = resolveImageSource(safe.image ?? safe.avatar ?? safe.picture ?? safe.img ?? safe.images?.[0]);
  return { id, name, age, province, description: safe.description, deeplink, img };
}

export { BASE };
