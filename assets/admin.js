// GA Cheer Up Board — admin.js  (Phase 5)

/* ══════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════ */
const sb = supabase.createClient(
  'https://adbdcfofguflyyrvczvq.supabase.co',
  'sb_publishable_ERx_Z8GsAZCBRRL18HbwDw_4PWk2ahz'
);

/* ══════════════════════════════════════════════════════════
   CONSTANTS & UTILITIES
   ══════════════════════════════════════════════════════════ */
const CAT = {
  thank_you:   { label: 'ขอบคุณ',          emoji: '💝', cls: 'thank_you' },
  cheer_up:    { label: 'ให้กำลังใจ',       emoji: '🌈', cls: 'cheer_up' },
  idea:        { label: 'ไอเดีย',           emoji: '💡', cls: 'idea' },
  want_to_say: { label: 'อยากบอก',         emoji: '📢', cls: 'want_to_say' },
  help:        { label: 'ขอความช่วยเหลือ',   emoji: '🙋‍♀️', cls: 'help' },
  others:      { label: 'อื่นๆ',             emoji: '🔮', cls: 'others' }
};

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
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });
}

/* ══════════════════════════════════════════════════════════
   TOAST
   ══════════════════════════════════════════════════════════ */
let _toastTimer = null;

function showToast(text) {
  const el = document.getElementById('toast');
  if (!el) return;
  clearTimeout(_toastTimer);
  el.textContent = text;
  el.classList.remove('a-hidden', 'toast-exit');
  _toastTimer = setTimeout(() => {
    el.classList.add('toast-exit');
    setTimeout(() => el.classList.add('a-hidden'), 300);
  }, 2000);
}

/* ══════════════════════════════════════════════════════════
   AUTH
   ══════════════════════════════════════════════════════════ */
async function checkSession() {
  const { data: { session } } = await sb.auth.getSession();
  if (session) {
    showDashboard();
  } else {
    showLogin();
  }
}

function showLogin() {
  document.getElementById('login-view').classList.remove('a-hidden');
  document.getElementById('dashboard-view').classList.add('a-hidden');
}

function showDashboard() {
  document.getElementById('login-view').classList.add('a-hidden');
  document.getElementById('dashboard-view').classList.remove('a-hidden');
  loadMessages();
  loadBoardSettings();
  loadForceWelcomeSetting();
  loadAdminAnnouncement();
  subscribeRealtime();
}

/* ── Login form ─────────────────────────────────────────── */
document.getElementById('login-form')?.addEventListener('submit', async e => {
  e.preventDefault();

  const email   = document.getElementById('l-email')?.value.trim() ?? '';
  const pass    = document.getElementById('l-pass')?.value ?? '';
  const errEl   = document.getElementById('login-error');
  const btn     = document.getElementById('login-btn');
  const label   = document.getElementById('login-label');
  const spinner = document.getElementById('login-spinner');

  errEl?.classList.add('a-hidden');
  btn.disabled = true;
  if (label)   label.textContent = 'กำลังเข้าสู่ระบบ...';
  spinner?.classList.remove('a-hidden');

  const { error } = await sb.auth.signInWithPassword({ email, password: pass });

  btn.disabled = false;
  if (label)   label.textContent = 'เข้าสู่ระบบ';
  spinner?.classList.add('a-hidden');

  if (error) {
    if (errEl) {
      errEl.textContent = 'อีเมลหรือรหัสผ่านไม่ถูกต้อง กรุณาลองใหม่';
      errEl.classList.remove('a-hidden');
    }
    return;
  }

  showDashboard();
});

/* ── Sign out ───────────────────────────────────────────── */
document.getElementById('signout-btn')?.addEventListener('click', async () => {
  await sb.auth.signOut();
  showLogin();
});

/* ══════════════════════════════════════════════════════════
   BOARD STATE
   ══════════════════════════════════════════════════════════ */
let allAdminMessages = [];
let adminFilter      = 'all';

