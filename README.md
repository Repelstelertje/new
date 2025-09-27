# ONL Modern Static Site (SEO-first)

Een **statische marketing-site** die tijdens build de profielen ophaalt via jouw API en **per provincie** SEO-vriendelijke HTML-pagina's genereert. Deployt automatisch naar **GitHub Pages**.

## Waarom zo?
- **SEO**: geen client-side SPA, maar **serverless prerender** in CI → Google krijgt direct HTML.
- **Simpel**: geen server beheren. Alles draait via GitHub Actions.
- **Snel**: schone HTML/CSS, lazy images, preconnects, minimale JS.
- **Toegankelijk**: WCAG 2.2 AA aannames (landmarks, focus, contrast).

## Snel starten
1. Maak een nieuwe GitHub-repo en upload/commit deze map.
2. Zet in `builder/config.json` jouw domein, merknaam en API-urls.
3. Ga naar **Settings → Pages** en kies **GitHub Actions** als deployment.
4. Push naar `main`. De workflow doet: `npm ci` → `npm run build` → deployt naar Pages.
5. Voeg je DNS `CNAME` toe voor je subdomein en zet `public/CNAME` correct.

## API-aannames
- Populaire profielen: `https://16hl07csd16.nl/profile/banner2/120`
- Per provincie: `https://16hl07csd16.nl/profile/province/nl/{{PROVINCIE}}/120`
- Response moet JSON zijn of HTML dat door de parser kan worden gelezen. Als veldnamen afwijken, **pas de mapping** aan in `builder/config.json`.

## Pagina's
- `/` toont populaire profielen
- `/provincie/<Naam>/` pagina per provincie met eigen title/description/JSON-LD
- `sitemap.xml` en `robots.txt` worden automatisch gegenereerd

## Lokale build
```bash
# vereisten: Node 18+
npm ci
npm run build
npx http-server public -p 8080
```

## Kwaliteit
- HTML valideren: `npm run lint:html`
- Lighthouse handmatig: open site en run DevTools Lighthouse

## Wat kun je aanpassen?
- Templates in `templates/`
- Styles in `public/assets/css/main.css`
- Provincielijst in `builder/config.json`
- Mapping van API → velden in `builder/config.json`

## Beveiliging & privacy
- Geen externe scripts behalve optionele analytics. Plaats niets inline; gebruik `nonce` indien nodig.
- CSP als `<meta http-equiv="Content-Security-Policy" ...>` (beperkt op Pages).
