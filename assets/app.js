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

function compressImage(file) {
  return new Promise(resolve => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    img.onload = () => {
      URL.revokeObjectURL(url);
      const MAX_W = 1200;
      let { width, height } = img;
      if (width > MAX_W) { height = Math.round(height * MAX_W / width); width = MAX_W; }
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      canvas.getContext('2d').drawImage(img, 0, 0, width, height);
      canvas.toBlob(resolve, 'image/jpeg', 0.7);
    };
    img.onerror = () => { URL.revokeObjectURL(url); resolve(null); };
    img.src = url;
  });
}

/* ══════════════════════════════════════════════════════════
   AUTO-CENSOR
   ══════════════════════════════════════════════════════════ */
const BANNED_WORDS = [
  'badword1',
  'badword2',
  // Add Thai/English profanities here
];

const _censorRegex = BANNED_WORDS.length
  ? new RegExp(BANNED_WORDS.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gi')
  : null;

function censorText(text) {
  if (!_censorRegex) return text;
  return String(text).replace(_censorRegex, '***');
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

function getCommentCount(msg) {
  return Number(msg?.comments?.[0]?.count ?? msg?.comment_count ?? 0);
}

function setCommentCount(msg, count) {
  if (!msg) return;
  msg.comments = [{ count: Math.max(0, Number(count) || 0) }];
}

function commentCounterHtml(msg) {
  const count = getCommentCount(msg);
  return `
    <span class="comment-counter" data-comment-id="${msg.id}" aria-label="${count} comments">
      <svg class="comment-counter-icon" viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.8 8.8 0 0 1-3.7-.8L3 20.5l1.4-4.7A8.2 8.2 0 0 1 3 11.5C3 6.9 7 3.1 12 3.1s9 3.8 9 8.4Z" />
      </svg>
      <span class="comment-count">${count}</span>
    </span>`;
}

/* Exported for Phase 3 optimistic prepend */
function renderCard(msg, idx, query = '') {
  const cat       = CAT[msg.category] ?? CAT.cheer_up;
  const avatar    = msg.avatar_emoji  ?? '🌟';
  const sender    = (msg.is_anonymous || !msg.sender_name || msg.sender_name === 'Anonymous')
    ? 'ไม่ระบุชื่อ'
    : msg.sender_name;
  const recipient = msg.recipient_name?.trim() || '';
  const r         = ROTS[idx % ROTS.length];

  const rxn      = msg.reactions ?? {};
  const totalRxn = (rxn.thumbs_up ?? 0) + (rxn.heart ?? 0) + (rxn.clap ?? 0);
  const isNew    = (Date.now() - new Date(msg.created_at).getTime()) < 86_400_000;

  // Tier system: 🌟 bronze (5+) · 💎 silver (10+) · 👑 gold (20+)
  const tier = totalRxn >= 20 ? 'gold'
             : totalRxn >= 10 ? 'silver'
             : totalRxn >= 5  ? 'bronze'
             : null;

  const classes = ['card',
    tier   ? `is-popular tier-${tier}` : '',
    isNew  ? 'is-new'                  : '',
  ].filter(Boolean).join(' ');

  const TIER_BADGE = {
    bronze: { icon: '🌟', label: 'ข้อความยอดนิยม' },
    silver: { icon: '💎', label: 'ซุปเปอร์ฮิต'    },
    gold:   { icon: '👑', label: 'ตำนาน!'         },
  };

  // New badge only shows on non-popular cards; popular badge takes precedence
  const newBadge = (isNew && !tier)
    ? `<span class="badge-new" aria-label="ข้อความใหม่">✨ NEW</span>`
    : '';

  const popularBadge = tier
    ? `<span class="popular-badge tier-${tier}" aria-label="${TIER_BADGE[tier].label}">${TIER_BADGE[tier].icon} ${TIER_BADGE[tier].label}</span>`
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
      ${recipient ? `<div class="card-recipient" aria-label="ส่งถึง ${esc(recipient)}">${highlightText(recipient, query)}</div>` : ''}
      ${msg.image_url ? `<div class="card-image"><img src="${esc(msg.image_url)}" alt="" loading="lazy" decoding="async" /></div>` : ''}
      <p class="card-msg">${highlightText(msg.content, query)}</p>
      <div class="card-foot">
        <div class="card-meta">
          <span class="card-sender">— ${highlightText(sender, query)}</span>
          <span class="card-time">${thaiTime(msg.created_at)}</span>
        </div>
        <div class="card-engagement">
          ${rxnHtml(msg.id, msg.reactions)}
          ${commentCounterHtml(msg)}
        </div>
      </div>
    </article>`;
}

function renderMotw(msg) {
  const isAnnouncement = msg.category === 'announcement';
  const cat       = isAnnouncement
    ? { label: 'ประกาศ', emoji: '📢', cls: 'announcement' }
    : (CAT[msg.category] ?? CAT.cheer_up);
  const avatar    = msg.avatar_emoji  ?? '🌟';
  const sender    = (msg.is_anonymous || !msg.sender_name || msg.sender_name === 'Anonymous')
    ? 'ไม่ระบุชื่อ'
    : msg.sender_name;
  const recipient = msg.recipient_name?.trim() || '';

  const cardClass  = isAnnouncement ? 'motw-card is-announcement' : 'motw-card';
  const ariaLabel  = isAnnouncement
    ? 'ประกาศจากทีม GA — คลิกเพื่ออ่านและแสดงความคิดเห็น'
    : 'ข้อความแห่งสัปดาห์ — คลิกเพื่ออ่านและแสดงความคิดเห็น';
  const labelHtml  = isAnnouncement
    ? `<div class="motw-card-label announcement-label"><span aria-hidden="true">📢</span> ประกาศจากทีม GA</div>`
    : `<div class="motw-card-label"><span class="tag-star" aria-hidden="true">⭐</span> ข้อความแห่งสัปดาห์</div>`;

  return `
    <div class="${cardClass}" role="article" tabindex="0"
         data-id="${msg.id}" aria-label="${ariaLabel}">
      ${labelHtml}
      <div class="motw-left">
        <div class="motw-avatar" aria-label="อีโมจิผู้ส่ง">${esc(avatar)}</div>
        <div class="motw-body">
          <span class="motw-badge badge-${cat.cls}">${cat.emoji} ${cat.label}</span>
          ${recipient ? `<div class="motw-recipient" aria-label="ส่งถึง ${esc(recipient)}">${esc(recipient)}</div>` : ''}
          <p class="motw-message">"${esc(msg.content)}"</p>
          <div class="motw-footer">
            <div class="motw-meta">
              <span class="motw-sender">— ${esc(sender)}</span>
              <span class="motw-time">${thaiTime(msg.created_at)}</span>
            </div>
            ${rxnHtml(msg.id, msg.reactions)}
          </div>
        </div>
      </div>
      ${msg.image_url ? `
      <div class="motw-image-col">
        <img class="motw-image" src="${esc(msg.image_url)}" alt="รูปภาพประกอบ"
             loading="lazy" decoding="async" />
      </div>` : ''}
    </div>`;
}

function renderDigest(messages) {
  const ONE_WEEK = 7 * 86_400_000;
  const now      = Date.now();
  const weekly   = messages.filter(m => (now - new Date(m.created_at).getTime()) <= ONE_WEEK);

  if (weekly.length === 0) return null;

  const thank  = weekly.filter(m => m.category === 'thank_you').length;
  const idea   = weekly.filter(m => m.category === 'idea').length;
  const cheer  = weekly.filter(m => m.category === 'cheer_up').length;

  // Top card: only qualify cards that have at least 1 reaction
  const withRxn = weekly
    .map(m => {
      const rxn = m.reactions ?? {};
      return { m, t: (rxn.thumbs_up ?? 0) + (rxn.heart ?? 0) + (rxn.clap ?? 0) };
    })
    .filter(({ t }) => t > 0);

  const topCard = withRxn.length > 0
    ? withRxn.reduce((best, cur) => cur.t > best.t ? cur : best, withRxn[0]).m
    : null;

  const topSender = topCard
    ? (topCard.is_anonymous || !topCard.sender_name ? 'ไม่ระบุชื่อ' : topCard.sender_name)
    : null;

  const bars = [
    { label: '💝 ขอบคุณ', count: thank, max: weekly.length, color: 'rgba(249,115,22,0.55)' },
    { label: '💡 ไอเดีย',  count: idea,  max: weekly.length, color: 'rgba(59,130,246,0.55)'  },
    { label: '🌈 เชียร์',  count: cheer, max: weekly.length, color: 'rgba(16,185,129,0.55)'  },
  ];

  const barsHtml = bars.map(b => `
    <div class="digest-bar-row">
      <span class="digest-bar-label">${b.label}</span>
      <div class="digest-bar-track">
        <div class="digest-bar-fill" style="width:${b.max ? Math.round(b.count/b.max*100) : 0}%;background:${b.color}"></div>
      </div>
      <span class="digest-bar-count">${b.count}</span>
    </div>`).join('');

  const content80 = topCard?.content
    ? (topCard.content.slice(0, 80) + (topCard.content.length > 80 ? '…' : ''))
    : null;

  const topHtml = (topCard && content80) ? `
    <div class="digest-top">
      <span class="digest-top-label">⭐ ข้อความยอดนิยม</span>
      <p class="digest-top-msg">"${esc(content80)}"</p>
      <span class="digest-top-sender">— ${esc(topSender)}</span>
    </div>` : '';

  const cardClass = topHtml ? 'digest-card' : 'digest-card digest-card--solo';

  return `
    <div class="${cardClass}">
      <div class="digest-stats">
        <div class="digest-total">
          <span class="digest-total-num">${weekly.length}</span>
          <span class="digest-total-label">ข้อความสัปดาห์นี้</span>
        </div>
        <div class="digest-bars">${barsHtml}</div>
      </div>
      ${topHtml}
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
  today: {
    emoji: '✨',
    title: 'ยังไม่มีโพสต์ของวันนี้',
    sub:   'เป็นคนแรกที่ส่งกำลังใจวันนี้เลย!',
    cta:   '✨ เพิ่มข้อความแรกวันนี้',
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

function renderEmptySearch(q) {
  return `
    <div class="empty-state" role="status" aria-live="polite">
      <div class="empty-emoji">🔍</div>
      <h3 class="empty-title">ไม่พบข้อความที่ค้นหา</h3>
      <p class="empty-sub">ไม่มีข้อความที่ตรงกับ "<strong>${esc(q)}</strong>" ลองค้นหาด้วยคำอื่นดูนะ</p>
      <button class="empty-cta" onclick="document.getElementById('search-clear').click()">✕ ล้างการค้นหา</button>
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
let searchQuery  = '';
let pinnedMsg    = null;
let boardLocked  = false;
const reactedSet = new Set(); // key: `${msgId}:${type}`

// Infinite scroll pagination
let currentOffset = 0;
const PAGE_SIZE   = 30;
let hasMorePosts  = true;
let isFetching    = false;
let lastTimeGroup = null;

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

function updateCommentCounter(id, count) {
  document.querySelectorAll(`[data-comment-id="${id}"]`).forEach(el => {
    el.setAttribute('aria-label', `${count} comments`);
  });
  document.querySelectorAll(`[data-comment-id="${id}"] .comment-count`).forEach(el => {
    el.textContent = count;
  });
}

function incrementCommentCount(messageId) {
  const msg = allMessages.find(m => m.id === messageId)
           ?? (pinnedMsg?.id === messageId ? pinnedMsg : null);
  if (!msg) return;

  const next = getCommentCount(msg) + 1;
  setCommentCount(msg, next);
  updateCommentCounter(messageId, next);
}

let _renderGen = 0;

function getTimeGroup(createdAt) {
  const age = Date.now() - new Date(createdAt).getTime();
  if (age < 86_400_000)     return 'today';
  if (age < 7 * 86_400_000) return 'this_week';
  return 'older';
}

const DIVIDER_LABEL = {
  today:     '✨ โพสต์ของวันนี้',
  this_week: '📅 สัปดาห์นี้',
  older:     '🕰️ ก่อนหน้านี้',
};

function makeDividerEl(group) {
  const el = document.createElement('div');
  el.className = 'grid-divider';
  el.innerHTML = `<span>${DIVIDER_LABEL[group]}</span>`;
  return el;
}

function highlightText(text, query) {
  if (!query) return esc(text);
  const escaped = esc(text);
  const safeQ   = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return escaped.replace(new RegExp(safeQ, 'gi'), m => `<mark class="search-match">${m}</mark>`);
}

function renderGrid(messages) {
  const board = document.getElementById('board');
  const q     = searchQuery.trim().toLowerCase();

  let filtered = activeFilter === 'all'
    ? messages
    : activeFilter === 'today'
      ? messages.filter(m => (Date.now() - new Date(m.created_at).getTime()) < 86_400_000)
      : messages.filter(m => m.category === activeFilter);

  if (q) {
    filtered = filtered.filter(m =>
      m.content?.toLowerCase().includes(q) ||
      m.sender_name?.toLowerCase().includes(q) ||
      m.recipient_name?.toLowerCase().includes(q)
    );
  }

  board.classList.remove('board-empty');
  updateStats();

  if (filtered.length === 0) {
    // Unobserve before wipe to prevent IntersectionObserver memory leak
    board.querySelectorAll('.card[data-observed]').forEach(c => _cardObserver.unobserve(c));
    board.innerHTML = q ? renderEmptySearch(q) : renderEmpty(activeFilter);
    board.classList.add('board-empty');
    return;
  }

  // Unobserve all cards before wiping DOM
  board.querySelectorAll('.card[data-observed]').forEach(c => _cardObserver.unobserve(c));
  board.innerHTML = '';
  const BATCH = 5;
  let offset = 0;
  const gen = ++_renderGen;
  lastTimeGroup = null;

  function renderBatch() {
    if (gen !== _renderGen) return;
    const slice = filtered.slice(offset, offset + BATCH);
    const frag  = document.createDocumentFragment();
    slice.forEach((msg, i) => {
      if (activeFilter === 'all') {
        const group = getTimeGroup(msg.created_at);
        if (group !== lastTimeGroup) {
          frag.appendChild(makeDividerEl(group));
          lastTimeGroup = group;
        }
      }
      const tmp = document.createElement('div');
      tmp.innerHTML = renderCard(msg, offset + i, q).trim();
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

function appendToBoard(newMessages) {
  const board = document.getElementById('board');
  const q = searchQuery.trim().toLowerCase();

  let filtered = activeFilter === 'all'
    ? newMessages
    : activeFilter === 'today'
      ? newMessages.filter(m => (Date.now() - new Date(m.created_at).getTime()) < 86_400_000)
      : newMessages.filter(m => m.category === activeFilter);

  if (q) {
    filtered = filtered.filter(m =>
      m.content?.toLowerCase().includes(q) ||
      m.sender_name?.toLowerCase().includes(q) ||
      m.recipient_name?.toLowerCase().includes(q)
    );
  }

  if (filtered.length === 0) return;

  // If board was empty-state, wipe it first
  const emptyEl = board.querySelector('.empty-state');
  if (emptyEl) {
    board.innerHTML = '';
    board.classList.remove('board-empty');
    lastTimeGroup = null;
  }

  const startIdx = board.querySelectorAll('.card').length;
  const frag = document.createDocumentFragment();
  filtered.forEach((msg, i) => {
    if (activeFilter === 'all') {
      const group = getTimeGroup(msg.created_at);
      if (group !== lastTimeGroup) {
        frag.appendChild(makeDividerEl(group));
        lastTimeGroup = group;
      }
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = renderCard(msg, startIdx + i, q).trim();
    frag.appendChild(tmp.firstElementChild);
  });
  board.appendChild(frag);
  wireReactions();
  observeCards();
}

function applyMaintenanceMode(isLocked) {
  boardLocked = isLocked;
  const btn    = document.getElementById('openModal');
  const banner = document.getElementById('maintenance-banner');
  if (btn)    btn.style.display    = isLocked ? 'none' : '';
  if (banner) banner.style.display = isLocked ? ''     : 'none';
}

async function fetchMessagesPage() {
  if (isFetching || !hasMorePosts) return;
  isFetching = true;

  const spinner = document.getElementById('scroll-spinner');
  spinner?.classList.remove('hidden');

  const { data, error } = await sb.from('cheer_up_messages')
    .select('*, comments(count)')
    .eq('is_visible', true)
    .order('is_pinned', { ascending: false })
    .order('created_at', { ascending: false })
    .range(currentOffset, currentOffset + PAGE_SIZE - 1);

  spinner?.classList.add('hidden');
  isFetching = false;

  if (error) { console.error('[Fetch page]', error); return; }

  const rows = data ?? [];
  if (rows.length < PAGE_SIZE) hasMorePosts = false;

  const regular = rows.filter(m => !m.is_pinned);
  currentOffset += rows.length;

  allMessages.push(...regular);
  updateStats();
  appendToBoard(regular);
}

async function loadBoard() {
  isFetching = true;
  allMessages = [];
  currentOffset = 0;
  hasMorePosts = true;

  const board   = document.getElementById('board');
  const motwEl  = document.getElementById('motw-container');
  const motwSec = document.getElementById('motw-section');

  motwEl.innerHTML = skelMotw();
  board.innerHTML  = skelCard().repeat(4);
  board.classList.remove('board-empty');

  const [{ data, error }, { data: settingsData }] = await Promise.all([
    sb.from('cheer_up_messages')
      .select('*, comments(count)')
      .eq('is_visible', true)
      .order('is_pinned', { ascending: false })
      .order('created_at', { ascending: false })
      .range(0, PAGE_SIZE - 1),
    sb.from('board_settings').select('is_locked').eq('id', 1).single(),
  ]);

  applyMaintenanceMode(settingsData?.is_locked ?? false);

  if (error) {
    isFetching = false;
    motwSec.style.display = 'none';
    board.innerHTML = renderError(error);
    board.classList.add('board-empty');
    return;
  }

  const rows    = data ?? [];
  const pinned  = rows.find(m => m.is_pinned);
  const regular = rows.filter(m => !m.is_pinned);

  currentOffset = rows.length;
  hasMorePosts  = rows.length >= PAGE_SIZE;

  pinnedMsg = pinned ?? null;
  if (pinned) {
    motwSec.style.display = '';
    motwEl.innerHTML = renderMotw(pinned);
    const motwCard = motwEl.querySelector('.motw-card');
    motwCard?.addEventListener('click', e => {
      if (!e.target.closest('.rxn-btn') && !e.target.closest('.reactions')) {
        openFocusMode(motwCard);
      }
    });
    motwCard?.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openFocusMode(motwCard); }
    });
  } else {
    motwSec.style.display = 'none';
  }

  allMessages = regular;

  // Weekly Digest
  const digestSec = document.getElementById('digest-section');
  const digestEl  = document.getElementById('digest-container');
  const digestHtml = renderDigest([...(pinned ? [pinned] : []), ...regular]);
  if (digestHtml && digestSec && digestEl) {
    digestEl.innerHTML = digestHtml;
    digestSec.classList.remove('hidden');
  } else if (digestSec) {
    digestSec.classList.add('hidden');
  }

  renderGrid(allMessages);
  wireReactions();
  observeCards();
  isFetching = false;
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

/* ── Search ──────────────────────────────────────────────── */
(function initSearch() {
  const input    = document.getElementById('search-input');
  const clearBtn = document.getElementById('search-clear');
  if (!input) return;

  let _debounce = null;

  function applySearch(val) {
    searchQuery = val;
    clearBtn?.classList.toggle('hidden', !val);
    renderGrid(allMessages);
  }

  input.addEventListener('input', () => {
    clearTimeout(_debounce);
    _debounce = setTimeout(() => applySearch(input.value), 180);
  });

  input.addEventListener('keydown', e => {
    if (e.key === 'Escape') { input.value = ''; applySearch(''); input.blur(); }
  });

  clearBtn?.addEventListener('click', () => {
    input.value = '';
    applySearch('');
    input.focus();
  });
})();

/* ── Digest Accordion Toggle ─────────────────────────────── */
(function initDigestAccordion() {
  const btn  = document.getElementById('digest-toggle');
  const body = document.getElementById('digest-body');
  if (!btn || !body) return;

  btn.addEventListener('click', () => {
    const open = btn.getAttribute('aria-expanded') === 'true';
    btn.setAttribute('aria-expanded', String(!open));
    body.setAttribute('aria-expanded', String(!open));
  });

  // Also open via keyboard Enter/Space (button already handles these natively)
})();

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
  if (boardLocked) return;
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
let selectedCategory   = 'thank_you';
let selectedEmoji      = '🌟';
let selectedImageBlob  = null;
let selectedImageObjUrl = null;

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

/* ── Image upload ────────────────────────────────────────── */
function clearSelectedImage() {
  selectedImageBlob = null;
  if (selectedImageObjUrl) { URL.revokeObjectURL(selectedImageObjUrl); selectedImageObjUrl = null; }
  const fileInput = document.getElementById('f-image');
  if (fileInput) fileInput.value = '';
  const btn = document.getElementById('img-upload-btn');
  if (btn) { btn.innerHTML = `<svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="14" height="14" aria-hidden="true"><rect x="2" y="5" width="16" height="12" rx="2" stroke="currentColor" stroke-width="1.6"/><circle cx="10" cy="11" r="3" stroke="currentColor" stroke-width="1.6"/><path d="M7 5V4a2 2 0 0 1 6 0v1" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg> 📷 เพิ่มรูปภาพ`; btn.classList.remove('has-image'); }
  document.getElementById('img-remove-btn')?.remove();
  updateLivePreview();
}

(function initImageUpload() {
  const uploadBtn = document.getElementById('img-upload-btn');
  const fileInput = document.getElementById('f-image');
  if (!uploadBtn || !fileInput) return;

  uploadBtn.addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files[0];
    if (!file) return;
    const blob = await compressImage(file);
    if (!blob) return;
    selectedImageBlob = blob;
    if (selectedImageObjUrl) URL.revokeObjectURL(selectedImageObjUrl);
    selectedImageObjUrl = URL.createObjectURL(blob);
    uploadBtn.textContent = '✅ เปลี่ยนรูป';
    uploadBtn.classList.add('has-image');
    if (!document.getElementById('img-remove-btn')) {
      const rmBtn = document.createElement('button');
      rmBtn.type = 'button'; rmBtn.id = 'img-remove-btn'; rmBtn.className = 'img-remove-btn';
      rmBtn.textContent = '✕'; rmBtn.setAttribute('aria-label', 'ลบรูป');
      rmBtn.addEventListener('click', clearSelectedImage);
      uploadBtn.parentElement.appendChild(rmBtn);
    }
    updateLivePreview();
  });
})();

/* ── Sender name & recipient (live preview) ──────────────── */
document.getElementById('f-sender')?.addEventListener('input', updateLivePreview);
document.getElementById('f-recipient')?.addEventListener('input', updateLivePreview);

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

  const senderEl    = document.getElementById('f-sender');
  const recipientEl = document.getElementById('f-recipient');
  if (senderEl)    senderEl.value    = '';
  if (recipientEl) recipientEl.value = '';
  if (anonCheck) anonCheck.checked = false;
  if (senderSec) senderSec.style.display = '';

  clearSelectedImage();
  clearFormError();
  setSubmitting(false);
  updateLivePreview();
}

/* ── Live preview ────────────────────────────────────────── */
function updateLivePreview() {
  const previewCard      = document.getElementById('preview-card');
  const previewAvatar    = document.getElementById('preview-avatar');
  const previewBadge     = document.getElementById('preview-badge');
  const previewMsg       = document.getElementById('preview-msg');
  const previewSender    = document.getElementById('preview-sender');
  if (!previewCard) return;

  const cat       = CAT[selectedCategory] ?? CAT.cheer_up;
  const msg       = contentEl?.value.trim()                               ?? '';
  const sender    = document.getElementById('f-sender')?.value.trim()    ?? '';
  const recipient = document.getElementById('f-recipient')?.value.trim() ?? '';
  const anon      = anonCheck?.checked ?? false;

  previewCard.dataset.category = selectedCategory;

  if (previewAvatar) previewAvatar.textContent = selectedEmoji;

  if (previewBadge) {
    previewBadge.textContent = `${cat.emoji} ${cat.label}`;
    previewBadge.className   = `card-badge badge-${cat.cls}`;
  }

  // Recipient badge in preview
  let previewRecipient = previewCard.querySelector('.card-recipient');
  if (recipient) {
    if (!previewRecipient) {
      previewRecipient = document.createElement('div');
      previewRecipient.className = 'card-recipient';
      previewBadge?.closest('.card-head')?.after(previewRecipient);
    }
    previewRecipient.textContent = recipient;
  } else {
    previewRecipient?.remove();
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

  // Image preview inside live card
  let previewImgWrap = previewCard.querySelector('.card-image.preview-img');
  if (selectedImageObjUrl) {
    if (!previewImgWrap) {
      previewImgWrap = document.createElement('div');
      previewImgWrap.className = 'card-image preview-img';
      previewImgWrap.innerHTML = `<img alt="" loading="lazy" decoding="async" />`;
      const msgEl = previewCard.querySelector('.card-msg');
      if (msgEl) msgEl.before(previewImgWrap);
    }
    previewImgWrap.querySelector('img').src = selectedImageObjUrl;
  } else {
    previewImgWrap?.remove();
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

  const content   = contentEl?.value.trim() ?? '';
  const sender    = document.getElementById('f-sender')?.value.trim()    ?? '';
  const recipient = document.getElementById('f-recipient')?.value.trim() ?? '';
  const anon      = anonCheck?.checked ?? false;

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

  // Upload image to storage first (if one was selected)
  let imageUrl = null;
  if (selectedImageBlob) {
    const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.jpg`;
    const { data: uploadData, error: uploadErr } = await sb.storage
      .from('message-images')
      .upload(fileName, selectedImageBlob, { contentType: 'image/jpeg', upsert: false });
    if (uploadErr) {
      setSubmitting(false);
      showFormError('อัปโหลดรูปภาพไม่สำเร็จ กรุณาลองอีกครั้ง 🙏');
      return;
    }
    const { data: urlData } = sb.storage.from('message-images').getPublicUrl(uploadData.path);
    imageUrl = urlData.publicUrl;
  }

  const censoredContent = censorText(content);

  const payload = {
    category:     selectedCategory,
    content:      censoredContent,
    sender_name:  anon || !sender ? 'ไม่ระบุชื่อ' : sender,
    is_anonymous: anon,
    avatar_emoji: selectedEmoji,
    reactions:    { thumbs_up: 0, heart: 0, clap: 0 },
    is_visible:   true,
    is_pinned:    false,
    ...(recipient  ? { recipient_name: recipient }   : {}),
    ...(imageUrl   ? { image_url: imageUrl }          : {}),
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
  setCommentCount(data, getCommentCount(data));
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
        setCommentCount(msg, 0);
        allMessages.unshift(msg);
        updateStats();

        const board = document.getElementById('board');
        const q = searchQuery.trim().toLowerCase();
        const passesFilter = activeFilter === 'all' || msg.category === activeFilter;
        const passesSearch = !q ||
          msg.content?.toLowerCase().includes(q) ||
          msg.sender_name?.toLowerCase().includes(q) ||
          msg.recipient_name?.toLowerCase().includes(q);

        if (!passesFilter || !passesSearch) return;

        // Surgical prepend — avoids wiping the entire grid
        const emptyEl = board.querySelector('.empty-state');
        if (emptyEl) {
          renderGrid(allMessages); // was empty, need full render
          return;
        }
        const tmp = document.createElement('div');
        tmp.innerHTML = renderCard(msg, 0, q).trim();
        const newCard = tmp.firstElementChild;
        if (newCard) {
          board.prepend(newCard);
          wireReactions();
          _cardObserver.observe(newCard);
        }
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
            setCommentCount(msg, getCommentCount(pinnedMsg));
            pinnedMsg = msg;
            updateCardReactions(msg.id, msg.reactions);
            updateCommentCounter(msg.id, getCommentCount(msg));
          }
        }

        const idx = allMessages.findIndex(m => m.id === msg.id);

        if (idx === -1) {
          // Became visible or un-pinned → add to board
          if (msg.is_visible && !msg.is_pinned) {
            setCommentCount(msg, 0);
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

        setCommentCount(msg, getCommentCount(allMessages[idx]));
        allMessages[idx] = msg;
        updateCardReactions(msg.id, msg.reactions);
      }
    )
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'comments' },
      ({ new: comment }) => {
        incrementCommentCount(comment.message_id);
      }
    )
    .subscribe();

  // Board settings — maintenance mode realtime
  sb.channel('board-settings-watch')
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'board_settings', filter: 'id=eq.1' },
      ({ new: settings }) => {
        applyMaintenanceMode(settings.is_locked);
      }
    )
    .subscribe();
}

