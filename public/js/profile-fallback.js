// Client fallback: only runs on 404 when a /daten-met-... route wasn't prebuilt.
(async () => {
  const path = location.pathname;
  const match = path.match(/^\/daten-met-[^/]+\/?$/i);
  if (!match) return;
  const id = new URLSearchParams(location.search).get("id");
  if (!id) return;
  const mount = document.getElementById("profile-view");
  if (!mount) return;
  try {
    // Production-style GET-by-id (same host you already use)
    const API_BASE = "https://16hl07csd16.nl";
    const ep = `/profile/id/${encodeURIComponent(String(id))}`;
    const res = await fetch(API_BASE + ep, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    const data = await res.json();
    const p = data?.profile || data?.data || data;
    if (!p) throw new Error("no profile");
    const name = p.name || p.title || "";
    const province = p.province || p.regio || "";
    const city = p.city || p.stad || "";
    const age = p.age || p.leeftijd || "";
    const length = p.length || p.lengte || "";
    const about = p.aboutme || p.bio || p.description || "";
    const img =
      p.profile_image ||
      p?.img?.src ||
      p.imageUrl ||
      p.thumbUrl ||
      p.src ||
      "/img/fallback.svg";
    mount.innerHTML = `
      <article class="mx-auto grid max-w-5xl grid-cols-1 gap-8 md:grid-cols-[360px,1fr]">
        <div class="overflow-hidden rounded-2xl border border-neutral-200 bg-white">
          <img src="${img}" alt="${name}" class="block h-auto w-full object-cover" onerror="this.src='/img/fallback.svg'"/>
        </div>
        <div class="space-y-4">
          <header>
            <h1 class="text-3xl font-bold text-neutral-900">${name}</h1>
            <p class="text-neutral-700">${age ? `${age} jaar` : ""}${(age && (city||province)) ? " · " : ""}${city || province}</p>
          </header>
          ${about ? `<p class="text-neutral-800 leading-relaxed">${about}</p>` : ""}
          <section class="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            ${province ? `<div class="rounded-xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">Provincie</p><p class="mt-1 font-medium text-neutral-900">${province}</p></div>` : ""}
            ${city ? `<div class="rounded-xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">Stad</p><p class="mt-1 font-medium text-neutral-900">${city}</p></div>` : ""}
            ${age ? `<div class="rounded-xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">Leeftijd</p><p class="mt-1 font-medium text-neutral-900">${age}</p></div>` : ""}
            ${length ? `<div class="rounded-xl border border-neutral-200 bg-white p-4"><p class="text-xs uppercase tracking-wide text-neutral-500">Lengte</p><p class="mt-1 font-medium text-neutral-900">${length}</p></div>` : ""}
          </section>
        </div>
      </article>
    `;
    document.title = `Date met ${name}${province ? " in " + province : ""}`;
  } catch {
    // leave default 404 content
  }
})();