/* ── Stats ── */
function renderStats() {
  const total   = allAdminMessages.length;
  const visible = allAdminMessages.filter(m =>  m.is_visible).length;
  const hidden  = allAdminMessages.filter(m => !m.is_visible).length;
  const pinned  = allAdminMessages.filter(m =>  m.is_pinned).length;

  document.getElementById('stat-total').textContent   = total;
  document.getElementById('stat-visible').textContent = visible;
  document.getElementById('stat-hidden').textContent  = hidden;
  document.getElementById('stat-pinned').textContent  = pinned ? '📌 1' : '—';

  // Engagement Score: thumbs_up×1, heart×2, clap×2
  let engagement = 0;
  const dayCounts = [0, 0, 0, 0, 0, 0, 0];
  allAdminMessages.forEach(m => {
    const rxn = m.reactions ?? {};
    engagement += (rxn.thumbs_up ?? 0) + (rxn.heart ?? 0) * 2 + (rxn.clap ?? 0) * 2;
    dayCounts[new Date(m.created_at).getDay()]++;
  });
  document.getElementById('stat-engagement')?.textContent = engagement;

  const DAY_NAMES = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const maxCount  = Math.max(...dayCounts);
  const activeDay = total === 0 ? '—' : `${DAY_NAMES[dayCounts.indexOf(maxCount)]} (${maxCount})`;
  document.getElementById('stat-active-day')?.textContent = activeDay;
}

/* ── Render a single row ── */
function renderRow(msg) {
  const cat     = CAT[msg.category] ?? CAT.cheer_up;
  const sender  = msg.is_anonymous ? 'ไม่ระบุชื่อ' : (msg.sender_name ?? 'ไม่ระบุชื่อ');
  const avatar  = msg.avatar_emoji ?? '🌟';
  const snippet = msg.content.length > 100 ? msg.content.slice(0, 100) + '…' : msg.content;
  const rxn     = msg.reactions ?? {};

  return `
    <div class="admin-row${msg.is_visible ? '' : ' is-hidden'}${msg.is_pinned ? ' is-pinned' : ''}"
         data-id="${msg.id}" role="listitem">
      <div class="row-top">
        <div class="row-meta">
          <span class="row-avatar" aria-hidden="true">${esc(avatar)}</span>
          <span class="row-sender">${esc(sender)}</span>
          <span class="card-badge badge-${cat.cls}">${cat.emoji} ${cat.label}</span>
          ${msg.is_pinned   ? '<span class="pinned-badge">📌 MOTW</span>' : ''}
          ${!msg.is_visible ? '<span class="hidden-badge">🙈 ซ่อน</span>' : ''}
        </div>
        <div class="row-actions">
          <button class="action-btn btn-pin" data-id="${msg.id}" data-pinned="${msg.is_pinned}"
                  aria-label="${msg.is_pinned ? 'เลิกปักหมุด' : 'ปักหมุดเป็น MOTW'}">
            ${msg.is_pinned ? '📌 เลิกปักหมุด' : '📌 ปักหมุด'}
          </button>
          <button class="action-btn btn-vis" data-id="${msg.id}" data-visible="${msg.is_visible}"
                  aria-label="${msg.is_visible ? 'ซ่อนข้อความ' : 'แสดงข้อความ'}">
            ${msg.is_visible ? '🙈 ซ่อน' : '👁 แสดง'}
          </button>
          <button class="action-btn btn-del" data-id="${msg.id}" aria-label="ลบข้อความ">
            🗑 ลบ
          </button>
          <button class="action-btn btn-cmt" data-id="${msg.id}" aria-label="ดูคอมเมนต์">
            💬 คอมเมนต์
          </button>
        </div>
      </div>
      <p class="row-content">${esc(snippet)}</p>
      <div class="row-foot">
        <span class="rxn-summary">👍 ${rxn.thumbs_up ?? 0}  ❤️ ${rxn.heart ?? 0}  👏 ${rxn.clap ?? 0}</span>
        <span class="row-time">${thaiTime(msg.created_at)}</span>
      </div>
      <div class="admin-comments-wrap a-hidden" id="admin-comments-${msg.id}"></div>
    </div>`;
}

/* ── Render full list ── */
function renderList() {
  const listEl = document.getElementById('admin-list');
  let filtered = allAdminMessages;
  if (adminFilter === 'visible') filtered = allAdminMessages.filter(m =>  m.is_visible);
  if (adminFilter === 'hidden')  filtered = allAdminMessages.filter(m => !m.is_visible);

  if (filtered.length === 0) {
    listEl.innerHTML = `
      <div class="admin-empty">
        <div style="font-size:2.5rem">📭</div>
        <p>ไม่มีข้อความ${adminFilter !== 'all' ? 'ในหมวดนี้' : ''}</p>
      </div>`;
    return;
  }

  listEl.innerHTML = filtered.map(renderRow).join('');
  wireActions();
}

