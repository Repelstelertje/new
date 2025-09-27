import { z } from "zod";
import { config } from "./config";
import { provinceToSlug } from "./provinces";

const BASE = config.api.baseUrl.replace(/\/$/, "");

const endpointTemplates = config.api.endpoints;

const endpoints = {
  popular: (limit: number) =>
    `${BASE}${endpointTemplates.popular.replace("{limit}", encodeURIComponent(String(limit)))}`,
  province: (province: string, limit: number, page: number) => {
    const slug = provinceToSlug(province);
    const path = endpointTemplates.province
      .replace("{provincie}", encodeURIComponent(slug))
      .replace("{limit}", encodeURIComponent(String(limit)));
    const url = new URL(`${BASE}${path}`);
    if (page > 1) {
      url.searchParams.set("page", String(page));
    }
    return url.toString();
  },
};

const RETRY_DELAYS = [250, 500, 1000];

async function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function fetchJson<T>(url: string): Promise<T> {
  const timeoutMs = config.api.limits?.timeoutMs ?? 8000;
  let attempt = 0;

  while (true) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const response = await fetch(url, { signal: controller.signal, headers: { Accept: "application/json" } });
      if (!response.ok) {
        throw new Error(`Request failed with status ${response.status}`);
      }
      return (await response.json()) as T;
    } catch (error) {
      if (attempt >= RETRY_DELAYS.length) {
        throw error;
      }
      await wait(RETRY_DELAYS[attempt]);
      attempt += 1;
    } finally {
      clearTimeout(timeout);
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
  img: {
    src: string;
    alt: string;
    srcset?: string;
    sizes?: string;
  };
};

function resolveImageSource(raw: z.infer<typeof imageSourceSchema>): Profile["img"] {
  if (!raw) {
    throw new Error("Afbeelding ontbreekt in profiel");
  }

  if (typeof raw === "string") {
    return { src: raw, alt: "" };
  }

  const src = raw.src ?? raw.url;
  if (!src) {
    throw new Error("Afbeelding mist src/url");
  }

  return {
    src,
    alt: raw.alt ?? "",
    srcset: raw.srcset,
    sizes: raw.sizes,
  };
}

export function appendUtm(deeplink: string, province: string, id: string | number) {
  const { base, utm, subidParam } = config.api.deeplink;
  const slug = provinceToSlug(province);

  let url: URL;
  try {
    url = new URL(deeplink, base);
  } catch {
    url = new URL(base);
  }

  const applyPlaceholders = (value: string | undefined) =>
    value?.replace("{provincie}", slug).replace("{id}", String(id));

  const utmSource = applyPlaceholders(utm?.source);
  const utmMedium = applyPlaceholders(utm?.medium);
  const utmCampaign = applyPlaceholders(utm?.campaign);

  if (utmSource) url.searchParams.set("utm_source", utmSource);
  if (utmMedium) url.searchParams.set("utm_medium", utmMedium);
  if (utmCampaign) url.searchParams.set("utm_campaign", utmCampaign);
  if (subidParam) {
    url.searchParams.set(subidParam, String(id));
  }

  return url.toString();
}

const profileSchema = rawProfileSchema.transform((raw) => {
  const age = typeof raw.age === "string" ? Number.parseInt(raw.age, 10) : raw.age;
  if (!Number.isFinite(age)) {
    throw new Error("Leeftijd is ongeldig");
  }

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
  } satisfies Profile;
});

const profilesArraySchema = z.array(profileSchema);

const numericValueSchema = z.union([z.number(), z.string()]).optional();

const profileResponseSchema = z
  .object({
    data: z
      .object({
        profiles: profilesArraySchema.optional(),
        items: profilesArraySchema.optional(),
        results: profilesArraySchema.optional(),
        count: numericValueSchema,
        total: numericValueSchema,
        totalCount: numericValueSchema,
        pages: numericValueSchema,
        pageCount: numericValueSchema,
      })
      .optional(),
    profiles: profilesArraySchema.optional(),
    items: profilesArraySchema.optional(),
    results: profilesArraySchema.optional(),
    count: numericValueSchema,
    total: numericValueSchema,
    totalCount: numericValueSchema,
    pages: numericValueSchema,
    pageCount: numericValueSchema,
  })
  .passthrough();

type ProfileResponse = z.infer<typeof profileResponseSchema>;

function extractProfiles(response: ProfileResponse) {
  return (
    response.profiles ??
    response.items ??
    response.results ??
    response.data?.profiles ??
    response.data?.items ??
    response.data?.results ??
    []
  );
}

function toNumber(value: unknown) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : undefined;
  }
  if (typeof value === "string") {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : undefined;
  }
  return undefined;
}

function extractTotal(response: ProfileResponse) {
  return (
    toNumber(response.count) ??
    toNumber(response.total) ??
    toNumber(response.totalCount) ??
    toNumber(response.data?.count) ??
    toNumber(response.data?.total) ??
    toNumber(response.data?.totalCount)
  );
}

function extractPageCount(response: ProfileResponse) {
  return (
    toNumber(response.pageCount) ??
    toNumber(response.pages) ??
    toNumber(response.data?.pageCount) ??
    toNumber(response.data?.pages)
  );
}

export async function getPopular(limit: number) {
  const url = endpoints.popular(limit);
  const json = await fetchJson<unknown>(url);
  const parsed = profileResponseSchema.parse(json);
  return extractProfiles(parsed);
}

export async function getProvince(province: string, pageSize: number, page: number) {
  const url = endpoints.province(province, pageSize, page);
  const json = await fetchJson<unknown>(url);
  const parsed = profileResponseSchema.parse(json);

  const profiles = extractProfiles(parsed);
  const totalCount = extractTotal(parsed) ?? profiles.length;
  const totalPages = extractPageCount(parsed) ?? (totalCount ? Math.max(1, Math.ceil(totalCount / pageSize)) : undefined);

  return {
    province,
    page,
    pageSize,
    profiles,
    totalCount,
    totalPages,
  };
}

export { BASE };
