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
  thank_you: { label: 'ขอบคุณ',     emoji: '💝', cls: 'thank_you' },
  idea:      { label: 'ไอเดีย',      emoji: '💡', cls: 'idea'      },
  cheer_up:  { label: 'ให้กำลังใจ', emoji: '🌈', cls: 'cheer_up'  },
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
        </div>
      </div>
      <p class="row-content">${esc(snippet)}</p>
      <div class="row-foot">
        <span class="rxn-summary">👍 ${rxn.thumbs_up ?? 0}  ❤️ ${rxn.heart ?? 0}  👏 ${rxn.clap ?? 0}</span>
        <span class="row-time">${thaiTime(msg.created_at)}</span>
      </div>
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
    // Remove existing pin before setting the new one
    const othersPinned = allAdminMessages.filter(m => m.is_pinned && m.id !== id);
    if (othersPinned.length) {
      await sb.from('cheer_up_messages')
        .update({ is_pinned: false })
        .in('id', othersPinned.map(m => m.id));
      othersPinned.forEach(m => {
        const i = allAdminMessages.findIndex(x => x.id === m.id);
        if (i !== -1) allAdminMessages[i].is_pinned = false;
      });
    }

    const { error } = await sb.from('cheer_up_messages')
      .update({ is_pinned: true }).eq('id', id);
    if (error) { showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

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
  const sw = document.querySelector('.toggle-switch');
  if (sw) sw.setAttribute('aria-checked', String(locked));
}

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

  // Unpin any current pinned messages
  const currentlyPinned = allAdminMessages.filter(m => m.is_pinned);
  if (currentlyPinned.length) {
    await sb.from('cheer_up_messages')
      .update({ is_pinned: false })
      .in('id', currentlyPinned.map(m => m.id));
  }

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
   BOOT
   ══════════════════════════════════════════════════════════ */
checkSession();