/* ── Load all messages (no visibility filter) ── */
async function loadMessages() {
  const listEl = document.getElementById('admin-list');
  listEl.innerHTML = `<div class="admin-loading">⏳ กำลังโหลด...</div>`;

  const { data, error } = await sb
    .from('cheer_up_messages')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[Admin]', error);
    listEl.innerHTML = `
      <div class="admin-empty">
        <div style="font-size:2.5rem">😕</div>
        <p>โหลดข้อมูลไม่สำเร็จ กรุณารีเฟรชหน้า</p>
      </div>`;
    return;
  }

  allAdminMessages = data ?? [];
  renderStats();
  renderList();
  renderAnalytics();
}

/* ══════════════════════════════════════════════════════════
   ACTIONS
   ══════════════════════════════════════════════════════════ */
function setRowBusy(id, busy) {
  document.querySelectorAll(`.admin-row[data-id="${id}"] .action-btn`).forEach(btn => {
    btn.disabled = busy;
  });
}

async function doPin(id, currentlyPinned) {
  setRowBusy(id, true);

  if (currentlyPinned) {
    const { error } = await sb.from('cheer_up_messages')
      .update({ is_pinned: false }).eq('id', id);
    if (error) { showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

    const idx = allAdminMessages.findIndex(m => m.id === id);
    if (idx !== -1) allAdminMessages[idx].is_pinned = false;
    showToast('📌 เลิกปักหมุดแล้ว');

  } else {
    // Step 1: Global DB reset — authoritative clear regardless of local state.
    // .eq('is_pinned', true) catches every pinned row even if allAdminMessages is stale.
    const { error: unpinError } = await sb.from('cheer_up_messages')
      .update({ is_pinned: false })
      .eq('is_pinned', true);
    if (unpinError) { showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

    // Mirror the DB reset in local state so the UI is consistent before renderList()
    allAdminMessages.forEach(m => { m.is_pinned = false; });

    // Step 2: Pin the target message
    const { error: pinError } = await sb.from('cheer_up_messages')
      .update({ is_pinned: true }).eq('id', id);
    if (pinError) { showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

    const idx = allAdminMessages.findIndex(m => m.id === id);
    if (idx !== -1) allAdminMessages[idx].is_pinned = true;
    showToast('📌 ปักหมุดเป็น Message of the Week แล้ว');
  }

  renderStats();
  renderList();
}

async function doToggleVisible(id, currentlyVisible) {
  setRowBusy(id, true);

  const update = { is_visible: !currentlyVisible };
  if (currentlyVisible) update.is_pinned = false; // hiding a pinned message also unpins it

  const { error } = await sb.from('cheer_up_messages').update(update).eq('id', id);
  if (error) { showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

  const idx = allAdminMessages.findIndex(m => m.id === id);
  if (idx !== -1) {
    allAdminMessages[idx].is_visible = !currentlyVisible;
    if (currentlyVisible) allAdminMessages[idx].is_pinned = false;
  }

  showToast(currentlyVisible ? '🙈 ซ่อนข้อความแล้ว' : '👁 แสดงข้อความแล้ว');
  renderStats();
  renderList();
}

async function fetchAdminComments(messageId) {
  const wrap = document.getElementById(`admin-comments-${messageId}`);
  if (!wrap) return;

  wrap.innerHTML = `<p class="admin-comments-loading">⏳ กำลังโหลดคอมเมนต์...</p>`;

  const { data, error } = await sb
    .from('comments')
    .select('*')
    .eq('message_id', messageId)
    .order('created_at', { ascending: true });

  if (error) {
    wrap.innerHTML = `<p class="admin-comments-loading">❌ โหลดไม่สำเร็จ</p>`;
    return;
  }

  const comments = data ?? [];
  if (comments.length === 0) {
    wrap.innerHTML = `<p class="admin-comments-empty">ยังไม่มีคอมเมนต์</p>`;
    return;
  }

  wrap.innerHTML = comments.map(c => `
    <div class="admin-comment-item" data-comment-id="${c.id}">
      <div class="admin-comment-meta">
        <span class="admin-comment-sender">${esc(c.sender_name ?? 'ไม่ระบุชื่อ')}</span>
        <span class="admin-comment-time">${thaiTime(c.created_at)}</span>
      </div>
      <div class="admin-comment-body">
        <p class="admin-comment-text">${esc(c.comment_text)}</p>
        <button class="btn-del-comment" data-comment-id="${c.id}" data-message-id="${messageId}"
                aria-label="ลบคอมเมนต์">🗑 ลบ</button>
      </div>
    </div>`).join('');

  wrap.querySelectorAll('.btn-del-comment').forEach(btn => {
    btn.addEventListener('click', () => doDeleteComment(btn.dataset.commentId, btn.dataset.messageId));
  });
}

function toggleAdminComments(messageId) {
  const wrap = document.getElementById(`admin-comments-${messageId}`);
  if (!wrap) return;

  if (!wrap.classList.contains('a-hidden')) {
    wrap.classList.add('a-hidden');
    return;
  }

  wrap.classList.remove('a-hidden');
  fetchAdminComments(messageId);
}

async function doDeleteComment(commentId, messageId) {
  if (!window.confirm('ต้องการลบคอมเมนต์นี้ถาวรหรือไม่?')) return;

  const { error } = await sb.from('comments').delete().eq('id', commentId);
  if (error) { showToast('❌ ลบคอมเมนต์ไม่สำเร็จ'); return; }

  showToast('🗑 ลบคอมเมนต์แล้ว');
  fetchAdminComments(messageId);
}

async function doDelete(id) {
  const confirmed = window.confirm('ต้องการลบข้อความนี้ถาวรหรือไม่?');
  if (!confirmed) return;

  setRowBusy(id, true);

  const { error } = await sb.from('cheer_up_messages').delete().eq('id', id);
  if (error) { showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

  allAdminMessages = allAdminMessages.filter(m => m.id !== id);
  showToast('🗑 ลบข้อความแล้ว');
  renderStats();
  renderList();
}

/* ── Wire all action buttons in the rendered list ── */
function wireActions() {
  document.querySelectorAll('.btn-pin').forEach(btn => {
    btn.addEventListener('click', () => doPin(btn.dataset.id, btn.dataset.pinned === 'true'));
  });
  document.querySelectorAll('.btn-vis').forEach(btn => {
    btn.addEventListener('click', () => doToggleVisible(btn.dataset.id, btn.dataset.visible === 'true'));
  });
  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', () => doDelete(btn.dataset.id));
  });
  document.querySelectorAll('.btn-cmt').forEach(btn => {
    btn.addEventListener('click', () => toggleAdminComments(btn.dataset.id));
  });
}

/* ── Filter tabs ── */
document.querySelectorAll('[data-admin-filter]').forEach(pill => {
  pill.addEventListener('click', () => {
    document.querySelectorAll('[data-admin-filter]').forEach(p => p.classList.remove('active'));
    pill.classList.add('active');
    adminFilter = pill.dataset.adminFilter;
    renderList();
  });
});

/* ══════════════════════════════════════════════════════════
   REALTIME
   ══════════════════════════════════════════════════════════ */
let _rtSubscribed = false;

function subscribeRealtime() {
  if (_rtSubscribed) return;
  _rtSubscribed = true;

  sb.channel('admin-board')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'cheer_up_messages' },
      ({ new: msg }) => {
        if (allAdminMessages.find(m => m.id === msg.id)) return;
        allAdminMessages.unshift(msg);
        renderStats();
        renderList();
        renderAnalytics();
      }
    )
    .on('postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'cheer_up_messages' },
      ({ new: msg }) => {
        // Keeps admin list badges (📌 MOTW, 🙈 ซ่อน) accurate from any pin source.
        // Merges only DB-provided fields; preserves client-only fields like comments count.
        const idx = allAdminMessages.findIndex(m => m.id === msg.id);
        if (idx === -1) return;
        allAdminMessages[idx] = { ...allAdminMessages[idx], ...msg };
        renderStats();
        renderList();
      }
    )
    .subscribe();
}

/* ══════════════════════════════════════════════════════════
   BOARD SETTINGS — FEATURE 1 & 2
   ══════════════════════════════════════════════════════════ */

/* ── Load & sync lock toggle state ── */
async function loadBoardSettings() {
  const { data, error } = await sb
    .from('board_settings')
    .select('is_locked')
    .eq('id', 1)
    .single();
  if (error) { console.warn('[Admin] board_settings', error); return; }
  applyAdminLockUI(data?.is_locked ?? false);
}

function applyAdminLockUI(locked) {
  const toggle = document.getElementById('board-lock-toggle');
  const label  = document.getElementById('lock-label');
  if (toggle) toggle.checked = locked;
  if (label) {
    label.textContent = locked ? '🔴 ปิดรับข้อความอยู่' : '🟢 รับข้อความอยู่';
    label.classList.toggle('is-locked', locked);
  }
  const sw = document.getElementById('board-lock-toggle');
  if (sw) sw.setAttribute('aria-checked', String(locked));
}

/* ══════════════════════════════════════════════════════════
   SITE SETTINGS — FORCE WELCOME MODAL
   ══════════════════════════════════════════════════════════ */

async function loadForceWelcomeSetting() {
  const { data, error } = await sb
    .from('site_settings')
    .select('value_bool')
    .eq('key', 'force_welcome')
    .single();
  if (error) { console.warn('[Admin] site_settings load', error); return; }
  applyForceWelcomeUI(data?.value_bool ?? false);
}

function applyForceWelcomeUI(active) {
  const toggle = document.getElementById('toggle-force-welcome');
  const label  = document.getElementById('force-welcome-label');
  if (toggle) toggle.checked = active;
  if (toggle) toggle.setAttribute('aria-checked', String(active));
  if (label)  label.classList.toggle('is-launch-active', active);
}

document.getElementById('toggle-force-welcome')?.addEventListener('change', async e => {
  const newState = e.target.checked;
  applyForceWelcomeUI(newState); // optimistic

  const { error } = await sb
    .from('site_settings')
    .upsert({ key: 'force_welcome', value_bool: newState }, { onConflict: 'key' });

  if (error) {
    console.error('[Admin] force_welcome toggle', error);
    applyForceWelcomeUI(!newState); // revert on failure
    showToast('❌ อัปเดตสถานะไม่สำเร็จ');
    return;
  }
  showToast(newState
    ? '🚀 เปิดโหมด Launch — Welcome แสดงทุกครั้ง'
    : '✅ อัปเดตสถานะโหมด Launch เรียบร้อย!');
});

/* ── Lock toggle handler ── */
document.getElementById('board-lock-toggle')?.addEventListener('change', async e => {
  const newState = e.target.checked;
  applyAdminLockUI(newState); // optimistic
  const { error } = await sb
    .from('board_settings')
    .update({ is_locked: newState })
    .eq('id', 1);
  if (error) {
    console.error('[Admin] lock toggle', error);
    applyAdminLockUI(!newState); // revert
    showToast('❌ อัปเดตสถานะไม่สำเร็จ');
    return;
  }
  showToast(newState ? '🔴 ปิดรับข้อความแล้ว' : '🟢 เปิดรับข้อความแล้ว');
});

/* ── Broadcast Modal ── */
function openBroadcastModal() {
  const modal = document.getElementById('broadcast-modal');
  if (!modal) return;
  modal.classList.remove('a-hidden');
  document.getElementById('broadcast-text')?.focus();
  document.getElementById('broadcast-error')?.classList.add('a-hidden');
}

function closeBroadcastModal() {
  document.getElementById('broadcast-modal')?.classList.add('a-hidden');
}

document.getElementById('btn-broadcast')?.addEventListener('click', openBroadcastModal);
document.getElementById('broadcast-close')?.addEventListener('click', closeBroadcastModal);

document.getElementById('broadcast-modal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeBroadcastModal();
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeBroadcastModal();
});