/* ══════════════════════════════════════════════════════════
   COMMENTS
   ══════════════════════════════════════════════════════════ */
let _commentChannel = null;

function renderComment(c) {
  return `
    <div class="focus-comment">
      <div class="focus-comment-meta">
        <span class="focus-comment-sender">${esc(c.sender_name ?? 'ไม่ระบุชื่อ')}</span>
        <span class="focus-comment-time">${thaiTime(c.created_at)}</span>
      </div>
      <p class="focus-comment-text">${esc(c.comment_text)}</p>
    </div>`;
}

async function fetchAndSubscribeComments(msgId, threadEl) {
  const { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('message_id', msgId)
    .order('created_at', { ascending: true });

  if (error) {
    threadEl.innerHTML = `<p class="focus-comments-empty">โหลดความคิดเห็นไม่สำเร็จ</p>`;
    return;
  }

  const comments = data ?? [];
  threadEl.innerHTML = '';
  if (comments.length === 0) {
    threadEl.innerHTML = `<p class="focus-comments-empty">ยังไม่มีความคิดเห็น<br>เป็นคนแรกที่แสดงความคิดเห็นเลย 💬</p>`;
  } else {
    comments.forEach(c => {
      const tmp = document.createElement('div');
      tmp.innerHTML = renderComment(c).trim();
      threadEl.appendChild(tmp.firstElementChild);
    });
    threadEl.scrollTop = threadEl.scrollHeight;
  }

  if (_commentChannel) { sb.removeChannel(_commentChannel); _commentChannel = null; }

  _commentChannel = sb.channel(`comments:${msgId}`)
    .on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'comments',
      filter: `message_id=eq.${msgId}`,
    }, ({ new: comment }) => {
      const emptyEl = threadEl.querySelector('.focus-comments-empty');
      if (emptyEl) emptyEl.remove();
      const tmp = document.createElement('div');
      tmp.innerHTML = renderComment(comment).trim();
      threadEl.appendChild(tmp.firstElementChild);
      threadEl.scrollTop = threadEl.scrollHeight;
    })
    .subscribe();
}

