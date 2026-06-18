// GA Activity Gallery — gallery.js  (public viewer)

/* ══════════════════════════════════════════════════════════
   SUPABASE CLIENT  (same project as the board, vendored client)
   ══════════════════════════════════════════════════════════ */
const sb = supabase.createClient(
  'https://adbdcfofguflyyrvczvq.supabase.co',
  'sb_publishable_ERx_Z8GsAZCBRRL18HbwDw_4PWk2ahz'
);

const GALLERY_BUCKET = 'gallery';
const PIN_SESSION_KEY = 'ga_gallery_pin_ok';

/* ── tiny utils ─────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function thaiDate(d) {
  if (!d) return '';
  try {
    return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'long', year: 'numeric' });
  } catch { return ''; }
}

function publicUrl(path) {
  return sb.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function sha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ══════════════════════════════════════════════════════════
   STATE
   ══════════════════════════════════════════════════════════ */
let albums = [];          // [{...album, count, coverThumb}]
let currentAlbumPhotos = []; // photos of the open album (with full + thumb urls)
let lightboxIndex = 0;

const contentEl = document.getElementById('gallery-content');

/* ══════════════════════════════════════════════════════════
   PIN GATE
   ══════════════════════════════════════════════════════════ */
async function checkViewPin() {
  let cfg = null;
  try {
    const { data } = await sb.from('gallery_config').select('view_pin_enabled, view_pin_hash').eq('id', 1).single();
    cfg = data;
  } catch (_) { /* config table may be missing → treat as open */ }

  if (!cfg || !cfg.view_pin_enabled || !cfg.view_pin_hash) return true; // open access

  if (sessionStorage.getItem(PIN_SESSION_KEY) === '1') return true;

  return new Promise(resolve => {
    const gate    = document.getElementById('pin-gate');
    const form    = document.getElementById('pin-gate-form');
    const input   = document.getElementById('pin-gate-input');
    const errEl   = document.getElementById('pin-gate-error');
    gate.classList.remove('a-hidden');
    input.focus();

    form.addEventListener('submit', async e => {
      e.preventDefault();
      errEl.classList.add('a-hidden');
      const entered = input.value.trim();
      if (!entered) return;
      const hash = await sha256Hex(entered);
      if (hash === cfg.view_pin_hash) {
        sessionStorage.setItem(PIN_SESSION_KEY, '1');
        gate.classList.add('a-hidden');
        resolve(true);
      } else {
        errEl.textContent = 'PIN ไม่ถูกต้อง กรุณาลองใหม่';
        errEl.classList.remove('a-hidden');
        input.value = '';
        input.focus();
      }
    });
  });
}

/* ══════════════════════════════════════════════════════════
   ALBUM GRID  (newest first)
   ══════════════════════════════════════════════════════════ */
