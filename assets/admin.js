// GA Cheer Up Board — admin.js  (Phase 5)

/* ══════════════════════════════════════════════════════════
   SUPABASE CLIENT
   ══════════════════════════════════════════════════════════ */
// supabase.js is now served first-party from assets/, so browser Tracking
// Prevention no longer blocks localStorage — the default persistent session
// (survives page reloads) works fine.
const sb = supabase.createClient(
  'https://adbdcfofguflyyrvczvq.supabase.co',
  'sb_publishable_ERx_Z8GsAZCBRRL18HbwDw_4PWk2ahz'
);

// Redirect to login whenever the session expires or the user signs out from
// another tab — prevents subsequent writes from failing with 403.
sb.auth.onAuthStateChange((event, _session) => {
  if (event === 'SIGNED_OUT') showLogin();
});

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

const AUDIT_STYLES = {
  PINNED:               { label: '📌 ปักหมุด',           cls: 'green'  },
  UNPINNED:             { label: '📌 เลิกปักหมุด',       cls: 'amber'  },
  HIDDEN:               { label: '🙈 ซ่อน',              cls: 'red'    },
  SHOWN:                { label: '👁 แสดง',               cls: 'green'  },
  DELETED:              { label: '🗑 ลบข้อความ',          cls: 'red'    },
  COMMENT_DELETED:      { label: '🗑 ลบคอมเมนต์',         cls: 'red'    },
  BOARD_LOCKED:         { label: '🔴 ปิดรับข้อความ',      cls: 'red'    },
  BOARD_UNLOCKED:       { label: '🟢 เปิดรับข้อความ',     cls: 'green'  },
  FORCE_WELCOME_ON:     { label: '🚀 เปิด Launch Mode',   cls: 'amber'  },
  FORCE_WELCOME_OFF:    { label: '✅ ปิด Launch Mode',    cls: 'amber'  },
  ANNOUNCEMENT_SAVED:   { label: '📢 บันทึกประกาศ',       cls: 'amber'  },
  ANNOUNCEMENT_CLEARED: { label: '✕ ล้างประกาศ',          cls: 'amber'  },
  ALBUM_CREATED:        { label: '🆕 สร้างอัลบั้ม',        cls: 'green'  },
  ALBUM_UPDATED:        { label: '✏️ แก้อัลบั้ม',          cls: 'amber'  },
  ALBUM_DELETED:        { label: '🗑 ลบอัลบั้ม',           cls: 'red'    },
  PHOTO_UPLOADED:       { label: '🖼 อัปโหลดรูป',          cls: 'green'  },
  PHOTO_DELETED:        { label: '🗑 ลบรูป',               cls: 'red'    },
  COVER_SET:            { label: '⭐ ตั้งรูปหน้าปก',        cls: 'amber'  },
  GALLERY_PIN_ON:       { label: '🔒 เปิด PIN แกลเลอรี',   cls: 'amber'  },
  GALLERY_PIN_OFF:      { label: '🔓 ปิด PIN แกลเลอรี',    cls: 'amber'  },
  GALLERY_PIN_SET:      { label: '🔑 ตั้ง PIN แกลเลอรี',   cls: 'amber'  },
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
   AUTO-CENSOR ENGINE
   ══════════════════════════════════════════════════════════ */
const defaultThaiProfanityList = [
  'เหี้ย', 'สัส', 'ควย', 'เย็ด', 'แม่ง', 'กู', 'มึง', 'ไอ้', 'อีดอก', 'ระยำ',
  'หี', 'แตด', 'ห่า', 'ชิบหาย', 'แม่เย็ด', 'พ่อมึงตาย', 'ไอ้สัตว์', 'อีสัตว์',
  'เชี่ย', 'เชี้ย', 'แม่มึง', 'พ่อมึง', 'ตอแหล', 'ส้นตีน', 'อีห่า', 'อีเหี้ย', 'ไอ้เหี้ย',
  'อีควาย', 'ไอ้ควาย', 'อีชั่ว', 'อีบ้า', 'ไอ้บ้า', 'อีโง่', 'ไอ้โง่', 'อีหน้าด้าน',
  'อีหน้าหี', 'ไอ้หน้าหี', 'อีตัว', 'กระหรี่', 'แรด', 'อีแรด', 'ดอกทอง', 'อีดอกทอง',
  'จัญไร', 'อีจัญไร', 'ขี้', 'เลว', 'อีเลว', 'สารเลว', 'หน้าตัวเมีย', 'ตัวเมีย',
  'หน้าผี', 'ผีน้อย', 'ไอ้ผี', 'อีผี', 'ทุเรศ', 'อีทุเรศ', 'เปรต', 'อีเปรต', 'ไอ้เปรต',
  'นรก', 'ตกนรก', 'หน้าโง่', 'โง่เง่า', 'งั่ง', 'ปัญญาอ่อน', 'สมองน้อย', 'ไร้สมอง',
  'ควายถึก', 'ควายเถิก', 'กาก', 'ขยะ', 'ขยะสังคม', 'ลูกหี', 'ลูกหำ', 'ไอ้หำ', 'อีหำ',
  'พ่อง', 'แม่ง', 'น่าเกลียด',
];

const defaultEnglishProfanityList = [
  'fuck', 'shit', 'ass', 'bitch', 'damn', 'hell', 'dick', 'cock', 'pussy',
  'bastard', 'asshole', 'cunt', 'piss', 'whore', 'slut', 'fag', 'faggot',
  'nigger', 'nigga', 'crap', 'bullshit', 'motherfucker', 'fucker', 'fucking',
  'shitty', 'bitchy', 'dickhead', 'jackass', 'dumbass', 'retard', 'retarded',
  'hoe', 'thot', 'simp', 'incel', 'loser', 'noob', 'trash', 'garbage', 'toxic',
  'cancer', 'wtf', 'omfg', 'stfu', 'gtfo', 'kys', 'kms',
];

const thaiKaraokeMapping = {
  'เหี้ย': ['hia', 'hea', 'hear', 'heya', 'hiya'],
  'สัส':   ['sus', 'sas', 'sat', 'sud', 'sut'],
  'ควย':   ['kuay', 'kuai', 'kwai', 'kway', 'quay', 'quai'],
  'เย็ด':  ['yed', 'yet', 'yedd', 'yaed', 'yad'],
  'แม่ง':  ['maeng', 'mang', 'meang', 'meng'],
  'กู':    ['goo', 'koo', 'guu', 'kuu'],
  'มึง':   ['mueng', 'mung', 'meung', 'muang'],
  'หี':    ['hee', 'hii', 'heee'],
  'แตด':   ['taed', 'taet'],
  'ชิบหาย': ['chibhai', 'shibhai', 'chiphai', 'shiphay'],
  'ตอแหล': ['torler', 'torlae', 'tohlae', 'tawlae'],
  'ส้นตีน': ['sontien', 'sontean', 'santien', 'santean'],
  'ควาย':  ['kwai', 'kway', 'kuai', 'kuay', 'quai', 'quay'],
  'สัตว์': ['satw', 'sutw'],
  'โง่':   ['ngo', 'ngoh', 'ngor', 'ngaw'],
  'เลว':   ['leo', 'lew', 'laew', 'laeo'],
  'ขี้':   ['kee', 'khee', 'khii'],
  'ผี':    ['pee', 'phee', 'phii'],
  'นรก':   ['narok', 'nalok'],
  'หำ':    ['hum', 'ham', 'haam', 'hahm'],
};

const englishVariations = {
  'fuck':  ['fck', 'fuk', 'fuq', 'fvck', 'f*ck', 'f**k', 'f***'],
  'shit':  ['sh1t', 'sh!t', '$hit', 'sh*t', 'sh**', 's**t'],
  'ass':   ['@ss', 'a$$', 'a**', '@$$'],
  'bitch': ['b1tch', 'b!tch', 'b*tch', 'bi+ch'],
  'damn':  ['d@mn', 'darn', 'd*mn'],
  'dick':  ['d1ck', 'd!ck', 'd*ck'],
  'pussy': ['pu$$y', 'p*ssy', 'pu**y'],
  'hell':  ['h3ll', 'he!!', 'h*ll'],
};

const thaiVariations = {
  'เหี้ย': ['เหี้ยย', 'เหี่ย', 'เฮีย', 'เฮี้ย', 'เหิ่ย', 'เฮิ่ย', 'เหี๋ย', 'เหี๊ย', 'เหia', 'เหื่ย', 'เหือ่ย', 'เฮี่ย', 'เฮีย์', 'เฮี๊ย'],
  'สัส':   ['สาส', 'สาด', 'สัด', 'สัสส์', 'ซัส', 'ซาส', 'ส๊าส', 'ส๋าส', 'สสส', 'สะส', 'สุส', 'สึส', 'สฺส', 'ส@ส', 'ส*ส', 'ส.ั.ส'],
  'ควย':   ['คอย', 'ค.ว.ย', 'ค_ว_ย', 'กวย', 'กอย', 'ควาย', 'คุย', 'ค9ย', 'ค๙ย', 'ควยยยยยย', 'ควยๆลๆ'],
  'แม่ง':  ['แม้ง', 'แม่งง', 'ม่ง', 'มง'],
  'กู':    ['กุ', 'กรู', 'กูู', 'ก.ู', 'กู๋', 'กู๊', 'กูกู'],
  'มึง':   ['มุง', 'มึ้ง', 'ม.ึ.ง', 'มรึง', 'มืง', 'มึ่ง'],
  'ไอ้':   ['อิ้', 'ไอ่', 'ไอ๊'],
  'อี':    ['อิ', 'อี่', 'อี้', 'อื'],
  'หี':    ['ฮี', 'ฮี่', 'ห.ี', 'หิ'],
  'บ้า':   ['บ่า', 'บ๊า', 'บ้าา', 'บร้า'],
};

// Thai profanity set for Segmenter exact-matching.
// Includes defaultThaiProfanityList plus pure-Thai entries from thaiVariations.
// Mixed Thai+ASCII obfuscations (e.g. 'ส@ส', 'ค.ว.ย') are intentionally excluded
// because Intl.Segmenter won't produce them as tokens — they'd never match anyway.
const _thaiProfanitySet = (() => {
  const isAscii = s => /^[\x00-\x7F]+$/.test(s);
  const set = new Set(defaultThaiProfanityList);
  Object.entries(thaiVariations).forEach(([key, variants]) => {
    set.add(key);
    variants.forEach(v => { if (!isAscii(v)) set.add(v); });
  });
  return set;
})();

// Segmenter instance — reused across calls (construction is expensive).
const _thaiSegmenter = new Intl.Segmenter('th', { granularity: 'word' });

// ASCII-only regex: English profanity + Karaoke romanized Thai.
// \b boundaries are safe for ASCII because spaces/punctuation delimit words.
// Thai text never enters this pass (it was already handled by the Segmenter).
const _asciiCensorRegex = (() => {
  const escRe      = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const isAlphaNum = s => /^[A-Za-z0-9]+$/.test(s);
  const isAscii    = s => /^[\x20-\x7E]+$/.test(s);
  const asciiWord  = [], asciiSym = [];

  const add = v => {
    if (!isAscii(v)) return;
    const e = escRe(v);
    if (isAlphaNum(v)) asciiWord.push(e);
    else               asciiSym.push(e);
  };

  Object.values(englishVariations).forEach(vs => vs.forEach(add));
  // Karaoke — minimum 3 chars to prevent single-letter false positives
  Object.values(thaiKaraokeMapping).forEach(vs =>
    vs.filter(v => v.length >= 3).forEach(add)
  );
  defaultEnglishProfanityList.forEach(add);

  const dedup = arr => [...new Set(arr)].sort((a, b) => b.length - a.length);

  return {
    asciiWord: asciiWord.length ? new RegExp(`\\b(?:${dedup(asciiWord).join('|')})\\b`, 'gi') : null,
    asciiSym:  asciiSym.length  ? new RegExp(dedup(asciiSym).join('|'), 'gi') : null,
  };
})();

function censorText(text) {
  if (!text) return text;

  // Pass 1 — Thai: tokenise with Intl.Segmenter, then exact-match each token.
  // Solves the Scunthorpe problem: 'กุ' never matches inside 'กุหลาบ' because
  // the segmenter produces 'กุหลาบ' as one token, not 'กุ' + 'หลาบ'.
  const segments = [..._thaiSegmenter.segment(String(text))];
  let out = segments.map(s => _thaiProfanitySet.has(s.segment) ? '***' : s.segment).join('');

  // Pass 2 — ASCII: \b-bounded regex for English words and Karaoke romanized Thai.
  const { asciiWord, asciiSym } = _asciiCensorRegex;
  if (asciiWord) out = out.replace(asciiWord, m => '*'.repeat(m.length));
  if (asciiSym)  out = out.replace(asciiSym,  m => '*'.repeat(m.length));

  return out;
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
   AUDIT LOG
   ══════════════════════════════════════════════════════════ */

async function logAdminAction(actionType, targetId, details) {
  try {
    const { data: { user } } = await sb.auth.getUser();
    const adminEmail = user?.email ?? 'unknown';
    await sb.from('admin_audit_logs').insert({
      admin_email: adminEmail,
      action_type: actionType,
      target_id:   targetId ?? null,
      details:     details  ?? null,
    });
  } catch (_) { /* audit is intentionally non-blocking */ }
}

function renderAuditItem(log) {
  const style  = AUDIT_STYLES[log.action_type] ?? { label: log.action_type, cls: 'amber' };
  const email  = esc(log.admin_email ?? 'unknown');
  const detail = log.details ? esc(log.details) : '';
  const ts     = thaiTime(log.created_at);
  return `
    <div class="audit-item audit-item--${style.cls}" role="listitem">
      <span class="audit-pill audit-pill--${style.cls}">${style.label}</span>
      <div class="audit-body">
        <span class="audit-actor">${email}</span>
        ${detail ? `<span class="audit-detail">${detail}</span>` : ''}
      </div>
      <span class="audit-ts">${ts}</span>
    </div>`;
}

function renderAuditLogs(logs) {
  const listEl = document.getElementById('audit-log-list');
  if (!listEl) return;
  if (logs.length === 0) {
    listEl.innerHTML = '<div class="audit-empty">ยังไม่มีประวัติการใช้งาน</div>';
    return;
  }
  listEl.innerHTML = logs.map(renderAuditItem).join('');
}

function prependAuditEntry(log) {
  const listEl = document.getElementById('audit-log-list');
  if (!listEl) return;
  const emptyEl = listEl.querySelector('.audit-empty');
  if (emptyEl) emptyEl.remove();
  listEl.insertAdjacentHTML('afterbegin', renderAuditItem(log));
}

async function loadAuditLogs() {
  const listEl = document.getElementById('audit-log-list');
  if (!listEl) return;
  listEl.innerHTML = '<div class="audit-empty">⏳ กำลังโหลด...</div>';
  try {
    const { data, error } = await sb
      .from('admin_audit_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      console.warn('[Admin] audit_logs unavailable:', error.message);
      listEl.innerHTML = '<div class="audit-empty">ยังไม่มีประวัติการใช้งาน</div>';
      return;
    }
    renderAuditLogs(data ?? []);
  } catch (_) {
    listEl.innerHTML = '<div class="audit-empty">ยังไม่มีประวัติการใช้งาน</div>';
  }
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
  loadCursorEffectSetting();
  loadAdminAnnouncement();
  loadAuditLogs();
  loadFeedbacks();
  loadGallery();
  loadGalleryConfig();
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
  const engEl = document.getElementById('stat-engagement');
  if (engEl) engEl.textContent = engagement;

  const DAY_NAMES = ['อา.', 'จ.', 'อ.', 'พ.', 'พฤ.', 'ศ.', 'ส.'];
  const maxCount  = Math.max(...dayCounts);
  const activeDay = total === 0 ? '—' : `${DAY_NAMES[dayCounts.indexOf(maxCount)]} (${maxCount})`;
  const dayEl = document.getElementById('stat-active-day');
  if (dayEl) dayEl.textContent = activeDay;
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

  const { data: { session: _pinSession } } = await sb.auth.getSession();
  if (!_pinSession) {
    showToast('❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    setRowBusy(id, false);
    showLogin();
    return;
  }

  if (currentlyPinned) {
    const { error } = await sb.from('cheer_up_messages')
      .update({ is_pinned: false }).eq('id', id);
    if (error) { console.error('[Admin] doPin (unpin):', error.code, error.message); showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

    const idx = allAdminMessages.findIndex(m => m.id === id);
    if (idx !== -1) allAdminMessages[idx].is_pinned = false;
    showToast('📌 เลิกปักหมุดแล้ว');
    logAdminAction('UNPINNED', id, 'เลิกปักหมุดข้อความออกจาก MOTW');

  } else {
    // Step 1: Global DB reset — authoritative clear regardless of local state.
    const { error: unpinError } = await sb.from('cheer_up_messages')
      .update({ is_pinned: false })
      .eq('is_pinned', true);
    if (unpinError) { console.error('[Admin] doPin (unpin-all):', unpinError.code, unpinError.message); showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

    // Mirror the DB reset in local state so the UI is consistent before renderList()
    allAdminMessages.forEach(m => { m.is_pinned = false; });

    // Step 2: Pin the target message
    const { error: pinError } = await sb.from('cheer_up_messages')
      .update({ is_pinned: true }).eq('id', id);
    if (pinError) { console.error('[Admin] doPin (pin):', pinError.code, pinError.message); showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

    const idx = allAdminMessages.findIndex(m => m.id === id);
    if (idx !== -1) allAdminMessages[idx].is_pinned = true;
    showToast('📌 ปักหมุดเป็น Message of the Week แล้ว');
    logAdminAction('PINNED', id, 'ปักหมุดข้อความเป็น MOTW');
  }

  renderStats();
  renderList();
  renderAnalytics();
}

async function doToggleVisible(id, currentlyVisible) {
  setRowBusy(id, true);

  // Verify the authenticated session is still valid before issuing the write.
  // getSession() also silently refreshes the JWT if it is close to expiry.
  const { data: { session: _visSession } } = await sb.auth.getSession();
  if (!_visSession) {
    showToast('❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    setRowBusy(id, false);
    showLogin();
    return;
  }

  const update = { is_visible: !currentlyVisible };
  if (currentlyVisible) update.is_pinned = false; // hiding a pinned message also unpins it

  const { error } = await sb.from('cheer_up_messages').update(update).eq('id', id);
  if (error) {
    console.error('[Admin] doToggleVisible:', error.code, error.message, error.details);
    showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่');
    setRowBusy(id, false);
    return;
  }

  const idx = allAdminMessages.findIndex(m => m.id === id);
  if (idx !== -1) {
    allAdminMessages[idx].is_visible = !currentlyVisible;
    if (currentlyVisible) allAdminMessages[idx].is_pinned = false;
  }

  showToast(currentlyVisible ? '🙈 ซ่อนข้อความแล้ว' : '👁 แสดงข้อความแล้ว');
  logAdminAction(
    currentlyVisible ? 'HIDDEN' : 'SHOWN',
    id,
    currentlyVisible ? 'ซ่อนข้อความจากบอร์ด' : 'แสดงข้อความบนบอร์ด'
  );
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
  logAdminAction('COMMENT_DELETED', commentId, 'ลบคอมเมนต์จากข้อความ ' + messageId);
  fetchAdminComments(messageId);
}

async function doDelete(id) {
  const confirmed = window.confirm('ต้องการลบข้อความนี้ถาวรหรือไม่?');
  if (!confirmed) return;

  setRowBusy(id, true);

  const { data: { session: _delSession } } = await sb.auth.getSession();
  if (!_delSession) {
    showToast('❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่');
    setRowBusy(id, false);
    showLogin();
    return;
  }

  const { error } = await sb.from('cheer_up_messages').delete().eq('id', id);
  if (error) { console.error('[Admin] doDelete:', error.code, error.message); showToast('❌ เกิดข้อผิดพลาด กรุณาลองใหม่'); setRowBusy(id, false); return; }

  allAdminMessages = allAdminMessages.filter(m => m.id !== id);
  showToast('🗑 ลบข้อความแล้ว');
  logAdminAction('DELETED', id, 'ลบข้อความออกจากระบบถาวร');
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

        // When a new pin arrives from any source (another admin window, public board),
        // clear stale is_pinned on all other rows before merging — handles out-of-order events
        if (msg.is_pinned) {
          allAdminMessages.forEach(m => { if (m.id !== msg.id) m.is_pinned = false; });
        }

        allAdminMessages[idx] = { ...allAdminMessages[idx], ...msg };

        const listEl = document.getElementById('admin-list');
        const savedScroll = listEl ? listEl.scrollTop : 0;
        renderStats();
        renderList();
        if (listEl) listEl.scrollTop = savedScroll;
        renderAnalytics();
      }
    )
    .subscribe();

  sb.channel('admin-audit')
    .on('postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'admin_audit_logs' },
      ({ new: log }) => { prependAuditEntry(log); }
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
  logAdminAction(
    newState ? 'FORCE_WELCOME_ON' : 'FORCE_WELCOME_OFF',
    null,
    newState ? 'เปิด Launch Mode — Welcome แสดงทุกครั้ง' : 'ปิด Launch Mode'
  );
});

/* ══════════════════════════════════════════════════════════
   SITE SETTINGS — CURSOR EFFECT TOGGLE
   ══════════════════════════════════════════════════════════ */

async function loadCursorEffectSetting() {
  const { data, error } = await sb
    .from('site_settings')
    .select('cursor_effect_enabled')
    .eq('id', 1)
    .single();
  if (error) { console.warn('[Admin] cursor_effect_enabled load', error.message, error.hint); return; }
  applyCursorEffectUI(data?.cursor_effect_enabled ?? false);
}

function applyCursorEffectUI(active) {
  const toggle = document.getElementById('toggle-cursor-effect');
  if (toggle) toggle.checked = active;
  if (toggle) toggle.setAttribute('aria-checked', String(active));
}

document.getElementById('toggle-cursor-effect')?.addEventListener('change', async e => {
  const newState = e.target.checked;
  applyCursorEffectUI(newState); // optimistic

  const { error } = await sb
    .from('site_settings')
    .update({ cursor_effect_enabled: newState })
    .eq('id', 1);

  if (error) {
    console.error('[Admin] cursor_effect toggle', error.message, error.hint);
    applyCursorEffectUI(!newState); // revert on failure
    showToast('❌ อัปเดตสถานะไม่สำเร็จ');
    return;
  }
  showToast(newState ? '✨ เปิดเอฟเฟกต์เมาส์วิบวับแล้ว!' : '✅ ปิดเอฟเฟกต์เมาส์วิบวับแล้ว');
  logAdminAction(
    newState ? 'CURSOR_EFFECT_ON' : 'CURSOR_EFFECT_OFF',
    null,
    newState ? 'เปิดเอฟเฟกต์เมาส์วิบวับ' : 'ปิดเอฟเฟกต์เมาส์วิบวับ'
  );
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
  logAdminAction(
    newState ? 'BOARD_LOCKED' : 'BOARD_UNLOCKED',
    null,
    newState ? 'ปิดรับข้อความชั่วคราว' : 'เปิดรับข้อความอีกครั้ง'
  );
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
      content:      censorText(text),
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
  logAdminAction(
    text ? 'ANNOUNCEMENT_SAVED' : 'ANNOUNCEMENT_CLEARED',
    null,
    text ? 'บันทึกข้อความประกาศใหม่' : 'ล้างข้อความประกาศ'
  );
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
  saveAdminAnnouncement(censorText(text));
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
    ctx.font         = `700 ${(sz * 0.14).toFixed(0)}px Mitr, sans-serif`;
    ctx.fillText(total, width / 2, height / 2 - sz * 0.06);
    ctx.fillStyle = '#9ca3af';
    ctx.font      = `400 ${(sz * 0.075).toFixed(0)}px Mitr, sans-serif`;
    ctx.fillText('ทั้งหมด', width / 2, height / 2 + sz * 0.1);
    ctx.restore();
  }
};

if (typeof Chart !== 'undefined') {
  Chart.defaults.font.family = 'Mitr, sans-serif';
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
   FEEDBACK INBOX
   ══════════════════════════════════════════════════════════ */

function feedbackDateTime(iso) {
  return new Date(iso).toLocaleString('th-TH', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function renderFeedbacks(feedbacks) {
  const listEl = document.getElementById('feedback-list');
  if (!listEl) return;

  if (feedbacks.length === 0) {
    listEl.innerHTML = `
      <div class="feedback-empty" role="status">
        <span style="font-size:2.2rem">📭</span>
        <p>ยังไม่มีข้อเสนอแนะใหม่</p>
      </div>`;
    return;
  }

  listEl.innerHTML = feedbacks.map(fb => `
    <div class="feedback-item" data-feedback-id="${fb.id}" role="listitem">
      <div class="feedback-item-head">
        <div class="feedback-item-meta">
          <span class="feedback-sender">👤 ${esc(fb.sender_name ?? 'ไม่ระบุชื่อ')}</span>
          <span class="feedback-time">${feedbackDateTime(fb.created_at)}</span>
        </div>
        <button class="btn-del-feedback" data-id="${fb.id}" aria-label="ลบข้อเสนอแนะ">
          🗑 ลบ
        </button>
      </div>
      <p class="feedback-msg">${esc(fb.message)}</p>
    </div>`).join('');

  listEl.querySelectorAll('.btn-del-feedback').forEach(btn => {
    btn.addEventListener('click', () => doDeleteFeedback(btn.dataset.id));
  });
}

async function loadFeedbacks() {
  const badge = document.getElementById('feedback-badge');

  const { data, error } = await sb
    .from('app_feedbacks')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) { console.warn('[Admin] feedbacks', error); return; }

  const feedbacks = data ?? [];
  const count     = feedbacks.length;

  if (badge) {
    badge.textContent  = count;
    badge.style.display = count > 0 ? 'inline' : 'none';
  }

  renderFeedbacks(feedbacks);
}

async function doDeleteFeedback(id) {
  if (!window.confirm('ต้องการลบข้อเสนอแนะนี้ถาวรหรือไม่?')) return;

  const btn = document.querySelector(`.btn-del-feedback[data-id="${id}"]`);
  if (btn) btn.disabled = true;

  const { error } = await sb.from('app_feedbacks').delete().eq('id', id);

  if (error) {
    console.error('[Admin] delete feedback', error);
    showToast('❌ ลบไม่สำเร็จ กรุณาลองใหม่');
    if (btn) btn.disabled = false;
    return;
  }

  showToast('🗑 ลบข้อเสนอแนะแล้ว');
  loadFeedbacks();
}

/* ── Feedback inbox modal open / close ── */
function openFeedbackInbox() {
  const modal = document.getElementById('feedback-inbox-modal');
  if (!modal) return;
  modal.classList.remove('a-hidden');
  loadFeedbacks();
}

function closeFeedbackInbox() {
  document.getElementById('feedback-inbox-modal')?.classList.add('a-hidden');
}

document.getElementById('btn-open-feedbacks')?.addEventListener('click', openFeedbackInbox);
document.getElementById('feedback-inbox-close')?.addEventListener('click', closeFeedbackInbox);
document.getElementById('feedback-inbox-modal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeFeedbackInbox();
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeFeedbackInbox();
});

/* ══════════════════════════════════════════════════════════
   BOOT
   ══════════════════════════════════════════════════════════ */
checkSession();

/* ══════════════════════════════════════════════════════════
   GA ACTIVITY GALLERY — ADMIN
   ══════════════════════════════════════════════════════════ */
const GALLERY_BUCKET = 'gallery';
const GALLERY_FULL_MAXW  = 1600;
const GALLERY_THUMB_MAXW = 400;
const GALLERY_JPEG_Q     = 0.8;
const GALLERY_FREE_BYTES = 1024 * 1024 * 1024;        // 1 GB free tier
const GALLERY_WARN_BYTES = 800 * 1024 * 1024;         // warn near 800 MB
const GALLERY_AVG_BYTES  = 360 * 1024;                // est. full+thumb per photo

let galleryAlbums = [];   // [{...album, photos:[...]}]

/* ── SHA-256 helper (view-PIN hashing only; uploads use Auth) ── */
async function gallerySha256Hex(str) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function galleryPublicUrl(path) {
  return sb.storage.from(GALLERY_BUCKET).getPublicUrl(path).data.publicUrl;
}

function galleryThaiDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' }); }
  catch { return ''; }
}

/* ── Image processing: EXIF-correct resize + JPEG compress ──
   createImageBitmap(..., {imageOrientation:'from-image'}) bakes in the
   correct rotation so sideways phone photos come out upright. ── */
async function galleryProcessImage(file, maxW, quality) {
  let bitmap;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch (_) {
    bitmap = await createImageBitmap(file); // fallback (orientation may be ignored)
  }
  let { width, height } = bitmap;
  if (width > maxW) { height = Math.round(height * maxW / width); width = maxW; }
  const canvas = document.createElement('canvas');
  canvas.width = width; canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, width, height);
  ctx.drawImage(bitmap, 0, 0, width, height);
  if (bitmap.close) bitmap.close();
  return await new Promise(res => canvas.toBlob(res, 'image/jpeg', quality));
}

/* ══════════════════════════════════════════════════════════
   LOAD + RENDER
   ══════════════════════════════════════════════════════════ */
async function loadGallery() {
  const wrap = document.getElementById('gallery-albums');
  if (!wrap) return;
  wrap.innerHTML = '<div class="audit-empty">⏳ กำลังโหลดแกลเลอรี...</div>';
  try {
    const { data: albums, error: aErr } = await sb
      .from('albums')
      .select('id, name, event_date, description, cover_photo_id, created_at')
      .order('created_at', { ascending: false });
    if (aErr) throw aErr;

    const { data: photos, error: pErr } = await sb
      .from('photos')
      .select('id, album_id, storage_path, thumb_path, caption, sort_order, created_at')
      .order('sort_order', { ascending: true })
      .order('created_at', { ascending: true });
    if (pErr) throw pErr;

    const byAlbum = new Map();
    (photos ?? []).forEach(p => {
      if (!byAlbum.has(p.album_id)) byAlbum.set(p.album_id, []);
      byAlbum.get(p.album_id).push(p);
    });

    galleryAlbums = (albums ?? []).map(a => ({ ...a, photos: byAlbum.get(a.id) ?? [] }));
    renderGalleryAlbums();
    updateStorageEstimate();
  } catch (err) {
    console.error('[Admin] loadGallery', err);
    wrap.innerHTML = '<div class="audit-empty">โหลดแกลเลอรีไม่สำเร็จ — รัน supabase_gallery.sql แล้วหรือยัง?</div>';
  }
}

function updateStorageEstimate() {
  const totalPhotos = galleryAlbums.reduce((n, a) => n + a.photos.length, 0);
  const bytes = totalPhotos * GALLERY_AVG_BYTES;
  const mb = bytes / (1024 * 1024);
  const label = document.getElementById('gap-storage');
  const fill  = document.getElementById('gap-storage-fill');
  if (label) {
    const near = bytes >= GALLERY_WARN_BYTES;
    label.textContent = `💾 ~${mb < 1024 ? mb.toFixed(1) + ' MB' : (mb / 1024).toFixed(2) + ' GB'} / 1 GB`;
    label.classList.toggle('gap-storage--warn', near);
    label.title = `ประมาณการจาก ${totalPhotos} รูป (เฉลี่ย ~${Math.round(GALLERY_AVG_BYTES/1024)} KB/รูป)`;
  }
  if (fill) {
    const pct = Math.min(100, (bytes / GALLERY_FREE_BYTES) * 100);
    fill.style.width = pct + '%';
    fill.classList.toggle('gap-storage-fill--warn', bytes >= GALLERY_WARN_BYTES);
  }
  if (bytes >= GALLERY_WARN_BYTES) {
    showToast('⚠️ พื้นที่ Storage ใกล้เต็ม 1 GB แล้ว');
  }
}

function renderGalleryAlbums() {
  const wrap = document.getElementById('gallery-albums');
  if (!wrap) return;
  if (galleryAlbums.length === 0) {
    wrap.innerHTML = `
      <div class="gap-empty">
        <div style="font-size:2.5rem">📸</div>
        <p>ยังไม่มีอัลบั้ม — กด “+ สร้างอัลบั้ม” เพื่อเริ่มเก็บความทรงจำดีๆ</p>
      </div>`;
    return;
  }
  wrap.innerHTML = galleryAlbums.map(renderGalleryAlbumCard).join('');
  wireGalleryAlbumActions();
}

function renderGalleryAlbumCard(a) {
  const cover = a.cover_photo_id
    ? a.photos.find(p => p.id === a.cover_photo_id)
    : a.photos[0];
  const coverHtml = cover
    ? `<img class="gap-album-cover" src="${esc(galleryPublicUrl(cover.thumb_path))}" alt=""
            onerror="this.style.display='none'"/>`
    : `<div class="gap-album-cover gap-album-cover--empty">📷</div>`;
  const dateStr = a.event_date ? galleryThaiDate(a.event_date) : galleryThaiDate(a.created_at);

  const photosHtml = a.photos.length === 0
    ? `<div class="gap-photos-empty">ยังไม่มีรูปในอัลบั้มนี้ — กด “อัปโหลดรูป” ด้านบน</div>`
    : a.photos.map(p => {
        const isCover = p.id === a.cover_photo_id;
        return `
          <div class="gap-photo${isCover ? ' is-cover' : ''}" data-photo="${p.id}" data-album="${a.id}">
            <img src="${esc(galleryPublicUrl(p.thumb_path))}" alt="${esc(p.caption || '')}" loading="lazy"
                 onerror="this.closest('.gap-photo').classList.add('is-broken');this.remove();"/>
            ${isCover ? '<span class="gap-photo-coverbadge">⭐ ปก</span>' : ''}
            <div class="gap-photo-actions">
              <button type="button" class="gap-mini-btn" data-act="cover" data-photo="${p.id}" data-album="${a.id}" title="ตั้งเป็นปก">⭐</button>
              <button type="button" class="gap-mini-btn gap-mini-btn--del" data-act="delphoto" data-photo="${p.id}" data-album="${a.id}" title="ลบรูป">🗑</button>
            </div>
          </div>`;
      }).join('');

  return `
    <div class="gap-album" data-album="${a.id}">
      <div class="gap-album-head">
        ${coverHtml}
        <div class="gap-album-info">
          <h3 class="gap-album-name">${esc(a.name)}</h3>
          <p class="gap-album-sub">${esc(dateStr)} · ${a.photos.length} รูป</p>
          ${a.description ? `<p class="gap-album-desc">${esc(a.description)}</p>` : ''}
        </div>
        <div class="gap-album-actions">
          <button type="button" class="action-btn" data-act="upload" data-album="${a.id}">⬆️ อัปโหลดรูป</button>
          <button type="button" class="action-btn" data-act="edit" data-album="${a.id}">✏️ แก้ไข</button>
          <button type="button" class="action-btn btn-del" data-act="delalbum" data-album="${a.id}">🗑 ลบ</button>
        </div>
      </div>
      <input type="file" class="gap-file-input a-hidden" data-album="${a.id}" accept="image/*" multiple />
      <div class="gap-progress a-hidden" data-album="${a.id}"></div>
      <div class="gap-photos">${photosHtml}</div>
    </div>`;
}

function wireGalleryAlbumActions() {
  const wrap = document.getElementById('gallery-albums');
  if (!wrap) return;

  wrap.querySelectorAll('[data-act="upload"]').forEach(btn => {
    btn.addEventListener('click', () => {
      wrap.querySelector(`.gap-file-input[data-album="${btn.dataset.album}"]`)?.click();
    });
  });
  wrap.querySelectorAll('.gap-file-input').forEach(inp => {
    inp.addEventListener('change', e => handleGalleryUpload(inp.dataset.album, e.target.files, inp));
  });
  wrap.querySelectorAll('[data-act="edit"]').forEach(btn => {
    btn.addEventListener('click', () => openAlbumModal(btn.dataset.album));
  });
  wrap.querySelectorAll('[data-act="delalbum"]').forEach(btn => {
    btn.addEventListener('click', () => deleteAlbum(btn.dataset.album));
  });
  wrap.querySelectorAll('[data-act="cover"]').forEach(btn => {
    btn.addEventListener('click', () => setAlbumCover(btn.dataset.album, btn.dataset.photo));
  });
  wrap.querySelectorAll('[data-act="delphoto"]').forEach(btn => {
    btn.addEventListener('click', () => deletePhoto(btn.dataset.album, btn.dataset.photo));
  });
}

/* ══════════════════════════════════════════════════════════
   ALBUM CREATE / EDIT MODAL
   ══════════════════════════════════════════════════════════ */
let editingAlbumId = null;

function openAlbumModal(albumId) {
  editingAlbumId = albumId ?? null;
  const modal = document.getElementById('album-modal');
  const title = document.getElementById('album-modal-title');
  const nameI = document.getElementById('album-name');
  const dateI = document.getElementById('album-date');
  const descI = document.getElementById('album-description');
  const errEl = document.getElementById('album-modal-error');
  errEl?.classList.add('a-hidden');

  if (albumId) {
    const a = galleryAlbums.find(x => x.id === albumId);
    title.textContent = '✏️ แก้ไขอัลบั้ม';
    nameI.value = a?.name ?? '';
    dateI.value = a?.event_date ?? '';
    descI.value = a?.description ?? '';
  } else {
    title.textContent = '🆕 สร้างอัลบั้มใหม่';
    nameI.value = ''; dateI.value = ''; descI.value = '';
  }
  modal.classList.remove('a-hidden');
  nameI.focus();
}

function closeAlbumModal() {
  document.getElementById('album-modal')?.classList.add('a-hidden');
  editingAlbumId = null;
}

async function saveAlbum() {
  const nameI = document.getElementById('album-name');
  const dateI = document.getElementById('album-date');
  const descI = document.getElementById('album-description');
  const errEl = document.getElementById('album-modal-error');
  const btn   = document.getElementById('album-save-btn');
  const label = document.getElementById('album-save-label');
  const spin  = document.getElementById('album-save-spinner');

  const name = nameI.value.trim();
  if (!name) {
    errEl.textContent = 'กรุณาใส่ชื่ออัลบั้ม';
    errEl.classList.remove('a-hidden');
    return;
  }

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); showLogin(); return; }

  btn.disabled = true; label.textContent = 'กำลังบันทึก...'; spin?.classList.remove('a-hidden');
  const payload = {
    name,
    event_date:  dateI.value || null,
    description: descI.value.trim() || null,
  };

  try {
    if (editingAlbumId) {
      const { error } = await sb.from('albums').update(payload).eq('id', editingAlbumId);
      if (error) throw error;
      showToast('✅ บันทึกอัลบั้มแล้ว');
      logAdminAction('ALBUM_UPDATED', editingAlbumId, `แก้ไขอัลบั้ม “${name}”`);
    } else {
      const { error } = await sb.from('albums').insert(payload);
      if (error) throw error;
      showToast('🆕 สร้างอัลบั้มแล้ว');
      logAdminAction('ALBUM_CREATED', null, `สร้างอัลบั้ม “${name}”`);
    }
    closeAlbumModal();
    await loadGallery();
  } catch (err) {
    console.error('[Admin] saveAlbum', err);
    errEl.textContent = 'บันทึกไม่สำเร็จ กรุณาลองใหม่';
    errEl.classList.remove('a-hidden');
  } finally {
    btn.disabled = false; label.textContent = 'บันทึก'; spin?.classList.add('a-hidden');
  }
}

async function deleteAlbum(albumId) {
  const a = galleryAlbums.find(x => x.id === albumId);
  if (!a) return;
  if (!confirm(`ลบอัลบั้ม “${a.name}” และรูปทั้งหมด ${a.photos.length} รูป?\nการลบนี้กู้คืนไม่ได้`)) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ'); showLogin(); return; }

  try {
    // 1. Remove every storage object (full + thumb) so nothing is orphaned.
    const paths = [];
    a.photos.forEach(p => { paths.push(p.storage_path); paths.push(p.thumb_path); });
    if (paths.length) {
      const { error: sErr } = await sb.storage.from(GALLERY_BUCKET).remove(paths);
      if (sErr) console.warn('[Admin] deleteAlbum storage', sErr.message);
    }
    // 2. Delete the album row (photos cascade-delete via FK).
    const { error } = await sb.from('albums').delete().eq('id', albumId);
    if (error) throw error;
    showToast('🗑 ลบอัลบั้มแล้ว');
    logAdminAction('ALBUM_DELETED', albumId, `ลบอัลบั้ม “${a.name}” (${a.photos.length} รูป)`);
    await loadGallery();
  } catch (err) {
    console.error('[Admin] deleteAlbum', err);
    showToast('❌ ลบอัลบั้มไม่สำเร็จ');
  }
}

async function setAlbumCover(albumId, photoId) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ'); showLogin(); return; }
  try {
    const { error } = await sb.from('albums').update({ cover_photo_id: photoId }).eq('id', albumId);
    if (error) throw error;
    const a = galleryAlbums.find(x => x.id === albumId);
    if (a) a.cover_photo_id = photoId;
    renderGalleryAlbums();
    showToast('⭐ ตั้งรูปหน้าปกแล้ว');
    logAdminAction('COVER_SET', albumId, 'ตั้งรูปหน้าปกอัลบั้ม');
  } catch (err) {
    console.error('[Admin] setAlbumCover', err);
    showToast('❌ ตั้งหน้าปกไม่สำเร็จ');
  }
}

/* ══════════════════════════════════════════════════════════
   UPLOAD (multi-file, client compress + thumbnail, per-file progress)
   ══════════════════════════════════════════════════════════ */
async function handleGalleryUpload(albumId, fileList, inputEl) {
  const files = Array.from(fileList || []);
  if (files.length === 0) return;
  if (inputEl) inputEl.value = ''; // allow re-selecting same files later

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ กรุณาเข้าสู่ระบบใหม่'); showLogin(); return; }

  const a = galleryAlbums.find(x => x.id === albumId);
  const progWrap = document.querySelector(`.gap-progress[data-album="${albumId}"]`);
  if (progWrap) { progWrap.classList.remove('a-hidden'); progWrap.innerHTML = ''; }

  let sortBase = a ? a.photos.length : 0;
  let okCount = 0;

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const row = document.createElement('div');
    row.className = 'gap-prog-row';
    row.innerHTML = `<span class="gap-prog-name">${esc(file.name)}</span><span class="gap-prog-status">⏳ กำลังประมวลผล...</span>`;
    progWrap?.appendChild(row);
    const statusEl = row.querySelector('.gap-prog-status');

    // ── validate ──
    if (!file.type.startsWith('image/')) {
      statusEl.textContent = '❌ ไม่ใช่ไฟล์รูปภาพ';
      statusEl.classList.add('gap-prog--err');
      continue;
    }
    if (file.size > 50 * 1024 * 1024) {
      statusEl.textContent = '❌ ไฟล์ใหญ่เกิน 50 MB';
      statusEl.classList.add('gap-prog--err');
      continue;
    }

    try {
      const id = crypto.randomUUID();
      const fullPath  = `${albumId}/${id}.jpg`;
      const thumbPath = `${albumId}/thumb_${id}.jpg`;

      statusEl.textContent = '🗜 กำลังบีบอัด...';
      const fullBlob  = await galleryProcessImage(file, GALLERY_FULL_MAXW,  GALLERY_JPEG_Q);
      const thumbBlob = await galleryProcessImage(file, GALLERY_THUMB_MAXW, GALLERY_JPEG_Q);
      if (!fullBlob || !thumbBlob) throw new Error('compress failed');

      statusEl.textContent = '⬆️ กำลังอัปโหลด...';
      const up1 = await sb.storage.from(GALLERY_BUCKET)
        .upload(fullPath, fullBlob, { contentType: 'image/jpeg', upsert: false });
      if (up1.error) throw up1.error;
      const up2 = await sb.storage.from(GALLERY_BUCKET)
        .upload(thumbPath, thumbBlob, { contentType: 'image/jpeg', upsert: false });
      if (up2.error) {
        // roll back the full image so we don't orphan it
        await sb.storage.from(GALLERY_BUCKET).remove([fullPath]).catch(() => {});
        throw up2.error;
      }

      const { error: insErr } = await sb.from('photos').insert({
        album_id:     albumId,
        storage_path: fullPath,
        thumb_path:   thumbPath,
        caption:      null,
        sort_order:   sortBase + i,
      });
      if (insErr) {
        await sb.storage.from(GALLERY_BUCKET).remove([fullPath, thumbPath]).catch(() => {});
        throw insErr;
      }

      statusEl.textContent = '✅ สำเร็จ';
      statusEl.classList.add('gap-prog--ok');
      okCount++;
    } catch (err) {
      console.error('[Admin] upload', file.name, err);
      statusEl.textContent = '❌ อัปโหลดไม่สำเร็จ';
      statusEl.classList.add('gap-prog--err');
    }
  }

  if (okCount > 0) {
    showToast(`🖼 อัปโหลด ${okCount} รูปสำเร็จ`);
    logAdminAction('PHOTO_UPLOADED', albumId, `อัปโหลด ${okCount} รูปเข้าอัลบั้ม “${a?.name ?? ''}”`);
  }
  setTimeout(() => loadGallery(), 900);
}