document.getElementById('broadcast-submit')?.addEventListener('click', async () => {
  const textarea = document.getElementById('broadcast-text');
  const errEl    = document.getElementById('broadcast-error');
  const label    = document.getElementById('broadcast-submit-label');
  const spinner  = document.getElementById('broadcast-spinner');
  const btn      = document.getElementById('broadcast-submit');

  const text = textarea?.value.trim() ?? '';
  errEl?.classList.add('a-hidden');

  if (!text) {
    if (errEl) { errEl.textContent = '✍️ กรุณาเขียนข้อความก่อนนะ'; errEl.classList.remove('a-hidden'); }
    textarea?.focus();
    return;
  }

  btn.disabled = true;
  if (label)   label.textContent = 'กำลังส่ง...';
  spinner?.classList.remove('a-hidden');

  // DB-authoritative reset — clears all pinned rows regardless of local state
  await sb.from('cheer_up_messages')
    .update({ is_pinned: false })
    .eq('is_pinned', true);

  const { error } = await sb
    .from('cheer_up_messages')
    .insert({
      category:     'announcement',
      content:      text,
      sender_name:  'ทีม GA',
      is_anonymous: false,
      avatar_emoji: '📢',
      reactions:    { thumbs_up: 0, heart: 0, clap: 0 },
      is_visible:   true,
      is_pinned:    true,
    });

  btn.disabled = false;
  if (label)   label.textContent = '📢 ประกาศเลย';
  spinner?.classList.add('a-hidden');

  if (error) {
    console.error('[Admin] broadcast', error);
    if (errEl) { errEl.textContent = '❌ ส่งไม่สำเร็จ กรุณาลองอีกครั้ง'; errEl.classList.remove('a-hidden'); }
    return;
  }

  if (textarea) textarea.value = '';
  closeBroadcastModal();
  showToast('📢 ส่งประกาศแล้ว!');
  await loadMessages();
});

