// GA Cheer Up Board — app.js  (Phase 1-4)

/* ══════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════ */
const sb = supabase.createClient(
  'https://adbdcfofguflyyrvczvq.supabase.co',
  'sb_publishable_ERx_Z8GsAZCBRRL18HbwDw_4PWk2ahz'
);

/* ══════════════════════════════════════════════════════════
   CONSTANTS
   ══════════════════════════════════════════════════════════ */
const CAT = {
  thank_you: { label: 'ขอบคุณ',     emoji: '💝', cls: 'thank_you' },
  idea:      { label: 'ไอเดีย',      emoji: '💡', cls: 'idea'      },
  cheer_up:  { label: 'ให้กำลังใจ', emoji: '🌈', cls: 'cheer_up'  },
};

const ROTS = [0.6, -0.8, 0.4, -0.5, 0.7, -0.6, 0.5, -0.4, 0.8, -0.7, 0.3, -0.9];

/* ══════════════════════════════════════════════════════════
   UTILITIES
   ══════════════════════════════════════════════════════════ */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function thaiTime(iso) {
  const diff  = Date.now() - new Date(iso).getTime();
  const mins  = Math.floor(diff / 60_000);
  const hours = Math.floor(diff / 3_600_000);
  const days  = Math.floor(diff / 86_400_000);
  if (mins  <  1) return 'เพิ่งโพสต์';
  if (mins  < 60) return `${mins} นาทีที่แล้ว`;
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  if (days  <  7) return `${days} วันที่แล้ว`;
  return new Date(iso).toLocaleDateString('th-TH', { day:'numeric', month:'short', year:'numeric' });
}

/* ══════════════════════════════════════════════════════════
   RENDER HELPERS
   ══════════════════════════════════════════════════════════ */
function rxnHtml(id, rxn) {
  const r = rxn ?? { thumbs_up: 0, heart: 0, clap: 0 };
  const btn = (type, emoji, label) => {
    const cls = reactedSet.has(`${id}:${type}`) ? ' reacted' : '';
    return `<button class="rxn-btn${cls}" data-id="${id}" data-type="${type}" aria-label="${label}">${emoji} <span class="rxn-count">${r[type] ?? 0}</span></button>`;
  };
  return `
    <div class="reactions">
      ${btn('thumbs_up', '👍', 'ถูกใจ')}
      ${btn('heart',     '❤️', 'รัก')}
      ${btn('clap',      '👏', 'ปรบมือ')}
    </div>`;
}

/* Exported for Phase 3 optimistic prepend */
function renderCard(msg, idx) {
  const cat    = CAT[msg.category] ?? CAT.cheer_up;
  const avatar = msg.avatar_emoji  ?? '🌟';
  const sender = (msg.is_anonymous || !msg.sender_name || msg.sender_name === 'Anonymous')
    ? 'ไม่ระบุชื่อ'
    : msg.sender_name;
  const r      = ROTS[idx % ROTS.length];

  const rxn       = msg.reactions ?? {};
  const totalRxn  = (rxn.thumbs_up ?? 0) + (rxn.heart ?? 0) + (rxn.clap ?? 0);
  const isNew     = (Date.now() - new Date(msg.created_at).getTime()) < 86_400_000;
  const isPopular = totalRxn >= 5;

  const classes = ['card',
    isPopular ? 'is-popular' : '',
    isNew     ? 'is-new'     : '',
  ].filter(Boolean).join(' ');

  const newBadge = isNew
    ? `<span class="badge-new" aria-label="ข้อความใหม่">✨ NEW</span>`
    : '';

  const popularBadge = isPopular
    ? `<span class="sr-only">ข้อความฮอตฮิต</span>`
    : '';

  const preview = esc(msg.content).slice(0, 60);
  const cardLabel = `ข้อความจาก ${esc(sender)}: ${preview}${msg.content.length > 60 ? '…' : ''}`;

  return `
    <article class="${classes}" style="--r:${r}deg"
             data-id="${msg.id}" data-category="${msg.category}"
             aria-label="${cardLabel}">
      ${newBadge}${popularBadge}
      <div class="card-head">
        <span class="card-avatar" aria-hidden="true">${esc(avatar)}</span>
        <span class="card-badge badge-${cat.cls}">${cat.emoji} ${cat.label}</span>
      </div>
      <p class="card-msg">${esc(msg.content)}</p>
      <div class="card-foot">
        <div class="card-meta">
          <span class="card-sender">— ${esc(sender)}</span>
          <span class="card-time">${thaiTime(msg.created_at)}</span>
        </div>
        ${rxnHtml(msg.id, msg.reactions)}
      </div>
    </article>`;
}