async function postComment(msgId, senderName, text) {
  const { error } = await sb.from('comments').insert({
    message_id:   msgId,
    sender_name:  senderName || 'ไม่ระบุชื่อ',
    comment_text: text,
  });
  if (error) console.error('[Comment]', error);
}

/* ══════════════════════════════════════════════════════════
   FOCUS / READING MODE
   ══════════════════════════════════════════════════════════ */
const focusOverlay = document.getElementById('focus-overlay');

let _focusLastEl = null;

function openFocusMode(cardEl) {
  if (!focusOverlay) return;

  const msgId = cardEl.dataset.id;
  const msg   = allMessages.find(m => m.id === msgId)
             ?? (pinnedMsg?.id === msgId ? pinnedMsg : null);
  if (!msg) return;

  _focusLastEl = document.activeElement;
  focusOverlay.innerHTML = '';
  focusOverlay.classList.add('split-mode');

  const cat    = CAT[msg.category] ?? CAT.cheer_up;
  const avatar = msg.avatar_emoji  ?? '🌟';
  const sender = (msg.is_anonymous || !msg.sender_name || msg.sender_name === 'Anonymous')
    ? 'ไม่ระบุชื่อ' : msg.sender_name;

  // ── Left pane: image + message ────────────────────────
  const leftPane = document.createElement('div');
  leftPane.className = 'focus-split-left';
  leftPane.innerHTML = `
    ${msg.image_url
      ? `<div class="focus-image-wrap"><img class="focus-image" src="${esc(msg.image_url)}" alt="รูปภาพประกอบ" loading="lazy" decoding="async" /></div>`
      : ''}
    <div>
      <div class="focus-msg-head">
        <span class="card-avatar" aria-hidden="true">${esc(avatar)}</span>
        <span class="card-badge badge-${cat.cls}">${cat.emoji} ${cat.label}</span>
      </div>
      ${msg.recipient_name ? `<div class="card-recipient" aria-label="ส่งถึง ${esc(msg.recipient_name)}">${esc(msg.recipient_name)}</div>` : ''}
      <p class="focus-msg-text">"${esc(msg.content)}"</p>
      <div class="focus-msg-footer">
        <div class="card-meta">
          <span class="card-sender">— ${esc(sender)}</span>
          <span class="card-time">${thaiTime(msg.created_at)}</span>
        </div>
        ${rxnHtml(msg.id, msg.reactions)}
      </div>
    </div>`;

  // ── Right pane: comments ──────────────────────────────
  const rightPane = document.createElement('div');
  rightPane.className = 'focus-split-right';
  rightPane.innerHTML = `
    <div class="focus-comments-header">
      <span class="focus-comments-title">💬 ความคิดเห็น</span>
      <button class="focus-close-btn" aria-label="ปิด">✕</button>
    </div>
    <div class="focus-comments-thread" id="focus-comments-thread">
      <div style="display:flex;justify-content:center;padding:2rem 0">
        <span class="spinner" style="border-top-color:#f97316;border-color:rgba(249,115,22,.2)"></span>
      </div>
    </div>
    <div class="focus-comment-input-wrap">
      <div class="quick-emoji-bar" role="group" aria-label="ใส่อีโมจิ">
        <button type="button" class="emoji-quick-btn" data-emoji="👍" aria-label="👍">👍</button>
        <button type="button" class="emoji-quick-btn" data-emoji="❤️" aria-label="❤️">❤️</button>
        <button type="button" class="emoji-quick-btn" data-emoji="🎉" aria-label="🎉">🎉</button>
        <button type="button" class="emoji-quick-btn" data-emoji="✨" aria-label="✨">✨</button>
        <button type="button" class="emoji-quick-btn" data-emoji="🙌" aria-label="🙌">🙌</button>
      </div>
      <input class="focus-comment-name" type="text" placeholder="ชื่อของคุณ (ไม่บังคับ)" maxlength="60" />
      <div class="focus-comment-row">
        <textarea class="focus-comment-textarea" placeholder="เขียนความคิดเห็น..." rows="2" maxlength="300"></textarea>
        <button class="focus-comment-submit" aria-label="ส่งความคิดเห็น">
          <svg viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" width="16" height="16" aria-hidden="true">
            <path d="M17 10L3 3.5L6.5 10L3 16.5L17 10Z" fill="currentColor"/>
          </svg>
        </button>
      </div>
    </div>`;

  // ── Assemble split wrapper ────────────────────────────
  const split = document.createElement('div');
  split.className = 'focus-split';
  split.appendChild(leftPane);
  split.appendChild(rightPane);

  focusOverlay.appendChild(split);
  focusOverlay.classList.remove('hidden');
  document.body.style.overflow = 'hidden';

  wireReactions();

  // Close button
  rightPane.querySelector('.focus-close-btn').addEventListener('click', closeFocusMode);

  // Comments: fetch + realtime
  const threadEl = rightPane.querySelector('#focus-comments-thread');
  fetchAndSubscribeComments(msg.id, threadEl);

  // Comment submit
  const nameInput   = rightPane.querySelector('.focus-comment-name');
  const textarea    = rightPane.querySelector('.focus-comment-textarea');
  const submitBtn   = rightPane.querySelector('.focus-comment-submit');

  async function handleCommentSubmit() {
    const text = textarea.value.trim();
    if (!text) return;
    submitBtn.disabled = true;
    await postComment(msg.id, nameInput.value.trim(), censorText(text));
    textarea.value = '';
    submitBtn.disabled = false;
    textarea.focus();
  }

  submitBtn.addEventListener('click', handleCommentSubmit);
  textarea.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleCommentSubmit(); }
  });

  rightPane.querySelectorAll('.emoji-quick-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      textarea.value += btn.dataset.emoji;
      textarea.focus();
    });
  });

  setTimeout(() => textarea.focus(), 80);
}