/* ══════════════════════════════════════════════════════════
   ADMIN ANNOUNCEMENT BANNER
   Separate from MOTW — stored in site_settings.admin_announcement
   (value_text). Empty string = banner hidden on the board.
   ══════════════════════════════════════════════════════════ */

async function loadAdminAnnouncement() {
  try {
    const { data, error } = await sb
      .from('site_settings')
      .select('value_text')
      .eq('key', 'admin_announcement')
      .single();
    if (error) return;
    const textarea = document.getElementById('announcement-text');
    if (textarea) {
      textarea.value = data?.value_text ?? '';
      updateAapCharCount();
    }
  } catch (_) {}
}

async function saveAdminAnnouncement(text) {
  const btn     = document.getElementById('announcement-save-btn');
  const label   = document.getElementById('announcement-save-label');
  const spinner = document.getElementById('announcement-spinner');
  const errEl   = document.getElementById('announcement-error');

  errEl?.classList.add('a-hidden');
  if (btn)    btn.disabled    = true;
  if (label)  label.textContent = 'กำลังบันทึก...';
  spinner?.classList.remove('a-hidden');

  const { error } = await sb
    .from('site_settings')
    .upsert({ key: 'admin_announcement', value_text: text }, { onConflict: 'key' });

  if (btn)    btn.disabled    = false;
  if (label)  label.textContent = '💾 บันทึกประกาศ';
  spinner?.classList.add('a-hidden');

  if (error) {
    console.error('[Admin] announcement upsert', error);
    if (errEl) {
      errEl.textContent = '❌ บันทึกไม่สำเร็จ กรุณาลองอีกครั้ง';
      errEl.classList.remove('a-hidden');
    }
    return;
  }

  showToast(text ? '📢 บันทึกประกาศแล้ว!' : '✅ ล้างประกาศแล้ว — แถบซ่อนอยู่');
}