function renderMotw(msg) {
  const cat    = CAT[msg.category] ?? CAT.cheer_up;
  const avatar = msg.avatar_emoji  ?? '🌟';
  const sender = (msg.is_anonymous || !msg.sender_name || msg.sender_name === 'Anonymous')
    ? 'ไม่ระบุชื่อ'
    : msg.sender_name;
  return `
    <div class="motw-card" role="article" data-id="${msg.id}">
      <div class="motw-avatar" aria-label="อีโมจิผู้ส่ง">${esc(avatar)}</div>
      <div class="motw-body">
        <span class="motw-badge badge-${cat.cls}">${cat.emoji} ${cat.label}</span>
        <p class="motw-message">"${esc(msg.content)}"</p>
        <div class="motw-footer">
          <span class="motw-sender">— ${esc(sender)}</span>
          ${rxnHtml(msg.id, msg.reactions)}
        </div>
      </div>
    </div>`;
}

function skelCard() {
  return `
    <div class="card skel-card" aria-hidden="true">
      <div class="skel-head"><div class="skel skel-avatar"></div><div class="skel skel-badge"></div></div>
      <div class="skel skel-line skel-long"></div>
      <div class="skel skel-line skel-med"></div>
      <div class="skel skel-line skel-short"></div>
      <div class="skel-foot"><div class="skel skel-pill"></div><div class="skel skel-pill"></div><div class="skel skel-pill"></div></div>
    </div>`;
}

function skelMotw() {
  return `
    <div class="motw-card motw-skeleton" aria-hidden="true">
      <div class="skel skel-avatar-lg"></div>
      <div class="motw-body" style="flex:1">
        <div class="skel skel-badge" style="margin-bottom:.7rem"></div>
        <div class="skel skel-line skel-long"></div>
        <div class="skel skel-line skel-med"></div>
        <div class="skel skel-line skel-short"></div>
        <div class="skel-foot" style="margin-top:1rem"><div class="skel skel-pill"></div><div class="skel skel-pill"></div><div class="skel skel-pill"></div></div>
      </div>
    </div>`;
}

const EMPTY_STATES = {
  all: {
    emoji: '💌',
    title: 'ยังไม่มีข้อความเลย!',
    sub:   'เป็นคนแรกที่แชร์ความรู้สึกดีๆ ให้ทีม',
    cta:   '✨ เพิ่มข้อความแรก',
  },
  thank_you: {
    emoji: '🍑',
    title: 'ยังไม่มีคำขอบคุณเลยนะ',
    sub:   'ลองส่งคำขอบคุณให้เพื่อนร่วมทีมที่ช่วยคุณเมื่อเร็วๆ นี้สิ!',
    cta:   '💝 เขียนขอบคุณคนแรก',
  },
  idea: {
    emoji: '💡',
    title: 'ยังไม่มีไอเดียเลยจ้า',
    sub:   'มีไอเดียดีๆ อยู่ในหัวไหม? แชร์ให้ทีมรู้ด้วยกันเลย!',
    cta:   '💡 แชร์ไอเดียแรก',
  },
  cheer_up: {
    emoji: '🌿',
    title: 'ยังไม่มีข้อความให้กำลังใจ',
    sub:   'ทีมต้องการพลังงานบวกจากคุณ ส่งกำลังใจให้กันหน่อยนะ!',
    cta:   '🌈 ส่งกำลังใจแรก',
  },
};