/* ══════════════════════════════════════════════════════════
   DELETE PHOTO (row + storage full & thumb)
   ══════════════════════════════════════════════════════════ */
async function deletePhoto(albumId, photoId) {
  const a = galleryAlbums.find(x => x.id === albumId);
  const p = a?.photos.find(x => x.id === photoId);
  if (!p) return;
  if (!confirm('ลบรูปนี้? การลบนี้กู้คืนไม่ได้')) return;

  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ'); showLogin(); return; }

  try {
    const { error: sErr } = await sb.storage.from(GALLERY_BUCKET).remove([p.storage_path, p.thumb_path]);
    if (sErr) console.warn('[Admin] deletePhoto storage', sErr.message);

    // If this was the album cover, clear the reference first.
    if (a.cover_photo_id === photoId) {
      await sb.from('albums').update({ cover_photo_id: null }).eq('id', albumId).catch(() => {});
    }

    const { error } = await sb.from('photos').delete().eq('id', photoId);
    if (error) throw error;

    showToast('🗑 ลบรูปแล้ว');
    logAdminAction('PHOTO_DELETED', photoId, `ลบรูปจากอัลบั้ม “${a?.name ?? ''}”`);
    await loadGallery();
  } catch (err) {
    console.error('[Admin] deletePhoto', err);
    showToast('❌ ลบรูปไม่สำเร็จ');
  }
}