function updateAapCharCount() {
  const textarea  = document.getElementById('announcement-text');
  const countEl   = document.getElementById('aap-char-count');
  if (!textarea || !countEl) return;
  countEl.textContent = textarea.value.length;
}

document.getElementById('announcement-text')?.addEventListener('input', updateAapCharCount);

document.getElementById('announcement-save-btn')?.addEventListener('click', () => {
  const text = document.getElementById('announcement-text')?.value.trim() ?? '';
  saveAdminAnnouncement(text);
});

document.getElementById('announcement-clear-btn')?.addEventListener('click', async () => {
  const textarea = document.getElementById('announcement-text');
  if (textarea) { textarea.value = ''; updateAapCharCount(); }
  await saveAdminAnnouncement('');
});

/* ══════════════════════════════════════════════════════════
   ANALYTICS & CHARTS  (Chart.js v4)
   ══════════════════════════════════════════════════════════ */

const doughnutCenterText = {
  id: 'doughnutCenterText',
  beforeDatasetsDraw(chart) {
    if (chart.config.type !== 'doughnut') return;
    const total = (chart.data.datasets[0]?.data ?? []).reduce((a, b) => a + b, 0);
    const { width, height, ctx } = chart;
    const sz = Math.min(width, height);
    ctx.save();
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle    = '#111827';
    ctx.font         = `700 ${(sz * 0.14).toFixed(0)}px Kanit, sans-serif`;
    ctx.fillText(total, width / 2, height / 2 - sz * 0.06);
    ctx.fillStyle = '#9ca3af';
    ctx.font      = `400 ${(sz * 0.075).toFixed(0)}px Kanit, sans-serif`;
    ctx.fillText('ทั้งหมด', width / 2, height / 2 + sz * 0.1);
    ctx.restore();
  }
};

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'Kanit, sans-serif';
}