function renderEmpty(filter = 'all') {
  const s = EMPTY_STATES[filter] ?? EMPTY_STATES.all;
  return `
    <div class="empty-state" role="status" aria-live="polite">
      <div class="empty-emoji">${s.emoji}</div>
      <h3 class="empty-title">${s.title}</h3>
      <p class="empty-sub">${s.sub}</p>
      <button class="empty-cta" onclick="document.getElementById('openModal').click()">${s.cta}</button>
    </div>`;
}

function renderError(err) {
  console.error('[Board]', err);
  return `
    <div class="empty-state error-state" role="alert">
      <div class="empty-emoji">😕</div>
      <h3 class="empty-title">โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้า 🔄</h3>
      <p class="empty-sub">เกิดข้อผิดพลาดบางอย่าง กรุณาลองใหม่อีกครั้ง</p>
      <button class="empty-cta" onclick="location.reload()">🔄 ลองอีกครั้ง</button>
    </div>`;
}

/* ══════════════════════════════════════════════════════════
   BOARD STATE & RENDERING
   ══════════════════════════════════════════════════════════ */
let allMessages  = [];
let activeFilter = 'all';
let pinnedMsg    = null;
const reactedSet = new Set(); // key: `${msgId}:${type}`

const RXN_EMOJI = { thumbs_up: '👍', heart: '❤️', clap: '👏' };

function spawnParticles(btn, type) {
  const rect  = btn.getBoundingClientRect();
  const emoji = RXN_EMOJI[type] ?? '✨';
  const count = Math.floor(Math.random() * 3) + 3; // 3–5

  for (let i = 0; i < count; i++) {
    const el = document.createElement('span');
    el.className   = 'rxn-particle';
    el.textContent = emoji;

    const offsetX    = (Math.random() - 0.5) * 36;
    const swayStart  = (Math.random() - 0.5) * 10;
    const swayMid    = (Math.random() - 0.5) * 20;
    const swayEnd    = (Math.random() - 0.5) * 16;
    const rise       = -(80 + Math.random() * 40);
    const duration   = 0.8 + Math.random() * 0.7; // 0.8 s – 1.5 s
    const delay      = i * 0.06;

    el.style.cssText = `
      left: ${rect.left + rect.width / 2 + offsetX}px;
      top:  ${rect.top}px;
      --sway-start: ${swayStart}px;
      --sway-mid:   ${swayMid}px;
      --sway-end:   ${swayEnd}px;
      --rise:       ${rise}px;
      animation: float-up ${duration.toFixed(2)}s ${delay.toFixed(2)}s cubic-bezier(0.22,1,0.36,1) forwards;
    `;

    document.body.appendChild(el);
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }
}

/* ── Viewport-gated card animation ───────────────────────── */
const _cardObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    entry.target.classList.toggle('in-view', entry.isIntersecting);
  });
}, { rootMargin: '0px 0px -40px 0px', threshold: 0.1 });

function observeCards() {
  document.querySelectorAll('#board .card').forEach(card => {
    if (!card.dataset.observed) {
      card.dataset.observed = '1';
      _cardObserver.observe(card);
    }
  });
}

function wireReactions() {
  document.querySelectorAll('.rxn-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      // Reactions are one-way: positive energy only goes up, never removed.
      if (btn.classList.contains('reacted')) {
        btn.classList.add('popped');
        btn.addEventListener('animationend', () => btn.classList.remove('popped'), { once: true });
        return;
      }

      const countEl = btn.querySelector('.rxn-count');
      const current = parseInt(countEl?.textContent || '0', 10);
      const key     = `${btn.dataset.id}:${btn.dataset.type}`;

      btn.classList.add('popped');
      btn.addEventListener('animationend', () => btn.classList.remove('popped'), { once: true });
      btn.classList.add('reacted');
      spawnParticles(btn, btn.dataset.type);
      reactedSet.add(key);
      if (countEl) countEl.textContent = current + 1;

      const { error } = await sb.rpc('increment_reaction', {
        message_id:    btn.dataset.id,
        reaction_type: btn.dataset.type,
      });
      if (error) {
        console.warn('[Reaction]', error);
        if (countEl) countEl.textContent = current;
        btn.classList.remove('reacted');
        reactedSet.delete(key);
      }
    });
  });
}

