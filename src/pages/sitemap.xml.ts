import type { APIRoute } from "astro";
import { config } from "../lib/config";
import { PROVINCES, provinceToSlug } from "../lib/provinces";
import { getProvince } from "../lib/api";

export const prerender = true;

const CHANGE_FREQUENCY = "daily";
const HOME_PRIORITY = "0.8";
const PROVINCE_PRIORITY = "0.7";
const PAGINATED_PRIORITY = "0.5";

function normaliseBaseUrl(url: string) {
  return url.replace(/\/$/, "");
}

function absoluteUrl(base: string, path: string) {
  if (path === "/") return `${base}/`;
  return `${base}${path}`;
}

export const GET: APIRoute = async () => {
  const baseUrl = normaliseBaseUrl(config.site.canonicalBase ?? "");
  const pageSize = config.api.limits?.pageSize ?? 60;

  const urls: Array<{ loc: string; priority: string }> = [
    { loc: absoluteUrl(baseUrl, "/"), priority: HOME_PRIORITY },
    { loc: absoluteUrl(baseUrl, "/dating-nederland/"), priority: PROVINCE_PRIORITY },
  ];

  const provinceEntries = await Promise.all(
    PROVINCES.map(async (provinceName) => {
      const slug = provinceToSlug(provinceName);
      const firstPage = await getProvince(provinceName, pageSize, 1);
      const totalPages = Math.max(1, firstPage.totalPages ?? 1);
      return { slug, totalPages };
    })
  );

  for (const { slug, totalPages } of provinceEntries) {
    const basePath = `/dating-${slug}/`;
    urls.push({ loc: absoluteUrl(baseUrl, basePath), priority: PROVINCE_PRIORITY });

    for (let page = 2; page <= totalPages; page++) {
      const pagePath = `${basePath}page/${page}/`;
      urls.push({ loc: absoluteUrl(baseUrl, pagePath), priority: PAGINATED_PRIORITY });
    }
  }

  const body = `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        ({ loc, priority }) =>
          `  <url>\n    <loc>${loc}</loc>\n    <changefreq>${CHANGE_FREQUENCY}</changefreq>\n    <priority>${priority}</priority>\n  </url>`
      )
      .join("\n") +
    "\n</urlset>\n";

  return new Response(body, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
    },
  });
};
