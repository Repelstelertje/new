const PROFILE_PATH_REGEX = /^\/daten-met-[a-z0-9-]+\/?$/i;

const HTML_ESCAPE_MAP = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => HTML_ESCAPE_MAP[char]);
}

function trimText(text, max = 480) {
  if (!text) return "";
  const str = String(text);
  if (str.length <= max) return str;
  const slice = str.slice(0, max);
  const cutoff = Math.max(slice.lastIndexOf(" "), Math.floor(max * 0.9));
  return slice.slice(0, cutoff === -1 ? max : cutoff).trimEnd() + "…";
}

function withAffiliateParams(url, id) {
  if (!url) return "";
  try {
    const target = new URL(url);
    target.searchParams.set("ref", "32");
    target.searchParams.set("source", "oproepjes");
    target.searchParams.set("subsource", String(id ?? ""));
    return target.toString();
  } catch {
    return url;
  }
}

function renderError(message) {
  const notFound = document.getElementById("not-found");
  if (!notFound) return;

  notFound.style.display = "block";
  notFound.innerHTML = `
    <h1>Pagina niet gevonden</h1>
    <p>${escapeHtml(message)}</p>
    <p>Ga terug naar de <a href="/">homepage</a>.</p>
  `;
}

async function run() {
  if (!PROFILE_PATH_REGEX.test(location.pathname)) {
    return;
  }

  const id = new URLSearchParams(location.search).get("id");
  const mount = document.getElementById("profile-view");
  const notFound = document.getElementById("not-found");

  if (!mount || !id) {
    return;
  }

  let config;
  try {
    const res = await fetch("/site.config.json", { cache: "no-store" });
    if (!res.ok) throw new Error(String(res.status));
    config = await res.json();
  } catch (err) {
    renderError("Kon configuratie niet laden.");
    console.error("Profile fallback: failed to load site config", err);
    return;
  }

  const apiBase = String(config?.api?.baseUrl ?? "").replace(/\/+$/, "");
  const endpointTemplate = config?.api?.endpoints?.profileById ?? "/profile/id/{id}";

  if (!apiBase) {
    renderError("API niet geconfigureerd.");
    return;
  }

  const endpoint = endpointTemplate.replace("{id}", encodeURIComponent(String(id)));
  const fetchUrl = `${apiBase}${endpoint.startsWith("/") ? "" : "/"}${endpoint}`;

  let payload;
  try {
    const res = await fetch(fetchUrl, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(String(res.status));
    payload = await res.json();
  } catch (err) {
    renderError("Profiel niet gevonden.");
    console.error("Profile fallback: failed to load profile", err);
    return;
  }

  const rawProfile = payload?.profile ?? payload?.data ?? payload;
  if (!rawProfile || (!rawProfile.id && !rawProfile.name && !rawProfile.title)) {
    renderError("Profiel niet gevonden.");
    return;
  }

  const profileId = rawProfile.id ?? id;
  const profile = {
    id: profileId,
    name: rawProfile.name ?? rawProfile.title ?? "",
    age: Number.parseInt(rawProfile.age ?? rawProfile.leeftijd ?? "", 10) || undefined,
    province: rawProfile.province ?? rawProfile.regio ?? "",
    city: rawProfile.city ?? rawProfile.stad ?? "",
    height: rawProfile.height ?? rawProfile.lengte ?? rawProfile.length ?? "",
    relationship:
      rawProfile.relationship ??
      rawProfile.relationship_status ??
      rawProfile.relatiestatus ??
      "",
    description: rawProfile.aboutme ?? rawProfile.bio ?? rawProfile.description ?? "",
    deeplink: withAffiliateParams(rawProfile.deeplink ?? rawProfile.url ?? "", profileId),
    image:
      rawProfile?.img?.src ??
      rawProfile.imageUrl ??
      rawProfile.thumbUrl ??
      rawProfile.avatar ??
      rawProfile.picture ??
      rawProfile.src ??
      (rawProfile.picture_url && rawProfile.basename
        ? `${String(rawProfile.picture_url).replace(/\/+$/, "")}/pics/${String(profileId).slice(-2)}/${String(profileId).slice(-4)}/${profileId}/${rawProfile.basename}`
        : "/img/fallback.svg"),
  };

  const metaItems = [
    profile.province && {
      label: "Provincie",
      value: profile.province,
    },
    profile.city && {
      label: "Stad",
      value: profile.city,
    },
    profile.age && {
      label: "Leeftijd",
      value: `${profile.age}`,
    },
    profile.relationship && {
      label: "Relatiestatus",
      value: profile.relationship,
    },
    profile.height && {
      label: "Lengte",
      value: profile.height,
    },
  ].filter(Boolean);

  if (notFound) {
    notFound.style.display = "none";
  }

  mount.classList.add("is-visible");
  const subheadingParts = [];
  if (profile.age) subheadingParts.push(`${escapeHtml(String(profile.age))} jaar`);
  if (profile.city) subheadingParts.push(escapeHtml(profile.city));
  else if (profile.province) subheadingParts.push(escapeHtml(profile.province));

  mount.innerHTML = `
    <article class="layout">
      <div class="card">
        <img src="${escapeHtml(profile.image)}" alt="${escapeHtml(profile.name)}" onerror="this.onerror=null;this.src='/img/fallback.svg'" />
      </div>
      <div class="body">
        <header>
          <h1 style="margin:0 0 .5rem;font-size:clamp(1.75rem,2vw+1.5rem,2.5rem);line-height:1.2;">${escapeHtml(profile.name)}</h1>
          ${
            subheadingParts.length
              ? `<p style="margin:0;color:#475569;">${subheadingParts.join(" · ")}</p>`
              : ""
          }
        </header>
        ${
          profile.description
            ? `<p style="margin:1rem 0;color:#1f2937;line-height:1.7;">${escapeHtml(trimText(profile.description))}</p>`
            : ""
        }
        ${
          metaItems.length
            ? `<section class="meta">
                ${metaItems
                  .map(
                    (item) => `
                      <div class="meta-item">
                        <p class="meta-label">${escapeHtml(item.label)}</p>
                        <p class="meta-value">${escapeHtml(String(item.value))}</p>
                      </div>
                    `,
                  )
                  .join("")}
              </section>`
            : ""
        }
        ${
          profile.deeplink
            ? `<div class="cta">
                <a class="btn" href="${escapeHtml(profile.deeplink)}" rel="nofollow sponsored noopener" target="_blank">Stuur gratis bericht</a>
              </div>`
            : ""
        }
      </div>
    </article>
  `;

  if (profile.name) {
    document.title = `Date met ${profile.name}${profile.province ? ` in ${profile.province}` : ""}`;
  }
}

run();