const MILESTONES   = [10, 25, 50, 100, 200, 500];
const MILESTONE_KEY = 'cheer-milestone-seen';

function getMilestoneTagline(total) {
  if (total === 0) return null;
  if (total < 10)  return `ทีมเราเริ่มส่งกำลังใจกันแล้ว 🌱`;
  if (total < 25)  return `ส่งกำลังใจกันไปแล้ว ${total} ครั้ง ✨`;
  if (total < 50)  return `พลังงานบวกจากทีม ${total} ข้อความ 💪`;
  if (total < 100) return `ว้าว! ${total} ข้อความกำลังใจจากทีม 🎉`;
  if (total < 200) return `${total} ข้อความ — ทีมนี้แน่มากเลย! 🏆`;
  return `${total} ข้อความ — เราสุดยอดมากๆ! 🦄✨`;
}

function checkMilestone(total) {
  const seen = parseInt(localStorage.getItem(MILESTONE_KEY) || '0', 10);
  const hit  = MILESTONES.filter(m => m <= total && m > seen).pop();
  if (!hit) return;
  localStorage.setItem(MILESTONE_KEY, String(hit));

  const bar = document.getElementById('stats-bar');
  if (!bar) return;
  bar.classList.add('milestone-pop');
  bar.addEventListener('animationend', () => bar.classList.remove('milestone-pop'), { once: true });
}

function updateStats() {
  const msgs  = pinnedMsg ? [pinnedMsg, ...allMessages] : allMessages;
  const total = msgs.length;
  const thank = msgs.filter(m => m.category === 'thank_you').length;
  const idea  = msgs.filter(m => m.category === 'idea').length;
  const cheer = msgs.filter(m => m.category === 'cheer_up').length;
  const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
  set('stat-total', total);
  set('stat-thank', thank);
  set('stat-idea',  idea);
  set('stat-cheer', cheer);

  const tagline = getMilestoneTagline(total);
  const tagEl   = document.getElementById('stat-tagline');
  if (tagEl) tagEl.textContent = tagline ?? '';

  checkMilestone(total);
}

function updateCardReactions(id, rxn) {
  const r = rxn ?? {};
  document.querySelectorAll(`.rxn-btn[data-id="${id}"]`).forEach(btn => {
    const countEl = btn.querySelector('.rxn-count');
    if (countEl) countEl.textContent = r[btn.dataset.type] ?? 0;
  });
}

let _renderGen = 0;

function renderGrid(messages) {
  const board    = document.getElementById('board');
  const filtered = activeFilter === 'all'
    ? messages
    : messages.filter(m => m.category === activeFilter);

  board.classList.remove('board-empty');
  updateStats();

  if (filtered.length === 0) {
    board.innerHTML = renderEmpty(activeFilter);
    board.classList.add('board-empty');
    return;
  }

  board.innerHTML = '';
  const BATCH = 5;
  let offset = 0;
  const gen = ++_renderGen;

  function renderBatch() {
    if (gen !== _renderGen) return;
    const slice = filtered.slice(offset, offset + BATCH);
    const frag  = document.createDocumentFragment();
    slice.forEach((msg, i) => {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderCard(msg, offset + i).trim();
      frag.appendChild(tmp.firstElementChild);
    });
    board.appendChild(frag);
    offset += BATCH;
    if (offset < filtered.length) {
      requestAnimationFrame(renderBatch);
    } else {
      wireReactions();
      observeCards();
    }
  }

  requestAnimationFrame(renderBatch);
}