async function loadAlbums() {
  contentEl.innerHTML = '<div class="gallery-loading">⏳ กำลังโหลด...</div>';
  try {
    const { data: albumRows, error: aErr } = await sb
      .from('albums')
      .select('id, name, event_date, description, cover_photo_id, created_at')
      .order('created_at', { ascending: false });
    if (aErr) throw aErr;

    // Lightweight pass over photos: id, album, thumb → counts + cover pick.
    const { data: photoRows, error: pErr } = await sb
      .from('photos')
      .select('id, album_id, thumb_path, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (pErr) throw pErr;

    const byAlbum = new Map();
    (photoRows ?? []).forEach(p => {
      if (!byAlbum.has(p.album_id)) byAlbum.set(p.album_id, []);
      byAlbum.get(p.album_id).push(p);
    });

    albums = (albumRows ?? []).map(a => {
      const ps = byAlbum.get(a.id) ?? [];
      let cover = null;
      if (a.cover_photo_id) cover = ps.find(p => p.id === a.cover_photo_id) ?? null;
      if (!cover) cover = ps[0] ?? null;
      return { ...a, count: ps.length, coverThumb: cover ? cover.thumb_path : null };
    });

    renderAlbumGrid();
  } catch (err) {
    console.error('[Gallery] loadAlbums', err);
    contentEl.innerHTML = `
      <div class="gallery-empty">
        <span class="gallery-empty-emoji">😕</span>
        <p class="gallery-empty-title">โหลดแกลเลอรีไม่สำเร็จ</p>
        <p class="gallery-empty-sub">กรุณารีเฟรชหน้าอีกครั้ง</p>
      </div>`;
  }
}

function renderAlbumGrid() {
  document.getElementById('gallery-breadcrumb').classList.add('a-hidden');
  document.getElementById('album-header').classList.add('a-hidden');

  if (albums.length === 0) {
    contentEl.innerHTML = `
      <div class="gallery-empty">
        <span class="gallery-empty-emoji">📸</span>
        <p class="gallery-empty-title">ยังไม่มีอัลบั้มกิจกรรม</p>
        <p class="gallery-empty-sub">เมื่อทีมอัปโหลดรูปกิจกรรม จะมาปรากฏที่นี่นะ 💛</p>
      </div>`;
    return;
  }

  const cards = albums.map(a => {
    const coverHtml = a.coverThumb
      ? `<img class="album-cover" src="${esc(publicUrl(a.coverThumb))}" alt="${esc(a.name)}" loading="lazy"
              onerror="this.classList.add('album-cover--empty');this.removeAttribute('src');this.textContent='🖼️';" />`
      : `<div class="album-cover album-cover--empty" aria-hidden="true">📷</div>`;
    const dateStr = a.event_date ? thaiDate(a.event_date) : thaiDate(a.created_at);
    return `
      <button type="button" class="album-card" data-album="${a.id}">
        ${coverHtml}
        <div class="album-card-body">
          <h3 class="album-card-name">${esc(a.name)}</h3>
          <div class="album-card-meta">
            <span>${esc(dateStr)}</span>
            <span class="album-card-count">${a.count} รูป</span>
          </div>
        </div>
      </button>`;
  }).join('');

  contentEl.innerHTML = `<div class="album-grid">${cards}</div>`;
  contentEl.querySelectorAll('.album-card').forEach(btn => {
    btn.addEventListener('click', () => openAlbum(btn.dataset.album));
  });
}

/* ══════════════════════════════════════════════════════════
   PHOTO GRID  (inside an album)
   ══════════════════════════════════════════════════════════ */
async function openAlbum(albumId) {
  const album = albums.find(a => a.id === albumId);
  if (!album) return;
  window.scrollTo({ top: 0, behavior: 'auto' });
  contentEl.innerHTML = '<div class="gallery-loading">⏳ กำลังโหลด...</div>';

  try {
    const { data, error } = await sb
      .from('photos')
      .select('id, album_id, storage_path, thumb_path, caption, sort_order, created_at')
      .eq('album_id', albumId)
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) throw error;

    currentAlbumPhotos = (data ?? []).map(p => ({
      ...p,
      fullUrl:  publicUrl(p.storage_path),
      thumbUrl: publicUrl(p.thumb_path),
    }));

    // Breadcrumb + header
    document.getElementById('gallery-breadcrumb').classList.remove('a-hidden');
    document.getElementById('crumb-album').textContent = album.name;
    const head = document.getElementById('album-header');
    head.classList.remove('a-hidden');
    document.getElementById('album-title').textContent = album.name;
    const dateStr = album.event_date ? thaiDate(album.event_date) : thaiDate(album.created_at);
    document.getElementById('album-meta').textContent = `${dateStr} · ${currentAlbumPhotos.length} รูป`;
    document.getElementById('album-desc').textContent = album.description ?? '';

    renderPhotoGrid();
  } catch (err) {
    console.error('[Gallery] openAlbum', err);
    contentEl.innerHTML = `
      <div class="gallery-empty">
        <span class="gallery-empty-emoji">😕</span>
        <p class="gallery-empty-title">โหลดรูปไม่สำเร็จ</p>
        <p class="gallery-empty-sub">กรุณาลองใหม่อีกครั้ง</p>
      </div>`;
  }
}

