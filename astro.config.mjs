import { defineConfig } from "astro/config";
import tailwind from "@astrojs/tailwind";
import siteConfig from "./site.config.json" assert { type: "json" };
import { writeFile } from "node:fs/promises";

const stagingValue = process.env.STAGING;
const isStagingEnv =
  typeof stagingValue === "string"
    ? ["true", "1", "yes"].includes(stagingValue.toLowerCase())
    : Boolean(stagingValue);

const robotsIntegration = {
  name: "robots-env-toggle",
  hooks: {
    "astro:build:done": async ({ dir }) => {
      if (!isStagingEnv) return;

      const robotsUrl = new URL("./robots.txt", dir);
      const content = "User-agent: *\nDisallow: /\n";

      try {
        await writeFile(robotsUrl, content, "utf8");
      } catch (error) {
        console.warn("Kon staging robots.txt niet schrijven", error);
      }
    },
  },
};

export default defineConfig({
  site: siteConfig.site?.canonicalBase ?? "https://placeholder.example.com",
  trailingSlash: "always",
  integrations: [tailwind(), robotsIntegration],
});