async function loadBoard() {
  const board   = document.getElementById('board');
  const motwEl  = document.getElementById('motw-container');
  const motwSec = document.getElementById('motw-section');

  motwEl.innerHTML = skelMotw();
  board.innerHTML  = skelCard().repeat(4);
  board.classList.remove('board-empty');

  const { data, error } = await sb
    .from('cheer_up_messages')
    .select('*')
    .eq('is_visible', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false });

  if (error) {
    motwSec.style.display = 'none';
    board.innerHTML = renderError(error);
    board.classList.add('board-empty');
    return;
  }

  const rows    = data ?? [];
  const pinned  = rows.find(m => m.is_pinned);
  const regular = rows.filter(m => !m.is_pinned);

  pinnedMsg = pinned ?? null;
  if (pinned) {
    motwSec.style.display = '';
    motwEl.innerHTML = renderMotw(pinned);
  } else {
    motwSec.style.display = 'none';
  }

  allMessages = regular;
  renderGrid(allMessages);
  wireReactions();
  observeCards();
}

/* ── Filter pills ────────────────────────────────────────── */
function setActiveFilter(filter) {
  document.querySelectorAll('.filter-pill').forEach(p => {
    const isActive = p.dataset.filter === filter;
    p.classList.toggle('active', isActive);
    p.setAttribute('aria-pressed', isActive ? 'true' : 'false');
  });
  activeFilter = filter;
  renderGrid(allMessages);
}

document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => setActiveFilter(pill.dataset.filter));
});

/* ══════════════════════════════════════════════════════════
   FOCUS TRAP UTILITY
   ══════════════════════════════════════════════════════════ */
const FOCUSABLE = 'a[href],button:not([disabled]),input,textarea,select,[tabindex]:not([tabindex="-1"])';

function trapFocus(containerEl) {
  const focusable = () => [...containerEl.querySelectorAll(FOCUSABLE)].filter(el => !el.closest('[aria-hidden="true"]'));
  function handler(e) {
    if (e.key !== 'Tab') return;
    const els   = focusable();
    const first = els[0];
    const last  = els[els.length - 1];
    if (e.shiftKey) {
      if (document.activeElement === first) { e.preventDefault(); last?.focus(); }
    } else {
      if (document.activeElement === last)  { e.preventDefault(); first?.focus(); }
    }
  }
  containerEl.addEventListener('keydown', handler);
  return () => containerEl.removeEventListener('keydown', handler);
}

/* ══════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════ */
const overlay  = document.getElementById('modal');
const openBtn  = document.getElementById('openModal');
const closeBtn = document.getElementById('closeModal');

let _removeTrap = null;
let _lastFocused = null;

function openModal() {
  _lastFocused = document.activeElement;
  overlay.classList.remove('hidden');
  resetForm();
  setTimeout(() => {
    document.getElementById('f-content')?.focus();
    _removeTrap = trapFocus(overlay);
  }, 80);
}
function closeModal() {
  overlay.classList.add('hidden');
  if (_removeTrap) { _removeTrap(); _removeTrap = null; }
  _lastFocused?.focus();
}

openBtn?.addEventListener('click', openModal);
closeBtn?.addEventListener('click', closeModal);
overlay?.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

/* ══════════════════════════════════════════════════════════
   PHASE 3 — SUBMIT FORM
   ══════════════════════════════════════════════════════════ */

/* ── Form state ──────────────────────────────────────────── */
let selectedCategory = 'thank_you';
let selectedEmoji    = '🌟';

const contentEl = document.getElementById('f-content');
const charCount = document.getElementById('char-count');
const charWrap  = charCount?.closest('.char-counter');
const anonCheck = document.getElementById('f-anon');
const senderSec = document.getElementById('sender-section');

/* ── Category tabs ───────────────────────────────────────── */
document.querySelectorAll('.cat-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    document.querySelectorAll('.cat-tab').forEach(t => {
      t.classList.remove('active'); t.setAttribute('aria-checked', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-checked', 'true');
    selectedCategory = tab.dataset.cat;
    updateLivePreview();
  });
});

/* ── Emoji picker ────────────────────────────────────────── */
document.querySelectorAll('.emoji-opt').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.emoji-opt').forEach(b => {
      b.classList.remove('selected'); b.setAttribute('aria-pressed', 'false');
    });
    btn.classList.add('selected');
    btn.setAttribute('aria-pressed', 'true');
    selectedEmoji = btn.dataset.emoji;
    updateLivePreview();
  });
});