/* ══════════════════════════════════════════════════════════
   VIEW-PIN CONFIG
   ══════════════════════════════════════════════════════════ */
async function loadGalleryConfig() {
  try {
    const { data, error } = await sb
      .from('gallery_config')
      .select('view_pin_enabled, view_pin_hash')
      .eq('id', 1)
      .single();
    if (error) { console.warn('[Admin] gallery_config', error.message); return; }
    applyGalleryPinUI(data?.view_pin_enabled ?? false, !!data?.view_pin_hash);
  } catch (_) { /* table may not exist yet */ }
}

function applyGalleryPinUI(enabled, hasHash) {
  const toggle = document.getElementById('gallery-pin-toggle');
  const label  = document.getElementById('gallery-pin-label');
  if (toggle) { toggle.checked = enabled; toggle.setAttribute('aria-checked', String(enabled)); }
  if (label)  label.textContent = enabled ? '🔒 ต้องใส่ PIN ตอนดู' : '🔓 ดูได้ทุกคน (ในลิงก์)';
  const setBtn = document.getElementById('gallery-set-pin-btn');
  if (setBtn) setBtn.textContent = hasHash ? '🔑 เปลี่ยน PIN' : '🔑 ตั้ง PIN';
}

async function toggleGalleryPin(enabled) {
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ'); showLogin(); return; }

  // Need a hash before enabling.
  if (enabled) {
    const { data } = await sb.from('gallery_config').select('view_pin_hash').eq('id', 1).single();
    if (!data?.view_pin_hash) {
      showToast('⚠️ กรุณาตั้ง PIN ก่อนเปิดใช้งาน');
      applyGalleryPinUI(false, false);
      openViewPinModal();
      return;
    }
  }

  const { error } = await sb.from('gallery_config')
    .upsert({ id: 1, view_pin_enabled: enabled }, { onConflict: 'id' });
  if (error) {
    console.error('[Admin] toggleGalleryPin', error);
    showToast('❌ อัปเดตไม่สำเร็จ');
    loadGalleryConfig();
    return;
  }
  applyGalleryPinUI(enabled, true);
  showToast(enabled ? '🔒 เปิดให้ต้องใส่ PIN ตอนดูแล้ว' : '🔓 ปิด PIN — ดูได้ทุกคนในลิงก์');
  logAdminAction(enabled ? 'GALLERY_PIN_ON' : 'GALLERY_PIN_OFF', null,
    enabled ? 'เปิดใช้ PIN สำหรับการดูแกลเลอรี' : 'ปิด PIN การดูแกลเลอรี');
}