function renderPhotoGrid() {
  if (currentAlbumPhotos.length === 0) {
    contentEl.innerHTML = `
      <div class="gallery-empty">
        <span class="gallery-empty-emoji">🌼</span>
        <p class="gallery-empty-title">อัลบั้มนี้ยังไม่มีรูป</p>
        <p class="gallery-empty-sub">เดี๋ยวทีมจะมาเติมความทรงจำดีๆ ให้เร็วๆ นี้</p>
      </div>`;
    return;
  }

  const cells = currentAlbumPhotos.map((p, i) => `
    <div class="photo-cell" data-idx="${i}" role="button" tabindex="0"
         aria-label="${esc(p.caption || 'รูปกิจกรรม')}">
      <img src="${esc(p.thumbUrl)}" alt="${esc(p.caption || '')}" loading="lazy"
           onload="this.classList.add('is-loaded')"
           onerror="this.closest('.photo-cell').classList.add('is-broken');this.remove();" />
    </div>`).join('');

  contentEl.innerHTML = `<div class="photo-grid">${cells}</div>`;
  contentEl.querySelectorAll('.photo-cell').forEach(cell => {
    const idx = Number(cell.dataset.idx);
    cell.addEventListener('click', () => openLightbox(idx));
    cell.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openLightbox(idx); }
    });
  });
}

/* ══════════════════════════════════════════════════════════
   LIGHTBOX
   ══════════════════════════════════════════════════════════ */
const lb        = document.getElementById('lightbox');
const lbImg     = document.getElementById('lb-img');
const lbCaption = document.getElementById('lb-caption');
const lbCounter = document.getElementById('lb-counter');
const lbSpinner = document.getElementById('lb-spinner');

function openLightbox(idx) {
  lightboxIndex = idx;
  lb.classList.remove('a-hidden');
  document.body.style.overflow = 'hidden';
  showLightboxImage();
}

function showLightboxImage() {
  const p = currentAlbumPhotos[lightboxIndex];
  if (!p) return;
  lbImg.classList.remove('is-loaded');
  lbSpinner.style.display = 'block';
  lbImg.onload  = () => { lbImg.classList.add('is-loaded'); lbSpinner.style.display = 'none'; };
  lbImg.onerror = () => { lbSpinner.style.display = 'none'; };
  lbImg.src = p.fullUrl;                 // full image only on open (egress-light)
  lbImg.alt = p.caption || 'รูปกิจกรรม';
  lbCaption.textContent = p.caption || '';
  lbCounter.textContent = `${lightboxIndex + 1} / ${currentAlbumPhotos.length}`;
}

function closeLightbox() {
  lb.classList.add('a-hidden');
  lbImg.removeAttribute('src');
  document.body.style.overflow = '';
}

function lbStep(dir) {
  const n = currentAlbumPhotos.length;
  if (n === 0) return;
  lightboxIndex = (lightboxIndex + dir + n) % n;
  showLightboxImage();
}

document.getElementById('lb-close').addEventListener('click', closeLightbox);
document.getElementById('lb-prev').addEventListener('click', () => lbStep(-1));
document.getElementById('lb-next').addEventListener('click', () => lbStep(1));
lb.addEventListener('click', e => { if (e.target === lb) closeLightbox(); });
document.addEventListener('keydown', e => {
  if (lb.classList.contains('a-hidden')) return;
  if (e.key === 'Escape')     closeLightbox();
  if (e.key === 'ArrowLeft')  lbStep(-1);
  if (e.key === 'ArrowRight') lbStep(1);
});

/* ── breadcrumb back → album grid (clear deep-link hash) ── */
document.getElementById('crumb-back').addEventListener('click', () => {
  if (location.hash) history.replaceState(null, '', location.pathname + location.search);
  renderAlbumGrid();
});

/* ══════════════════════════════════════════════════════════
   DEEP LINK — open gallery.html#album=<album_id> straight into an album
   ══════════════════════════════════════════════════════════ */
function albumIdFromHash() {
  const m = (location.hash || '').match(/album=([0-9a-fA-F-]+)/);
  return m ? m[1] : null;
}

function openAlbumFromHash() {
  const id = albumIdFromHash();
  if (id && albums.some(a => a.id === id)) openAlbum(id);
}

// Respond to in-page hash changes (e.g. arriving from an index album card
// while already on the gallery page).
window.addEventListener('hashchange', () => {
  const id = albumIdFromHash();
  if (id) { if (albums.some(a => a.id === id)) openAlbum(id); }
  else renderAlbumGrid();
});

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
(async function init() {
  const ok = await checkViewPin();
  if (!ok) return;
  await loadAlbums();
  openAlbumFromHash();
})();