/* ── Char counter ────────────────────────────────────────── */
contentEl?.addEventListener('input', () => {
  const len = contentEl.value.length;
  if (charCount) charCount.textContent = len;
  charWrap?.classList.toggle('warn', len >= 450 && len <= 500);
  charWrap?.classList.toggle('over', len > 500);
  updateLivePreview();
});

/* ── Anon toggle ─────────────────────────────────────────── */
anonCheck?.addEventListener('change', () => {
  if (senderSec) senderSec.style.display = anonCheck.checked ? 'none' : '';
  updateLivePreview();
});

/* ── Sender name (live preview) ──────────────────────────── */
document.getElementById('f-sender')?.addEventListener('input', updateLivePreview);

/* ── Helpers ─────────────────────────────────────────────── */
function showFormError(msg) {
  const el = document.getElementById('form-error');
  if (!el) return;
  el.textContent = msg;
  el.classList.remove('hidden');
}
function clearFormError() { document.getElementById('form-error')?.classList.add('hidden'); }

function setSubmitting(on) {
  const btn     = document.getElementById('submit-btn');
  const label   = document.getElementById('submit-label');
  const spinner = document.getElementById('submit-spinner');
  if (!btn) return;
  btn.disabled = on;
  if (label)   label.textContent = on ? 'กำลังส่ง...' : '✨ ส่งข้อความ';
  spinner?.classList.toggle('hidden', !on);
}

function resetForm() {
  selectedCategory = 'thank_you';
  document.querySelectorAll('.cat-tab').forEach(t => {
    const def = t.dataset.cat === 'thank_you';
    t.classList.toggle('active', def);
    t.setAttribute('aria-checked', def ? 'true' : 'false');
  });

  selectedEmoji = '🌟';
  document.querySelectorAll('.emoji-opt').forEach(b => {
    const def = b.dataset.emoji === '🌟';
    b.classList.toggle('selected', def);
    b.setAttribute('aria-pressed', def ? 'true' : 'false');
  });

  if (contentEl) contentEl.value = '';
  if (charCount) charCount.textContent = '0';
  charWrap?.classList.remove('warn', 'over');

  const senderEl = document.getElementById('f-sender');
  if (senderEl) senderEl.value = '';
  if (anonCheck) anonCheck.checked = false;
  if (senderSec) senderSec.style.display = '';

  clearFormError();
  setSubmitting(false);
  updateLivePreview();
}

/* ── Live preview ────────────────────────────────────────── */
function updateLivePreview() {
  const previewCard   = document.getElementById('preview-card');
  const previewAvatar = document.getElementById('preview-avatar');
  const previewBadge  = document.getElementById('preview-badge');
  const previewMsg    = document.getElementById('preview-msg');
  const previewSender = document.getElementById('preview-sender');
  if (!previewCard) return;

  const cat    = CAT[selectedCategory] ?? CAT.cheer_up;
  const msg    = contentEl?.value.trim()                            ?? '';
  const sender = document.getElementById('f-sender')?.value.trim() ?? '';
  const anon   = anonCheck?.checked ?? false;

  // data-category drives the border-left colour via existing CSS selectors
  previewCard.dataset.category = selectedCategory;

  if (previewAvatar) previewAvatar.textContent = selectedEmoji;

  if (previewBadge) {
    previewBadge.textContent = `${cat.emoji} ${cat.label}`;
    previewBadge.className   = `card-badge badge-${cat.cls}`;
  }

  if (previewMsg) {
    if (msg) {
      previewMsg.textContent = msg;
      previewMsg.classList.remove('preview-msg-placeholder');
    } else {
      previewMsg.textContent = 'ข้อความของคุณจะแสดงที่นี่...';
      previewMsg.classList.add('preview-msg-placeholder');
    }
  }

  if (previewSender) {
    previewSender.textContent = `— ${(anon || !sender) ? 'ไม่ระบุชื่อ' : sender}`;
  }
}

