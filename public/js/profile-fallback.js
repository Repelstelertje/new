const PATH_OK = /^\/daten-met-[a-z0-9-]+\/?$/i;
const ESC = { "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" };
const e = (s) => String(s ?? "").replace(/[&<>"']/g, ch => ESC[ch]);

function withAffiliate(url, id) {
  if (!url) return "";
  try { const u = new URL(url); u.searchParams.set("ref","32"); u.searchParams.set("source","oproepjes"); u.searchParams.set("subsource", String(id??"")); return u.toString(); }
  catch { return url; }
}
function pickImage(p, id) {
  return p?.img?.src || p?.imageUrl || p?.thumbUrl || p?.avatar || p?.picture || p?.src ||
    ((p?.picture_url && p?.basename)
      ? `${String(p.picture_url).replace(/\/+$/,"")}/pics/${String(id).slice(-2)}/${String(id).slice(-4)}/${id}/${p.basename}`
      : "/img/fallback.svg");
}
async function fetchConfig() {
  try {
    const r = await fetch("/site.config.json", { cache: "no-store" });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } catch (err) {
    // Veilige defaults zodat fallback altijd werkt
    console.warn("profile-fallback: site.config.json ontbreekt, gebruik defaults");
    return { api: { baseUrl: "https://16hl07csd16.nl", endpoints: { profileById: "/profile/id/{id}" } } };
  }
}
async function fetchProfileById(id, cfg) {
  const base = String(cfg?.api?.baseUrl ?? "").replace(/\/+$/, "");
  const tpl  = cfg?.api?.endpoints?.profileById || "/profile/id/{id}";
  if (!base) throw new Error("no API base");
  const ep = tpl.replace("{id}", encodeURIComponent(String(id)));
  const url = `${base}${ep.startsWith("/") ? "" : "/"}${ep}`;
  const r = await fetch(url, { headers: { Accept: "application/json" } });
  if (!r.ok) throw new Error(`api ${r.status}`);
  const json = await r.json();
  return json?.profile ?? json?.data ?? json;
}
function normalize(raw, id) {
  if (!raw) return null;
  const pid = raw.id ?? id;
  return {
    id: pid,
    name: raw.name ?? raw.title ?? "",
    age: Number.parseInt(raw.age ?? raw.leeftijd ?? "", 10) || undefined,
    province: raw.province ?? raw.regio ?? "",
    city: raw.city ?? raw.stad ?? "",
    height: raw.height ?? raw.lengte ?? raw.length ?? "",
    relationship: raw.relationship ?? raw.relationship_status ?? raw.relatiestatus ?? "",
    description: raw.aboutme ?? raw.bio ?? raw.description ?? "",
    deeplink: withAffiliate(raw.deeplink ?? raw.url ?? "", pid),
    image: pickImage(raw, pid),
  };
}
function renderFull(mount, p) {
  const meta = [];
  if (p.province) meta.push({label:"Provincie", value:p.province});
  if (p.city)     meta.push({label:"Stad", value:p.city});
  if (p.age)      meta.push({label:"Leeftijd", value:String(p.age)});
  if (p.relationship) meta.push({label:"Relatiestatus", value:p.relationship});
  if (p.height)   meta.push({label:"Lengte", value:p.height});
  mount.innerHTML = `
    <article style="display:grid;gap:2rem;grid-template-columns:minmax(0,1fr)">
      <div style="overflow:hidden;border:1px solid #e5e7eb;border-radius:1rem;background:#fff;max-width:360px">
        <img id="profile-img" src="${e(p.image)}" alt="${e(p.name)}" style="display:block;width:100%;height:auto;object-fit:cover" />
      </div>
      <div style="display:flex;flex-direction:column;gap:1rem">
        <header>
          <h1 style="margin:0 0 .5rem;font-size:clamp(1.75rem,2vw+1.5rem,2.5rem);line-height:1.2">${e(p.name)}</h1>
          <p style="margin:0;color:#475569">${[p.age ? `${e(String(p.age))} jaar` : "", p.city || p.province].filter(Boolean).join(" · ")}</p>
        </header>
        ${p.description ? `<p style="margin:0;color:#1f2937;line-height:1.7">${e(p.description)}</p>` : ""}
        ${meta.length ? `
          <section style="display:grid;gap:1rem;grid-template-columns:repeat(auto-fit,minmax(160px,1fr))">
            ${meta.map(m=>`
              <div style="background:#fff;border:1px solid #e5e7eb;border-radius:.75rem;padding:1rem">
                <p style="margin:0 0 .5rem;font-size:.75rem;text-transform:uppercase;letter-spacing:.08em;color:#64748b">${e(m.label)}</p>
                <p style="margin:0;font-weight:600">${e(m.value)}</p>
              </div>`).join("")}
          </section>`: ""}
        ${p.deeplink ? `
          <div style="padding-top:.5rem">
            <a id="profile-cta" href="${e(p.deeplink)}" rel="nofollow sponsored noopener" target="_blank"
               style="display:inline-flex;align-items:center;justify-content:center;border-radius:9999px;padding:.75rem 1.5rem;background:#0284c7;color:#fff;font-weight:600;text-decoration:none">
              Stuur gratis bericht
            </a>
          </div>` : ""}
      </div>
    </article>`;
  if (p.name) document.title = `Date met ${p.name}${p.province ? ` in ${p.province}` : ""}`;
}
(async function () {
  if (!PATH_OK.test(location.pathname)) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;
  let cfg, raw;
  try { cfg = await fetchConfig(); raw = await fetchProfileById(id, cfg); }
  catch { return; }
  const prof = normalize(raw, id);
  if (!prof) return;
  const mount = document.getElementById("profile-view");
  if (mount) renderFull(mount, prof);
})();
