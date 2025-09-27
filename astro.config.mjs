import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: "https://placeholder.example.com",
  trailingSlash: "always",
  integrations: [tailwind()],
});