/* ── Confetti ────────────────────────────────────────────── */
function fireConfetti(category) {
  if (typeof confetti !== 'function') return;
  const palettes = {
    thank_you: ['#FFB8A0', '#FF8A70', '#FFD97A'],
    idea:      ['#9DC0FF', '#5B8DEF', '#B8A0FF'],
    cheer_up:  ['#8AD9B0', '#4BBE82', '#D4F4E2'],
  };
  const colors = palettes[category] ?? palettes.thank_you;
  const end    = Date.now() + 2400;
  (function frame() {
    confetti({ particleCount: 4, angle: 60,  spread: 70, origin: { x: 0 }, colors });
    confetti({ particleCount: 4, angle: 120, spread: 70, origin: { x: 1 }, colors });
    if (Date.now() < end) requestAnimationFrame(frame);
  })();
}

/* ── Submit success interstitial ─────────────────────────── */
function showSubmitSuccess(msg) {
  const box = document.querySelector('.modal-box');
  if (!box) { closeModal(); resetForm(); return; }

  const cat    = CAT[msg.category] ?? CAT.cheer_up;
  const sender = (msg.is_anonymous || !msg.sender_name || msg.sender_name === 'Anonymous')
    ? 'ไม่ระบุชื่อ' : msg.sender_name;

  // Inject a success panel that sits on top of the form content
  const panel = document.createElement('div');
  panel.className = 'success-panel';
  panel.setAttribute('role', 'status');
  panel.setAttribute('aria-live', 'assertive');
  panel.innerHTML = `
    <div class="success-icon" aria-hidden="true">✅</div>
    <h2 class="success-title">ส่งสำเร็จแล้ว!</h2>
    <p class="success-sub">การ์ดของคุณอยู่บนกระดานแล้วนะ 🎉</p>
    <article class="card success-preview-card" style="--r:0deg" data-category="${msg.category}">
      <div class="card-head">
        <span class="card-avatar" aria-hidden="true">${esc(msg.avatar_emoji ?? '🌟')}</span>
        <span class="card-badge badge-${cat.cls}">${cat.emoji} ${cat.label}</span>
      </div>
      <p class="card-msg">${esc(msg.content)}</p>
      <div class="card-foot">
        <div class="card-meta">
          <span class="card-sender">— ${esc(sender)}</span>
          <span class="card-time">เพิ่งโพสต์</span>
        </div>
      </div>
    </article>`;

  box.appendChild(panel);
  // Trigger entrance animation on next frame
  requestAnimationFrame(() => panel.classList.add('success-panel--visible'));

  setTimeout(() => {
    closeModal();
    panel.remove();
    resetForm();
  }, 2500);
}

/* ── Submit handler ──────────────────────────────────────── */
document.getElementById('submit-form')?.addEventListener('submit', async e => {
  e.preventDefault();
  clearFormError();

  const content = contentEl?.value.trim() ?? '';
  const sender  = document.getElementById('f-sender')?.value.trim() ?? '';
  const anon    = anonCheck?.checked ?? false;

  if (!content) {
    showFormError('✍️ กรุณาเขียนข้อความก่อนนะ');
    contentEl?.focus();
    return;
  }
  if (content.length > 500) {
    showFormError('ข้อความยาวเกิน 500 ตัวอักษร กรุณาลดลงหน่อยนะ');
    contentEl?.focus();
    return;
  }

  setSubmitting(true);

  const payload = {
    category:     selectedCategory,
    content,
    sender_name:  anon || !sender ? 'ไม่ระบุชื่อ' : sender,
    is_anonymous: anon,
    avatar_emoji: selectedEmoji,
    reactions:    { thumbs_up: 0, heart: 0, clap: 0 },
    is_visible:   true,
    is_pinned:    false,
  };
  const { data, error } = await sb
    .from('cheer_up_messages')
    .insert(payload)
    .select()
    .single();

  setSubmitting(false);

  if (error) {
    console.error('[Submit]', error);
    showFormError('ส่งไม่สำเร็จ กรุณาลองอีกครั้ง 🙏');
    return;
  }

  // Prepend new card + reset filter to show it
  allMessages.unshift(data);
  setActiveFilter('all');
  wireReactions();

  fireConfetti(selectedCategory);
  showSubmitSuccess(data);
});

