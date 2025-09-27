import siteConfig from "../../site.config.json" assert { type: "json" };

export type SiteConfig = typeof siteConfig;

export const config: SiteConfig = siteConfig;
