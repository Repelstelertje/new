import fs from 'fs';
import fsp from 'fs/promises';
import path from 'path';
import axios from 'axios';
import nunjucks from 'nunjucks';
import slugify from 'slugify';

const root = path.resolve('.');
const outDir = path.join(root, 'public');
const templatesDir = path.join(root, 'templates');

const cfg = JSON.parse(await fsp.readFile(path.join(root, 'builder', 'config.json'), 'utf8'));
const { site, api, mapping, provinces } = cfg;

nunjucks.configure(templatesDir, { autoescape: true });

const ensureDir = (p) => fsp.mkdir(p, { recursive: true });

const mapProfile = (raw) => {
  const g = (key, fallback) => raw?.[mapping[key]] ?? raw?.[key] ?? fallback ?? '';
  return {
    id: g('id'),
    name: g('name'),
    age: g('age'),
    province: g('province'),
    city: g('city'),
    thumb: g('thumb'),
    profileUrl: g('profileUrl'),
  };
};

async function fetchJson(url) {
  const res = await axios.get(url, { timeout: api.timeoutMs, headers: { 'Accept': 'application/json,text/html;q=0.9' } });
  if (typeof res.data === 'string') {
    try { return JSON.parse(res.data); } catch { return []; }
  }
  return res.data;
}

const render = (tpl, ctx) => nunjucks.render(tpl, ctx);
const write = (filePath, content) => fsp.writeFile(filePath, content, 'utf8');

const profileToLD = (profiles, listName) => ({
  "@context": "https://schema.org",
  "@type": "ItemList",
  "name": listName,
  "itemListElement": profiles.slice(0, 100).map((p, i) => ({
    "@type": "ListItem", "position": i+1, "url": p.profileUrl || site.baseUrl
  }))
});

async function buildIndex() {
  console.log('Building index (popular)...');
  const data = await fetchJson(api.popular);
  const profiles = (Array.isArray(data) ? data : (data?.profiles || [])).map(mapProfile);
  const html = render('index.njk', { site, title: 'Populaire profielen', desc: 'Bekijk populaire profielen uit heel Nederland.', profiles, jsonld: JSON.stringify(profileToLD(profiles, 'Populaire profielen')) });
  await write(path.join(outDir, 'index.html'), html);
}

async function buildProvince(name) {
  console.log('Building province', name);
  const url = api.provincePattern.replace('{PROVINCE}', encodeURIComponent(name)).replace('{LIMIT}', String(site.itemsPerPage));
  const data = await fetchJson(url);
  const profiles = (Array.isArray(data) ? data : (data?.profiles || [])).map(mapProfile);
  const slug = slugify(name, { lower: true, strict: true });
  const dir = path.join(outDir, 'provincie', slug);
  await ensureDir(dir);
  const html = render('province.njk', { site, province: name, title: `${name} profielen`, desc: `Bekijk profielen uit ${name}.`, profiles, jsonld: JSON.stringify(profileToLD(profiles, `Profielen ${name}`)) });
  await write(path.join(dir, 'index.html'), html);
  return { name, slug };
}

async function buildSitemap(allProvinceSlugs) {
  const urls = [
    `${site.baseUrl}/`,
    ...allProvinceSlugs.map(s => `${site.baseUrl}/provincie/${s}/`)
  ];
  const now = new Date().toISOString().slice(0,10);
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(u => `  <url><loc>${u}</loc><lastmod>${now}</lastmod></url>`).join('\n')}
</urlset>`;
  await write(path.join(outDir, 'sitemap.xml'), xml);
}

async function buildRobots() {
  const robots = `User-agent: *\nAllow: /\nSitemap: ${site.baseUrl}/sitemap.xml\n`;
  await write(path.join(outDir, 'robots.txt'), robots);
}

async function main() {
  await ensureDir(outDir);
  await ensureDir(path.join(outDir, 'assets/css'));
  // copy base css
  const css = await fsp.readFile(path.join('public','assets','css','main.css'),'utf8');
  await write(path.join(outDir, 'assets/css/main.css'), css);

  await buildIndex();
  const built = [];
  for (const p of provinces) {
    const { slug } = await buildProvince(p);
    built.push(slug);
  }
  await buildSitemap(built);
  await buildRobots();
  console.log('Build complete');
}

main().catch(e => { console.error(e); process.exit(1); });