/* ══════════════════════════════════════════════════════════
   PHASE 4 — REALTIME
   ══════════════════════════════════════════════════════════ */
function subscribeRealtime() {
  sb.channel('cheer-up-board')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cheer_up_messages' },
      ({ new: msg }) => {
        if (!msg.is_visible) return;
        if (allMessages.find(m => m.id === msg.id)) return; // already optimistically added
        allMessages.unshift(msg);
        renderGrid(allMessages);
      }
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cheer_up_messages' },
      ({ new: msg }) => {
        const motwEl  = document.getElementById('motw-container');
        const motwSec = document.getElementById('motw-section');

        // Sync pinned (MOTW) updates
        const motwCard = motwEl?.querySelector(`[data-id="${msg.id}"]`);
        if (motwCard) {
          if (!msg.is_visible || !msg.is_pinned) {
            motwSec.style.display = 'none';
          } else {
            updateCardReactions(msg.id, msg.reactions);
          }
        }

        const idx = allMessages.findIndex(m => m.id === msg.id);

        if (idx === -1) {
          // Became visible or un-pinned → add to board
          if (msg.is_visible && !msg.is_pinned) {
            allMessages.unshift(msg);
            renderGrid(allMessages);
          }
          return;
        }

        if (!msg.is_visible) {
          allMessages.splice(idx, 1);
          renderGrid(allMessages);
          return;
        }

        allMessages[idx] = msg;
        updateCardReactions(msg.id, msg.reactions);
      }
    )
    .subscribe();
}

/* ══════════════════════════════════════════════════════════
   FOCUS / READING MODE
   ══════════════════════════════════════════════════════════ */
const focusOverlay = document.getElementById('focus-overlay');

let _focusLastEl = null;

function openFocusMode(cardEl) {
  if (!focusOverlay) return;

  _focusLastEl = document.activeElement;
  focusOverlay.innerHTML = '';

  const clone = cardEl.cloneNode(true);
  clone.style.animationPlayState = '';
  // Remove expand ::after hint — not needed inside overlay
  clone.style.cursor = 'default';
  // Re-bind data attributes on all reaction buttons so wireReactions can use them
  clone.querySelectorAll('[data-bound]').forEach(el => delete el.dataset.bound);

  // Close button
  const closeBtn = document.createElement('button');
  closeBtn.className   = 'focus-close-btn';
  closeBtn.textContent = '✕';
  closeBtn.setAttribute('aria-label', 'ปิด');
  closeBtn.addEventListener('click', closeFocusMode);

  focusOverlay.appendChild(closeBtn);
  focusOverlay.appendChild(clone);
  focusOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  // Wire reactions on the cloned card
  wireReactions();

  // Focus the close button for keyboard users
  setTimeout(() => closeBtn.focus(), 80);
}

function closeFocusMode() {
  if (!focusOverlay || focusOverlay.classList.contains('hidden')) return;
  focusOverlay.classList.add('hidden');
  focusOverlay.addEventListener('transitionend', () => {
    focusOverlay.innerHTML = '';
    document.body.style.overflow = '';
  }, { once: true });
  _focusLastEl?.focus();
}

// Backdrop click — close only when clicking outside the card and close button
focusOverlay?.addEventListener('click', e => {
  if (!e.target.closest('.card') && !e.target.closest('.focus-close-btn')) closeFocusMode();
});

// Escape key — close focus mode
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeFocusMode();
});

// Delegated click on the board — open focus mode for card clicks,
// but let reaction buttons continue to work normally
document.getElementById('board')?.addEventListener('click', e => {
  if (e.target.closest('.rxn-btn') || e.target.closest('.reactions')) return;
  const card = e.target.closest('.card');
  if (card) openFocusMode(card);
});

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
loadBoard().then(subscribeRealtime);
