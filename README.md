# OproepjesNederland Astro

Deze site verzamelt datingoproepjes per provincie en brengt bezoekers snel naar relevante profielen.
We bieden een lichtgewicht Astro-front-end die draait op statische hosting met minimale afhankelijkheden.
Het doel is een overdraagbare setup die door verschillende teams eenvoudig te onderhouden is.

## Quick start
1. Gebruik Node.js 20.
2. `pnpm install`
3. `pnpm dev`
4. `pnpm build`

## Deploy
- Deploy via GitHub Pages met de standaard `dist` output uit `pnpm build`.
- Automatiseer publicatie met een GitHub Actions workflow plus een `cron` trigger voor periodieke rebuilds.

## Configuratie
Alle omgevingsafspraken leven in [`site.config.json`](./site.config.json):
- `site`, `routing`: metadata, paden en redirects voor provincies en legacy-urls.
- `api`: basis-URL's, limieten en deeplink-parameters voor externe datadiensten.
- `seo` en `performance`: titels, beschrijvingen, structured data en Core Web Vitals-budgets.
- `security`, `analytics`, `build`: CSP-verwachtingen, trackingtool en build-targets (Node 20, pnpm, outputpad, cron-schema).

## SEO & performance checklijst
- [ ] Controleer titels, meta descriptions en canonicals tegen live pagina's.
- [ ] Valideer sitemap(s) en structured data via Search Console / Rich Results Test.
- [ ] Meet LCP, INP en CLS met Lighthouse of WebPageTest en vergelijk met het budget.
- [ ] Bewaak bundelgroottes (`jsKb`, `cssKb`) en optimaliseer afbeeldingen conform beleid.

## Toegankelijkheid
- Gebruik de axe-core browser-extensie om elke template-variant handmatig te scannen.
- Log en verhelp alle kritieke en serieuze issues voordat je live gaat.

## Bekende valkuilen op GitHub Pages
- Geen custom HTTP headers; implementeer CSP via `<meta http-equiv="Content-Security-Policy">` in je templates.
- GitHub Pages werkt alleen met statische assets: plan voor client-side fallback bij API-fouten.