function closeFocusMode() {
  if (!focusOverlay || focusOverlay.classList.contains('hidden')) return;
  if (_commentChannel) { sb.removeChannel(_commentChannel); _commentChannel = null; }
  document.body.style.overflow = '';
  focusOverlay.classList.add('hidden');
  focusOverlay.classList.remove('split-mode');
  _focusLastEl?.focus();
  setTimeout(() => { focusOverlay.innerHTML = ''; }, 300);
}

// Backdrop click — close only when clicking the dark background, not the split dialog
focusOverlay?.addEventListener('click', e => {
  if (!e.target.closest('.focus-split') && !e.target.closest('.focus-wrapper')) closeFocusMode();
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
   DAILY NUDGE
   ══════════════════════════════════════════════════════════ */
(function initNudge() {
  const banner     = document.getElementById('nudge-banner');
  const dismissBtn = document.getElementById('nudge-dismiss');
  const ctaBtn     = document.getElementById('nudge-cta-btn');
  if (!banner) return;

  const NUDGE_KEY = 'cheer-nudge-dismissed';
  const today     = new Date().toDateString();

  // Show nudge if user hasn't dismissed today and hasn't posted today
  const lastDismissed = localStorage.getItem(NUDGE_KEY);
  if (lastDismissed === today) return;

  // Delay slightly so board loads first
  setTimeout(() => banner.classList.remove('hidden'), 1200);

  dismissBtn?.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem(NUDGE_KEY, today);
  });

  ctaBtn?.addEventListener('click', () => {
    banner.classList.add('hidden');
    localStorage.setItem(NUDGE_KEY, today);
    document.getElementById('openModal')?.click();
  });
})();

/* ══════════════════════════════════════════════════════════
   HEADER SCROLL SHRINK
   ══════════════════════════════════════════════════════════ */
(function initHeaderScroll() {
  const header = document.getElementById('site-header');
  if (!header) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      header.classList.toggle('header-scrolled', window.scrollY > 60);
      ticking = false;
    });
  }, { passive: true });
})();

/* ══════════════════════════════════════════════════════════
   INFINITE SCROLL
   ══════════════════════════════════════════════════════════ */
(function initInfiniteScroll() {
  const trigger = document.getElementById('scroll-trigger');
  if (!trigger) return;
  const obs = new IntersectionObserver(entries => {
    if (entries[0].isIntersecting && hasMorePosts && !isFetching) fetchMessagesPage();
  }, { rootMargin: '200px' });
  obs.observe(trigger);
})();

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
loadBoard().then(subscribeRealtime);