let _categoryChart = null;
let _timelineChart = null;

function buildTimelineData() {
  const DAYS   = 14;
  const now    = new Date();
  const counts = new Array(DAYS).fill(0);
  const labels = [];

  for (let i = DAYS - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    labels.push(`${d.getDate()}/${d.getMonth() + 1}`);
  }
  allAdminMessages.forEach(m => {
    const diff = Math.floor((now - new Date(m.created_at)) / 86_400_000);
    if (diff >= 0 && diff < DAYS) counts[DAYS - 1 - diff]++;
  });
  return { labels, counts };
}

function renderCategoryChart(catCounts) {
  const canvas = document.getElementById('categoryChart');
  if (!canvas || typeof Chart === 'undefined') return;

  const keys   = Object.keys(CAT);
  const labels = keys.map(k => `${CAT[k].emoji} ${CAT[k].label}`);
  const data   = keys.map(k => catCounts[k] ?? 0);
  const colors = ['#f97316', '#22c55e', '#eab308', '#3b82f6', '#ec4899', '#8b5cf6'];

  if (_categoryChart) {
    _categoryChart.data.datasets[0].data = data;
    _categoryChart.update('none');
    return;
  }

  _categoryChart = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: colors,
        borderWidth: 2,
        borderColor: 'rgba(255,255,255,0.85)',
        hoverOffset: 6,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'bottom', labels: { boxWidth: 10, padding: 10, font: { size: 10 } } },
        tooltip: { callbacks: { label: ctx => ` ${ctx.label}: ${ctx.parsed}` } },
      },
    },
    plugins: [doughnutCenterText],
  });
}

function renderTimelineChart({ labels, counts }) {
  const canvas = document.getElementById('timelineChart');
  if (!canvas || typeof Chart === 'undefined') return;

  if (_timelineChart) {
    _timelineChart.data.labels           = labels;
    _timelineChart.data.datasets[0].data = counts;
    _timelineChart.update('none');
    return;
  }

  _timelineChart = new Chart(canvas, {
    type: 'line',
    data: {
      labels,
      datasets: [{
        label: 'ข้อความ',
        data: counts,
        borderColor: '#8b5cf6',
        backgroundColor: 'rgba(139,92,246,0.10)',
        borderWidth: 2,
        pointBackgroundColor: '#8b5cf6',
        pointRadius: 3,
        pointHoverRadius: 5,
        fill: true,
        tension: 0.4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        x: {
          grid: { display: false },
          ticks: { font: { size: 10 }, maxRotation: 0, maxTicksLimit: 7 },
        },
        y: {
          beginAtZero: true,
          ticks: { stepSize: 1, font: { size: 10 } },
          grid: { color: 'rgba(0,0,0,0.06)' },
        },
      },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: ctx => ` ${ctx.parsed.y} ข้อความ` } },
      },
    },
  });
}

function renderAnalytics() {
  const catCounts = {};
  Object.keys(CAT).forEach(k => { catCounts[k] = 0; });
  allAdminMessages.forEach(m => {
    if (m.category in catCounts) catCounts[m.category]++;
  });
  renderCategoryChart(catCounts);
  renderTimelineChart(buildTimelineData());
}

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
checkSession();
