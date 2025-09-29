(async () => {
  // Run only on profile routes handled by GitHub Pages 404 fallback
  const path = location.pathname;
  const match = path.match(/^\/daten-met-([^/]+)\/?$/i);
  if (!match) return;

  // Minimal containers available in 404.html (will add in step 2)
  const notFound = document.getElementById('not-found');
  const mount = document.getElementById('profile-view');
  if (!mount) return;

  // Require ?id=
  const id = new URLSearchParams(location.search).get('id');
  if (!id) {
    if (notFound) notFound.style.display = '';
    mount.innerHTML = '';
    return;
  }

  const PROD_BASE = 'https://oproepjesnederland.nl';
  const API_BASE = 'https://16hl07csd16.nl';
  const epProfile = '/profile/id/{id}';
  const profileUrl = `${API_BASE}${epProfile.replace('{id}', encodeURIComponent(String(id)))}`;

  // Helper: build affiliate link -> ?ref=32&source=oproepjes&subsource={id}
  function withAffiliateParams(url, pid) {
    try {
      const u = new URL(url);
      u.searchParams.set('ref', '32');
      u.searchParams.set('source', 'oproepjes');
      u.searchParams.set('subsource', String(pid));
      return u.toString();
    } catch {
      return url;
    }
  }

  // Helpers
  function pickImage(p) {
    // Accept many shapes from the API; fall back to /img/fallback.svg
    const candidates = [
      p?.img?.src,
      p?.imageUrl,
      p?.thumbUrl,
      p?.profile_image_big,
      p?.avatar,
      p?.src
    ].filter(Boolean);
    return candidates[0] || '/img/fallback.svg';
  }
  function trim(text, max = 260) {
    if (!text) return '';
    if (text.length <= max) return text;
    const cut = text.slice(0, max);
    const at = Math.max(cut.lastIndexOf(' '), Math.floor(max * 0.85));
    return cut.slice(0, at).trimEnd() + '…';
  }
  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;','\'':'&#39;'}[c]));
  }
  function renderError(msg) {
    if (notFound) notFound.style.display = '';
    mount.innerHTML = `<p class="text-neutral-700">${escapeHtml(msg)}</p>`;
  }

  // Fetch profile JSON
  let data;
  try {
    const resp = await fetch(profileUrl, { headers: { 'Accept': 'application/json' } });
    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
    data = await resp.json();
  } catch (e) {
    renderError('Kon profiel niet laden. Probeer later opnieuw.');
    return;
  }

  // Normalize to a common shape
  const p = data?.profile || data?.data || data;
  if (!p || (!p.id && !p.name)) {
    renderError('Profiel niet gevonden.');
    return;
  }

  const profile = {
    id: String(p.id ?? id),
    name: p.name || p.title || '',
    age: Number.parseInt(p.age ?? p.leeftijd ?? 0, 10) || undefined,
    province: p.province || p.regio || p.city || '',
    city: p.city || p.stad || '',
    description: p.aboutme || p.bio || p.description || '',
    relationship: p.relationship || p.relationship_status || p.relatiestatus || '',
    height: p.height || p.lengte || '',
    deeplink: withAffiliateParams(p.deeplink || p.url || '', p.id ?? id),
    img: { src: pickImage(p), alt: p.name || 'Profielafbeelding' }
  };

  // Update <title> and canonical to production domain
  const title = `Date met ${profile.name}${profile.province ? ' in ' + profile.province : ''}`;
  document.title = title;
  const canonicalHref = `${PROD_BASE}${path}${location.search || ''}`;
  let link = document.querySelector('link[rel="canonical"]');
  if (!link) {
    link = document.createElement('link');
    link.setAttribute('rel', 'canonical');
    document.head.appendChild(link);
  }
  link.setAttribute('href', canonicalHref);

  // Render view
  if (notFound) notFound.style.display = 'none';
  mount.classList.add('is-visible');
  mount.innerHTML = `
    <article class="profile-layout">
      <div class="profile-card-image">
        <img src="${escapeHtml(profile.img.src)}" alt="${escapeHtml(profile.img.alt)}"
             class="profile-img"
             data-fallback-src="/img/fallback.svg" />
      </div>
      <div class="profile-card-body">
        <header class="profile-header">
          <h1>${escapeHtml(profile.name)}</h1>
          <p>${profile.age ? escapeHtml(String(profile.age)) + ' jaar · ' : ''}${escapeHtml(profile.province)}</p>
        </header>
        ${profile.description ? `<p class="profile-description">${escapeHtml(trim(profile.description, 400))}</p>` : ''}
        <section class="profile-meta">
          <div class="profile-meta-item">
            <p class="profile-meta-label">Provincie</p>
            <p class="profile-meta-value">${escapeHtml(profile.province)}</p>
          </div>
          ${profile.city ? `<div class="profile-meta-item"><p class="profile-meta-label">Stad</p><p class="profile-meta-value">${escapeHtml(profile.city)}</p></div>` : ''}
          ${profile.age ? `<div class="profile-meta-item"><p class="profile-meta-label">Leeftijd</p><p class="profile-meta-value">${escapeHtml(String(profile.age))}</p></div>` : ''}
          ${profile.relationship ? `<div class="profile-meta-item"><p class="profile-meta-label">Relatiestatus</p><p class="profile-meta-value">${escapeHtml(profile.relationship)}</p></div>` : ''}
          ${profile.height ? `<div class="profile-meta-item"><p class="profile-meta-label">Lengte</p><p class="profile-meta-value">${escapeHtml(profile.height)}</p></div>` : ''}
        </section>
        <div class="profile-cta">
          <a id="send-msg-btn"
             href="${escapeHtml(profile.deeplink)}"
             rel="nofollow sponsored noopener"
             target="_blank"
             aria-label="Stuur gratis bericht">
            Stuur gratis bericht
          </a>
        </div>
      </div>
    </article>
  `;

  // Optional: simple analytics hook (Plausible)
  document.getElementById('send-msg-btn')?.addEventListener('click', () => {
    if (window.plausible) {
      window.plausible('outbound_click', {
        props: {
          chat_url: profile.deeplink,
          province: profile.province || '',
          rank: -1,
          profile_id: profile.id
        }
      });
    }
  });
})();
