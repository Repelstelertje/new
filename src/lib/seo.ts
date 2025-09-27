import { config } from "./config";

type TemplateVars = Record<string, string | number>;

type TitlePage = keyof typeof config.seo.title;
type DescriptionPage = keyof typeof config.seo.description;

function applyTemplate(template: string | undefined, vars: TemplateVars = {}) {
  if (!template) {
    return undefined;
  }

  const mergedVars = { brand: config.site.name, ...vars };

  return template.replace(/\{(.*?)\}/g, (_, key: string) => {
    const value = mergedVars[key.trim()];

    return value !== undefined ? String(value) : "";
  });
}

export function buildTitle(page: TitlePage, vars: TemplateVars = {}) {
  return applyTemplate(config.seo.title[page], vars);
}

export function buildDescription(page: DescriptionPage, vars: TemplateVars = {}) {
  return applyTemplate(config.seo.description[page], vars);
}

export function canonical(path?: string) {
  if (!config.seo.canonical) {
    return undefined;
  }

  const base = config.site.canonicalBase.replace(/\/$/, "");
  if (!path) {
    return base;
  }

  return path.startsWith("/") ? `${base}${path}` : `${base}/${path}`;
}

export function robots(staging: boolean) {
  if (staging) {
    return "noindex,nofollow";
  }

  const { index, follow } = config.seo.robots;
  const directives = [index ? "index" : "noindex", follow ? "follow" : "nofollow"];

  return directives.join(",");
}

export function jsonld<T extends Record<string, unknown>>(type: string, data: T) {
  return {
    "@context": "https://schema.org",
    "@type": type,
    ...data,
  };
}

export const ORG_JSONLD = jsonld("Organization", {
  name: config.site.name,
  url: config.site.canonicalBase,
  sameAs: [config.site.canonicalBase],
});

export const WEBSITE_JSONLD = jsonld("WebSite", {
  name: config.site.name,
  url: config.site.canonicalBase,
  potentialAction: {
    "@type": "SearchAction",
    target: `${config.site.canonicalBase}/zoeken?q={search_term_string}`,
    "query-input": "required name=search_term_string",
  },
});