function openViewPinModal() {
  const modal = document.getElementById('viewpin-modal');
  const input = document.getElementById('viewpin-input');
  const errEl = document.getElementById('viewpin-error');
  if (input) input.value = '';
  errEl?.classList.add('a-hidden');
  modal?.classList.remove('a-hidden');
  input?.focus();
}

function closeViewPinModal() {
  document.getElementById('viewpin-modal')?.classList.add('a-hidden');
}

async function saveViewPin() {
  const input = document.getElementById('viewpin-input');
  const errEl = document.getElementById('viewpin-error');
  const pin = (input?.value ?? '').trim();
  if (pin.length < 4) {
    errEl.textContent = 'PIN ต้องมีอย่างน้อย 4 ตัว';
    errEl.classList.remove('a-hidden');
    return;
  }
  const { data: { session } } = await sb.auth.getSession();
  if (!session) { showToast('❌ เซสชันหมดอายุ'); showLogin(); return; }

  try {
    const hash = await gallerySha256Hex(pin);
    const { error } = await sb.from('gallery_config')
      .upsert({ id: 1, view_pin_hash: hash }, { onConflict: 'id' });
    if (error) throw error;
    closeViewPinModal();
    applyGalleryPinUI(document.getElementById('gallery-pin-toggle')?.checked ?? false, true);
    showToast('🔑 ตั้ง PIN เรียบร้อย');
    logAdminAction('GALLERY_PIN_SET', null, 'ตั้ง/เปลี่ยน PIN การดูแกลเลอรี');
  } catch (err) {
    console.error('[Admin] saveViewPin', err);
    errEl.textContent = 'บันทึก PIN ไม่สำเร็จ กรุณาลองใหม่';
    errEl.classList.remove('a-hidden');
  }
}

/* ── Gallery admin event wiring ── */
document.getElementById('gallery-new-album-btn')?.addEventListener('click', () => openAlbumModal(null));
document.getElementById('album-modal-close')?.addEventListener('click', closeAlbumModal);
document.getElementById('album-save-btn')?.addEventListener('click', saveAlbum);
document.getElementById('album-modal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeAlbumModal();
});
document.getElementById('gallery-pin-toggle')?.addEventListener('change', e => toggleGalleryPin(e.target.checked));
document.getElementById('gallery-set-pin-btn')?.addEventListener('click', openViewPinModal);
document.getElementById('viewpin-close')?.addEventListener('click', closeViewPinModal);
document.getElementById('viewpin-save-btn')?.addEventListener('click', saveViewPin);
document.getElementById('viewpin-modal')?.addEventListener('click', e => {
  if (e.target === e.currentTarget) closeViewPinModal();
});
