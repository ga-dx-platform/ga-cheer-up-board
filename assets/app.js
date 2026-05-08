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
  const sender = msg.is_anonymous  ? 'ไม่ระบุชื่อ' : (msg.sender_name ?? 'ไม่ระบุชื่อ');
  const r      = ROTS[idx % ROTS.length];
  return `
    <article class="card card-${cat.cls}" style="--r:${r}deg"
             data-id="${msg.id}" data-category="${msg.category}">
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
  const sender = msg.is_anonymous  ? 'ไม่ระบุชื่อ' : (msg.sender_name ?? 'ไม่ระบุชื่อ');
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

function renderEmpty() {
  return `
    <div class="empty-state" role="status" aria-live="polite">
      <div class="empty-emoji">💌</div>
      <h3 class="empty-title">ยังไม่มีข้อความเลย!</h3>
      <p class="empty-sub">เป็นคนแรกที่แชร์ความรู้สึกดีๆ ให้ทีม</p>
      <button class="empty-cta" onclick="document.getElementById('openModal').click()">✨ เพิ่มข้อความแรก</button>
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

function wireReactions() {
  document.querySelectorAll('.rxn-btn').forEach(btn => {
    if (btn.dataset.bound) return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const isReacted = btn.classList.contains('reacted');
      const countEl   = btn.querySelector('.rxn-count');
      const current   = parseInt(countEl?.textContent || '0', 10);

      const key = `${btn.dataset.id}:${btn.dataset.type}`;

      btn.classList.add('popped');
      btn.addEventListener('animationend', () => btn.classList.remove('popped'), { once: true });
      btn.classList.toggle('reacted');

      if (!isReacted) {
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
      } else {
        reactedSet.delete(key);
        if (countEl) countEl.textContent = Math.max(0, current - 1);
      }
    });
  });
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
}

function updateCardReactions(id, rxn) {
  const r = rxn ?? {};
  document.querySelectorAll(`.rxn-btn[data-id="${id}"]`).forEach(btn => {
    const countEl = btn.querySelector('.rxn-count');
    if (countEl) countEl.textContent = r[btn.dataset.type] ?? 0;
  });
}

function renderGrid(messages) {
  const board    = document.getElementById('board');
  const filtered = activeFilter === 'all'
    ? messages
    : messages.filter(m => m.category === activeFilter);

  board.classList.remove('board-empty');

  if (filtered.length === 0) {
    board.innerHTML = renderEmpty();
    board.classList.add('board-empty');
    return;
  }

  board.innerHTML = filtered.map((msg, i) => renderCard(msg, i)).join('');
  wireReactions();
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
  updateStats();
}

/* ── Filter pills ────────────────────────────────────────── */
document.querySelectorAll('.filter-pill').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    activeFilter = pill.dataset.filter;
    renderGrid(allMessages);
  });
});

/* ══════════════════════════════════════════════════════════
   MODAL
   ══════════════════════════════════════════════════════════ */
const overlay  = document.getElementById('modal');
const openBtn  = document.getElementById('openModal');
const closeBtn = document.getElementById('closeModal');

function openModal() {
  overlay.classList.remove('hidden');
  resetForm();
  setTimeout(() => document.getElementById('f-content')?.focus(), 80);
}
function closeModal() { overlay.classList.add('hidden'); }

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
  });
});

/* ── Char counter ────────────────────────────────────────── */
contentEl?.addEventListener('input', () => {
  const len = contentEl.value.length;
  if (charCount) charCount.textContent = len;
  charWrap?.classList.toggle('warn', len >= 450 && len <= 500);
  charWrap?.classList.toggle('over', len > 500);
});

/* ── Anon toggle ─────────────────────────────────────────── */
anonCheck?.addEventListener('change', () => {
  if (senderSec) senderSec.style.display = anonCheck.checked ? 'none' : '';
});

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
    sender_name:  anon || !sender ? 'Anonymous' : sender,
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
  activeFilter = 'all';
  document.querySelectorAll('.filter-pill').forEach(p => p.classList.remove('active'));
  document.querySelector('.filter-pill[data-filter="all"]')?.classList.add('active');
  renderGrid(allMessages);
  wireReactions();
  updateStats();

  fireConfetti(selectedCategory);
  closeModal();
  resetForm();
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
        updateStats();
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
            updateStats();
          }
          return;
        }

        if (!msg.is_visible) {
          allMessages.splice(idx, 1);
          renderGrid(allMessages);
          updateStats();
          return;
        }

        allMessages[idx] = msg;
        updateCardReactions(msg.id, msg.reactions);
      }
    )
    .subscribe();
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
loadBoard().then(subscribeRealtime);
