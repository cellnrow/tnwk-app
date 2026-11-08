/* ================================================================
 *  튼튼 업무수첩 — 폰 앱
 *  셀앤로우 / CELL&ROW
 *
 *  데이터는 폰에서 구글로 바로 갑니다. 이 앱의 서버에는 아무것도
 *  저장되지 않습니다. 저장되는 것은 폰 안의 "어느 파일을 골랐는지"
 *  하나뿐입니다.
 *
 *  틀은 튼튼 가계부 폰 앱에서 그대로 가져왔습니다 (폰앱_공통틀.md 2번).
 *  로그인 · 갱신 열쇠 · 시트 API · 파일 고르기 · 비밀번호 잠금은 가계부와
 *  같은 코드입니다. 업무수첩에서 새로 짠 것은 읽을 범위 · 화면 · 적기,
 *  그리고 시트의 onEdit 이 해 주던 일을 앱이 직접 하는 부분입니다.
 *
 *  ★ 시트 규칙을 바꿀 때는 Work.gs 와 이 파일을 같이 고칩니다.
 *    (접수번호 · 연락처 찾기 · 접수 → 할일 · 진행률/상태/완료일 ·
 *     할일 ↔ 일정 연결 · 회의록 후속 조치 → 할일)
 * ================================================================ */

'use strict';

/* ── 구글 클라우드 설정 (업무수첩 프로젝트, 번호 715373148180) ──────
 *  2026-11-08 채움. 프로젝트를 바꾸면 아래 세 값과 api/token.js 를 같이 고칩니다.
 *  이 값들은 앱 코드에 그대로 들어가는 공개 값입니다. 가릴 필요가
 *  없습니다. 클라이언트 보안 비밀번호는 여기에 넣지 않습니다.
 * ---------------------------------------------------------------- */
const CFG = {
  clientId: '715373148180-4bcvt3r8j5q4b4pqafmo9jkc8jsmogk7.apps.googleusercontent.com',
  apiKey:   'AIzaSyDIERQueZ3mVDWwS3Q6A9VyTL83NtydVqM',
  appId:    '715373148180',
  scope:    'https://www.googleapis.com/auth/drive.file'
};

function cfgReady() {
  return CFG.clientId.indexOf('여기에') < 0 && CFG.apiKey.indexOf('여기에') < 0;
}

/* ── 시트 이름 (Work.gs 의 SH 와 같아야 합니다) ── */
const SH = {
  CFG:   '설정',
  HOME:  '오늘의 할 일',
  TODO:  '할일',
  LOG:   '접수대장',
  SCHED: '일정',
  MEMO:  '메모',
  MEET:  '회의록',
  RT:    '루틴',
  CONT:  '연락처 관리',
  MAND:  '만다라트',
  PTASK: '업무 분장',
  META:  '_메타'
};

/* 이 시트들이 없으면 업무수첩 파일이 아닙니다 */
const NEED = [SH.CFG, SH.HOME, SH.TODO, SH.LOG, SH.SCHED, SH.MEMO, SH.MEET, SH.RT, SH.CONT, SH.MAND, SH.META];

/* ── 표 좌표 (Work.gs 와 같아야 합니다) ──────────────────────────
 *  열 번호는 1부터. 머리글은 3행, 내용은 4행부터.
 *  ★ 눈으로 짐작하지 않고, 읽을 때마다 머리글(HEAD)과 맞춰 봅니다.
 *    다르면 읽기를 멈추고 안내합니다 (폰앱_공통틀.md 4번 ③).
 * ---------------------------------------------------------------- */
const FIRST = 4;   // 모든 표의 첫 줄

const TC = { task: 1, no: 2, start: 3, due: 4, pri: 5, pct: 6, st: 7, done: 8, goal: 9, etc: 10, reg: 11,
             link: 12, rid: 13, stamp: 14, sync: 15, lk: 16, pair: 17 };
const TD_COLS = 17;

const LC = { no: 1, at: 2, route: 3, name: 4, tel: 5, org: 6, memo: 7, task: 8, st: 9, done: 10, etc: 11 };
const LG_COLS = 11;

/* 일정 13열 「다가오는 일정」은 머리글 칸 수식이 펼쳐지는 자리 — 절대 쓰지 않습니다 */
const SCC = { date: 1, edate: 2, start: 3, end: 4, title: 5, kind: 6, rep: 7, until: 8, lunar: 9, leap: 10,
              place: 11, memo: 12, next: 13, link: 14, rid: 15, stamp: 16, sync: 17, lk: 18, pair: 19, tdone: 20 };
const SC_COLS = 20;

const MC = { id: 1, date: 2, time: 3, title: 4, place: 5, who: 6, body: 7, decide: 8,
             follow: 9, owner: 10, due: 11, proj: 12, memo: 13, made: 14 };
const MT_COLS = 14;

const CTC = { org: 1, dept: 2, name: 3, tel: 4, memo: 5 };
const PTC = { pct: 7, st: 8, tid: 11 };

/* 루틴 : 3행 이름 · 4행 요일 · 7행부터 날짜, B~K 열 */
const RT = { name: 3, rule: 4, row: 7, max: 10 };

/* 머리글 — 시트를 만들 때 쓰는 글자 그대로 */
const HEAD = {};
HEAD[SH.TODO]  = ['할 일', '접수번호', '시작일', '마감일', '우선순위', '진행률', '상태', '완료일'];
HEAD[SH.LOG]   = ['접수번호', '접수일시', '경로', '이름', '전화번호', '소속', '내용', '처리할 일', '상태', '처리일', '비고'];
HEAD[SH.SCHED] = ['시작 날짜', '종료 날짜', '시작 시각', '종료 시각', '제목', '종류', '반복', '반복 종료일', '음력', '윤달', '장소', '메모', '다가오는 일정',
                  '연동', '캘린더 ID', '시트 수정', '연동 시각', '할일 연결', '연결 ID', '할일 완료'];
HEAD[SH.MEMO]  = ['날짜', '메모'];
HEAD[SH.MEET]  = ['회의번호', '날짜', '시각', '회의명', '장소', '참석자', '회의 내용', '결정사항', '후속 조치', '담당', '기한', '프로젝트', '비고', '할일'];
HEAD[SH.CONT]  = ['소속', '부서', '이름', '전화번호', '메모'];

/* 「적힌 줄」을 가늠할 열 (Work.gs keysOf_ 와 같게) */
const KEYS = {};
KEYS[SH.TODO]  = [TC.task];
KEYS[SH.LOG]   = [LC.no, LC.name, LC.tel, LC.memo];
KEYS[SH.SCHED] = [SCC.date, SCC.title];
KEYS[SH.MEMO]  = [1, 2];
KEYS[SH.MEET]  = [MC.id, MC.title, MC.body];
KEYS[SH.CONT]  = [CTC.org, CTC.name, CTC.tel];

/* 진행 상태 — 자동 처리에 쓰는 이름. 설정 목록과 같아야 합니다 */
const ST = { NEW: '접수', DOING: '진행중', HOLD: '보류', DONE: '완료' };
const PRI_DEFAULT = '보통';
const ROUTE_DEFAULT = '전화';
const SC_KIND = ['일정', '기념일'];
const SC_REP = ['없음', '매주', '매월', '매년'];
const PAIR_BROKEN = '연결 끊김';

/* ── 읽을 범위 — 한 번에 묶어 읽습니다 (열 때 한 번, 저장한 뒤 한 번) ── */
function ranges() {
  return [
    a1(SH.CFG,   'A3:C13'),   // 0  진행 상태 · 우선순위 · 접수 경로 (3행 머리글)
    a1(SH.CFG,   'E4:F7'),    // 1  내 이름 · 내 소속 · 연도 시작 월 · 경력 계산
    a1(SH.HOME,  'A2:I80'),   // 2  B2 날짜 · 5행 숫자 넷 · 9행부터 할 일 / 루틴 / 7일 일정
    a1(SH.TODO,  'A3:Q'),     // 3
    a1(SH.LOG,   'A3:K'),     // 4
    a1(SH.SCHED, 'A3:T'),     // 5
    a1(SH.MEMO,  'A3:B'),     // 6
    a1(SH.MEET,  'A3:N'),     // 7
    a1(SH.RT,    'A3:K4'),    // 8  루틴 이름 · 요일
    a1(SH.RT,    'A7:A'),     // 9  루틴 날짜
    a1(SH.CONT,  'A3:E'),     // 10
    a1(SH.MAND,  'L4:L11'),   // 11 만다라트 세부 목표 (할일 「목표」 목록)
    a1(SH.META,  'A1:B300')   // 12 연결 ID · 회의번호 순번
  ];
}

/* ================================================================
 *  작은 도구
 * ================================================================ */

const $ = function (id) { return document.getElementById(id); };

/** 시트 이름에 띄어쓰기 · 밑줄 등이 있으면 작은따옴표로 감쌉니다 */
function a1(sheet, ref) {
  return (/[^A-Za-z0-9가-힣]/.test(sheet) ? "'" + sheet + "'" : sheet) + '!' + ref;
}

function txt(v) { return (v === null || v === undefined) ? '' : String(v).trim(); }
function blank(v) { return v === '' || v === null || v === undefined; }

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

let toastTimer = null;
function toast(msg, ms) {
  const t = $('toast');
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, ms || 3200);
}

function splash(on) { $('splash').hidden = !on; }

function show(which) {
  ['connect', 'pick', 'lock', 'main'].forEach(function (k) {
    $('scr-' + k).hidden = (k !== which);
  });
  state.screen = which;
}

/* ── 날짜 ──────────────────────────────────────────────────────────
 *  시트 날짜는 「1899-12-30 부터 며칠」 숫자로 받습니다 (SERIAL_NUMBER).
 *  글자로 받으면 칸 서식마다 모양이 달라 읽기가 흔들립니다.
 * ---------------------------------------------------------------- */
function fromSerial(n) {
  const d = Math.floor(n);
  const ms = Math.round((n - d) * 864e5);
  const x = new Date(1899, 11, 30 + d);
  return new Date(x.getTime() + ms);
}

/** 날짜 칸 → Date. 날짜가 아니면 null (시각만 있는 0~1 숫자도 null) */
function asDate(v) {
  if (v instanceof Date) return v;
  if (typeof v === 'number' && v >= 1) return fromSerial(v);
  return null;
}

function dayOnly(d) { return new Date(d.getFullYear(), d.getMonth(), d.getDate()); }
function today() { return dayOnly(new Date()); }
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function p2(n) { return ('0' + n).slice(-2); }
function ymdStr(d) { return d.getFullYear() + '-' + p2(d.getMonth() + 1) + '-' + p2(d.getDate()); }
const WD = '일월화수목금토';
function mdw(d) { return (d.getMonth() + 1) + '/' + d.getDate() + ' (' + WD.charAt(d.getDay()) + ')'; }

/** 시각 칸 → 'HH:mm'. 비었거나 못 읽으면 '' */
function timeStr(v) {
  if (typeof v === 'number' && v >= 0 && v < 1) {
    const m = Math.round(v * 1440);
    return p2(Math.floor(m / 60)) + ':' + p2(m % 60);
  }
  if (typeof v === 'number' && v >= 1) {
    const d = fromSerial(v);
    return (d.getHours() || d.getMinutes()) ? p2(d.getHours()) + ':' + p2(d.getMinutes()) : '';
  }
  const m = txt(v).match(/^(\d{1,2}):(\d{2})/);
  return m ? p2(m[1]) + ':' + m[2] : '';
}

/* ── 시트에 쓸 값 ─────────────────────────────────────────────────
 *  USER_ENTERED 로 씁니다 (날짜 · 시각 · 체크칸이 시트 서식대로 들어가게).
 *  ★ 글자는 앞에 ' 를 붙여 씁니다. 안 붙이면
 *    · 「2026-0012」 같은 접수번호가 날짜로,
 *    · 「01012345678」 이 숫자로 바뀌어 앞의 0 이 빠지고,
 *    · 「=」 「+」 로 시작하는 글이 수식으로 읽힙니다.
 *    ' 는 시트에 남지 않습니다.
 * ---------------------------------------------------------------- */
function Day(d) { return { day: dayOnly(d) }; }          // 날짜만
function Stamp(d) { return { at: d || new Date() }; }    // 날짜 + 시각
function Time(s) { return { time: s }; }                 // 'HH:mm'

function out(v) {
  if (v === null || v === undefined || v === '') return '';
  if (typeof v === 'boolean' || typeof v === 'number') return v;
  // ★ 글자를 먼저 거릅니다. 글자에는 원래 .at 이라는 기능이 붙어 있어서
  //   아래 v.at 검사에 글자가 걸립니다.
  if (typeof v === 'string') return "'" + v;
  if (v.f) return v.f;                                     // 수식 그대로
  if (v.day) return ymdStr(v.day);
  if (v.at) { const d = v.at; return ymdStr(d) + ' ' + p2(d.getHours()) + ':' + p2(d.getMinutes()) + ':' + p2(d.getSeconds()); }
  if (v.time !== undefined) return v.time || '';
  if (v instanceof Date) return ymdStr(v);
  return "'" + String(v);
}

/** 진행률 정리 — 50 으로 적어도 50% 로 받는다 (Work.gs normPct_ 와 같게) */
function normPct(v) {
  if (blank(v)) return 0;
  let x;
  if (typeof v === 'string') {
    const s = v.trim();
    x = parseFloat(s);
    if (isNaN(x)) return 0;
    if (s.indexOf('%') >= 0 || x > 1) x = x / 100;
  } else {
    x = Number(v);
    if (isNaN(x)) return 0;
    if (x > 1) x = x / 100;
  }
  return Math.max(0, Math.min(1, x));
}

/* ================================================================
 *  상태
 * ================================================================ */

const state = {
  screen: '',
  tab: 'today',
  token: null,
  tokenExp: 0,
  fileId: null,
  fileName: '',
  sheets: [],
  sheetIds: {},
  hasPtask: false,
  d: {},           // 읽어 온 것 (정리한 모양)
  pinMode: '',
  pinBuf: '',
  pinFirst: '',
  codeCb: null,
  busy: false,
  calY: 0, calM: 0, calSel: null,
  schedView: 'list',
  panelSave: null
};

const LS_FILE = 'tnwk.fileId';
const LS_NAME = 'tnwk.fileName';
const LS_TOK  = 'tnwk.token';
const LS_PIN  = 'tnwk.pin';
const LS_RT   = 'tnwk.rt';
const LS_SEEN = 'tnwk.seen';

/* 마지막으로 쓴 지 이만큼 지나면 다시 물어봅니다 */
const LOCK_AFTER = 5 * 60 * 1000;

function saveToken() {
  try { localStorage.setItem(LS_TOK, JSON.stringify({ t: state.token, e: state.tokenExp })); }
  catch (e) { /* 사생활 모드 */ }
}

function loadToken() {
  try {
    const j = JSON.parse(localStorage.getItem(LS_TOK) || 'null');
    if (j && j.t && Date.now() < Number(j.e)) {
      state.token = j.t;
      state.tokenExp = Number(j.e);
      scheduleRefresh();
    }
  } catch (e) { /* 무시 */ }
}

function dropToken() {
  clearTimeout(refreshTimer);
  state.token = null;
  state.tokenExp = 0;
  try { localStorage.removeItem(LS_TOK); } catch (e) { /* 무시 */ }
}

/* ================================================================
 *  구글 로그인
 * ================================================================ */

let tokenClient = null;
let codeClient = null;
let pending = null;
let inflight = null;      // 받는 중인 요청 (같은 걸 두 번 부르지 않게)
let refreshTimer = null;  // 조용히 갱신할 시각

function gisReady() {
  return typeof google !== 'undefined' && google.accounts && google.accounts.oauth2;
}

function initTokenClient() {
  if (tokenClient) return;
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: CFG.clientId,
    scope: CFG.scope,
    callback: function (resp) {
      const p = pending; pending = null;
      if (resp && resp.access_token) {
        state.token = resp.access_token;
        state.tokenExp = Date.now() + (Number(resp.expires_in || 3600) - 90) * 1000;
        saveToken();
        scheduleRefresh();
        if (p) p.resolve(state.token);
      } else if (p) {
        p.reject(new Error('토큰을 받지 못했습니다'));
      }
    },
    error_callback: function (err) {
      const p = pending; pending = null;
      if (p) p.reject(err || new Error('로그인이 취소되었습니다'));
    }
  });
}

/* ── 갱신용 열쇠 ────────────────────────────────────────────────
 *  구글이 브라우저에 직접 주는 출입증은 한 시간짜리입니다. 그래서
 *  '갱신용 열쇠'를 따로 받아 둡니다. 이 열쇠는 오래 살아 있어서,
 *  한 번 로그인하면 그 뒤로는 묻지 않고 새 출입증을 받아올 수 있습니다.
 *
 *  열쇠를 받으려면 구글과 한 번 더 주고받아야 하는데 그 자리에
 *  클라이언트 보안 비밀번호가 필요합니다. 그 값을 앱에 넣을 수는 없으니
 *  Vercel 의 작은 중계 함수(api/token)가 대신 해 줍니다.
 *  중계 함수는 아무것도 저장하지 않습니다.
 * ---------------------------------------------------------------- */

function loadRT() {
  try { return localStorage.getItem(LS_RT) || ''; } catch (e) { return ''; }
}
function saveRT(v) {
  try { if (v) localStorage.setItem(LS_RT, v); } catch (e) { /* 사생활 모드 */ }
}
function dropRT() {
  try { localStorage.removeItem(LS_RT); } catch (e) { /* 무시 */ }
}

/** 중계 함수에 보내 출입증으로 바꿔 옵니다 */
function exchange(payload) {
  return fetch('/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  }).then(function (r) {
    return r.json().then(function (j) { return { ok: r.ok, j: j }; });
  }).then(function (out) {
    if (!out.ok || !out.j || !out.j.access_token) {
      const e = new Error((out.j && (out.j.error_description || out.j.error)) || '열쇠를 바꾸지 못했습니다');
      e.code = out.j && out.j.error;
      throw e;
    }
    return out.j;
  });
}

/** 받은 출입증을 챙깁니다 */
function applyTokens(j) {
  state.token = j.access_token;
  state.tokenExp = Date.now() + (Number(j.expires_in || 3600) - 90) * 1000;
  saveToken();
  if (j.refresh_token) saveRT(j.refresh_token);
  scheduleRefresh();
  return state.token;
}

/** 팝업으로 일회용 코드를 받아 중계 함수에 넘깁니다 (처음 한 번) */
function signInWithCode() {
  if (!gisReady() || !google.accounts.oauth2.initCodeClient) {
    return Promise.reject(new Error('코드 방식을 쓸 수 없습니다'));
  }
  return new Promise(function (resolve, reject) {
    if (!codeClient) {
      codeClient = google.accounts.oauth2.initCodeClient({
        client_id: CFG.clientId,
        scope: CFG.scope,
        ux_mode: 'popup',
        callback: function (resp) {
          const cb = state.codeCb; state.codeCb = null;
          if (!cb) return;
          if (!resp || !resp.code) { cb.reject(new Error('코드를 받지 못했습니다')); return; }
          exchange({ code: resp.code }).then(function (j) {
            cb.resolve(applyTokens(j));
          }).catch(cb.reject);
        },
        error_callback: function (err) {
          const cb = state.codeCb; state.codeCb = null;
          if (cb) cb.reject(err || new Error('로그인이 취소되었습니다'));
        }
      });
    }
    state.codeCb = { resolve: resolve, reject: reject };
    try { codeClient.requestCode(); }
    catch (e) { state.codeCb = null; reject(e); }
  });
}

/**
 * 구글에 출입증을 새로 달라고 합니다.
 * interactive=false 면 화면을 띄우지 않고 조용히 시도합니다.
 * (이미 허락한 적이 있으면 묻지 않고 내줍니다.)
 */
function requestToken(interactive) {
  // 눌러서 하는 요청은 조용한 요청보다 우선합니다
  if (interactive && pending) {
    pending.reject(new Error('새 요청으로 대체되었습니다'));
    pending = null;
    inflight = null;
  }
  if (inflight) return inflight;
  if (!gisReady()) return Promise.reject(new Error('구글 로그인 모듈을 불러오지 못했습니다'));

  initTokenClient();
  inflight = new Promise(function (resolve, reject) {
    pending = { resolve: resolve, reject: reject };
    try {
      tokenClient.requestAccessToken({ prompt: interactive ? 'consent' : '' });
    } catch (e) {
      pending = null;
      reject(e);
    }
  });
  const done = function () { inflight = null; };
  inflight.then(done, done);
  return inflight;
}

/**
 * 쓸 수 있는 출입증을 돌려줍니다. 순서가 있습니다.
 *   1. 아직 살아 있는 출입증이 있으면 그대로
 *   2. 갱신용 열쇠가 있으면 조용히 새로 받아옴  ← 평소엔 여기서 끝
 *   3. 눌러서 하는 요청이면 팝업으로 로그인
 *   4. 코드 방식이 막히면 예전 방식으로 되돌아감 (최악이어도 지금과 같음)
 */
function ensureToken(interactive) {
  if (state.token && Date.now() < state.tokenExp) {
    return Promise.resolve(state.token);
  }

  const rt = loadRT();
  if (rt) {
    return exchange({ refresh_token: rt }).then(applyTokens).catch(function (e) {
      // 열쇠가 더는 안 통하면 (사용자가 권한을 뺐거나 만료) 버리고 처음부터
      console.warn('갱신용 열쇠가 안 통합니다', e);
      dropRT();
      if (!interactive) return requestToken(false);
      return signInWithCode().catch(function () { return requestToken(true); });
    });
  }

  if (!interactive) return requestToken(false);
  return signInWithCode().catch(function (e) {
    console.warn('코드 방식이 안 돼 예전 방식으로 갑니다', e);
    return requestToken(true);
  });
}

/**
 * 조용히 갱신 — 출입증이 끊어지기 전에 미리 새로 받아옵니다.
 *
 *  구글이 주는 출입증은 한 시간짜리입니다. 끊어진 다음에 알아차리면
 *  로그인 화면이 떠서 구매자가 직접 눌러야 합니다. 그래서 만료 5분 전에
 *  앱이 알아서 새로 받아옵니다. 화면에는 아무것도 뜨지 않습니다.
 *
 *  ★ 실패할 수 있습니다. 아이폰은 홈 화면 앱과 사파리의 쿠키를 갈라놓기
 *    때문에, 구글이 "아까 그 사람"임을 알아볼 표식이 없으면 조용한 갱신이
 *    거절됩니다. 그때는 아무 일도 하지 않고, 다음에 쓸 때 평소대로
 *    로그인 화면을 띄웁니다. 지금보다 나빠지지는 않습니다.
 */
function scheduleRefresh() {
  clearTimeout(refreshTimer);
  if (!state.tokenExp) return;

  const early = 5 * 60 * 1000;
  const wait = Math.max(5000, state.tokenExp - Date.now() - early);

  refreshTimer = setTimeout(function () {
    const rt = loadRT();
    const go = rt ? exchange({ refresh_token: rt }).then(applyTokens)
                  : requestToken(false).then(scheduleRefresh);
    go.catch(function (e) {
      console.warn('조용한 갱신이 안 됐습니다. 다음에 쓸 때 물어봅니다.', e);
    });
  }, wait);
}
/* ================================================================
 *  시트 API
 * ================================================================ */

const API = 'https://sheets.googleapis.com/v4/spreadsheets/';

function call(url, opts, retried) {
  return ensureToken(false).then(function (tk) {
    const o = opts || {};
    o.headers = Object.assign({ Authorization: 'Bearer ' + tk }, o.headers || {});
    return fetch(url, o);
  }).then(function (res) {
    if (res.status === 401 && !retried) {
      dropToken();
      return call(url, opts, true);
    }
    if (res.status === 403) {
      throw new Error('이 파일을 읽을 권한이 없습니다. 파일을 다시 골라 주세요.');
    }
    if (res.status === 404) {
      throw new Error('파일을 찾을 수 없습니다. 지워졌거나 주소가 바뀌었습니다.');
    }
    if (res.status === 429) {
      throw new Error('잠시 뒤에 다시 시도해 주세요. 요청이 몰렸습니다.');
    }
    if (!res.ok) {
      return res.text().then(function (t) {
        throw new Error('구글이 응답을 거절했습니다 (' + res.status + ') ' + t.slice(0, 160));
      });
    }
    return res.json();
  });
}

/** 이 파일에 어떤 시트가 들어 있는지. 시트 번호도 같이 받아 둡니다 */
function fetchSheetNames(fileId) {
  const url = API + encodeURIComponent(fileId) +
              '?fields=' + encodeURIComponent('sheets.properties(title,sheetId)');
  return call(url).then(function (j) {
    const names = [];
    state.sheetIds = {};
    (j.sheets || []).forEach(function (sh) {
      const pr = sh.properties || {};
      const t = pr.title || '';
      names.push(t);
      if (t) state.sheetIds[t] = pr.sheetId;
    });
    return names;
  });
}

/** 여러 범위를 한 번에. 날짜는 숫자(SERIAL_NUMBER)로 받습니다 */
function fetchValues(fileId, list) {
  const qs = list.map(function (r) { return 'ranges=' + encodeURIComponent(r); }).join('&');
  const url = API + encodeURIComponent(fileId) + '/values:batchGet?' + qs +
              '&valueRenderOption=UNFORMATTED_VALUE' +
              '&dateTimeRenderOption=SERIAL_NUMBER';
  return call(url).then(function (j) {
    return (j.valueRanges || []).map(function (v) { return v.values || []; });
  });
}

/**
 * 여러 칸을 한 번에 씁니다. data : [{ range, values }]
 * 값은 out() 으로 바꿔서 넣습니다.
 */
function writeMany(data) {
  if (!data.length) return Promise.resolve();
  const body = {
    valueInputOption: 'USER_ENTERED',
    data: data.map(function (x) {
      return { range: x.range, values: x.values.map(function (r) { return r.map(out); }) };
    })
  };
  return call(API + encodeURIComponent(state.fileId) + '/values:batchUpdate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  }).catch(function (e) {
    if (/exceeds grid limits|grid limits/i.test(e.message || '')) {
      throw new Error('표 칸이 모자랍니다. 컴퓨터에서 파일을 열고 그 시트에 아무 줄이나 한 번 적으면 칸이 늘어납니다.');
    }
    throw e;
  });
}

/* 쓰기 묶음 — 한 줄 · 한 칸씩 모았다가 마지막에 한 번에 보냅니다 */
function Batch() { this.data = []; }
Batch.prototype.row = function (sheet, r, c0, values) {
  this.data.push({ range: a1(sheet, colL(c0) + r + ':' + colL(c0 + values.length - 1) + r), values: [values] });
  return this;
};
Batch.prototype.cell = function (sheet, r, c, v) { return this.row(sheet, r, c, [v]); };
Batch.prototype.send = function () { return writeMany(this.data); };

function colL(i) {
  let s = '', x = i;
  while (x > 0) { const m = (x - 1) % 26; s = String.fromCharCode(65 + m) + s; x = Math.floor((x - 1) / 26); }
  return s;
}

/* ================================================================
 *  파일 고르기
 * ================================================================ */

let pickerReady = false;

function loadPicker() {
  if (pickerReady || typeof gapi === 'undefined') return;
  gapi.load('picker', function () { pickerReady = true; });
}

function openPicker() {
  ensureToken(true).then(function (tk) {
    if (!pickerReady) {
      toast('파일 선택창을 준비하는 중입니다. 잠시 뒤 다시 눌러 주세요.');
      loadPicker();
      return;
    }
    const view = new google.picker.DocsView(google.picker.ViewId.SPREADSHEETS)
      .setIncludeFolders(false)
      .setSelectFolderEnabled(false);

    new google.picker.PickerBuilder()
      .setAppId(CFG.appId)
      .setOAuthToken(tk)
      .setDeveloperKey(CFG.apiKey)
      .setLocale('ko')
      .setTitle('업무수첩 파일 고르기')
      .addView(view)
      .setCallback(onPicked)
      .build()
      .setVisible(true);
  }).catch(function (e) {
    toast(e.message || '로그인이 필요합니다.');
  });
}

function onPicked(data) {
  if (!data || data.action !== google.picker.Action.PICKED) return;
  const doc = (data.docs || [])[0];
  if (!doc || !doc.id) return;
  connectFile(doc.id, doc.name);
}

/** 고른 파일이 업무수첩이 맞는지 확인하고 연결합니다 */
function connectFile(fileId, fileName) {
  splash(true);
  openFile(fileId).then(function () {
    try {
      localStorage.setItem(LS_FILE, fileId);
      if (fileName) localStorage.setItem(LS_NAME, fileName);
    } catch (e) { /* 사생활 모드 */ }
    if (fileName) state.fileName = fileName;
    splash(false);
    goMain();
  }).catch(function (e) {
    state.fileId = null;
    splash(false);
    toast(e.message || '파일을 읽지 못했습니다.', 7000);
    show('pick');
  });
}

/** 시트 목록을 확인하고 전부 읽습니다 */
function openFile(fileId) {
  return fetchSheetNames(fileId).then(function (names) {
    const missing = NEED.filter(function (n) { return names.indexOf(n) < 0; });
    if (missing.length) {
      throw new Error('튼튼 업무수첩 파일이 아닌 것 같습니다. ' + missing.join(' · ') +
        ' 시트를 찾을 수 없습니다. (컴퓨터에서 「설치 · 화면 고치기」를 먼저 해 주세요)');
    }
    state.fileId = fileId;
    state.sheets = names;
    state.hasPtask = names.indexOf(SH.PTASK) >= 0;
    return loadAll();
  });
}

function unlink() {
  try { localStorage.removeItem(LS_FILE); localStorage.removeItem(LS_NAME); } catch (e) { /* 무시 */ }
  state.fileId = null;
  state.d = {};
  show('pick');
}

/* ================================================================
 *  읽어서 정리하기
 * ================================================================ */

/** 머리글이 코드와 같은지. 다르면 엉뚱한 칸을 읽느니 멈춥니다 */
function checkHead(sheet, row) {
  const want = HEAD[sheet];
  const have = (row || []).map(txt);
  for (let i = 0; i < want.length; i++) {
    if (have[i] !== want[i]) {
      throw new Error('「' + sheet + '」 시트의 ' + colL(i + 1) + '열 머리글이 「' + want[i] + '」이 아니라 「' +
        (have[i] || '빈칸') + '」입니다. 컴퓨터에서 메뉴 「설치 · 화면 고치기」를 눌러 주세요.');
    }
  }
}

/**
 * 표 하나를 줄 목록으로. 줄마다 { r: 시트 행 번호, v: [칸들] }
 * 「적힌 마지막 줄」은 key 열로 셉니다. 체크칸(FALSE)은 적힌 것으로 보지 않습니다.
 *
 * ★ 표에는 빈 체크칸(FALSE)이 2000줄까지 깔려 있어서, 가계부처럼
 *   「맨 아래에 붙이기(append)」를 쓰면 2000줄 뒤로 들어갑니다.
 *   그래서 다음 줄은 여기서 센 last 바로 아래로 직접 정합니다.
 */
function table(raw, sheet, cols) {
  const keys = KEYS[sheet];
  const rows = [];
  let last = FIRST - 1;
  for (let i = 1; i < raw.length; i++) {        // 0번째는 머리글
    const v = raw[i].slice(0, cols);
    while (v.length < cols) v.push('');
    const r = FIRST + i - 1;
    const used = keys.some(function (k) { const x = v[k - 1]; return !blank(x) && x !== false; });
    if (used) last = r;
    rows.push({ r: r, v: v, used: used });
  }
  return { rows: rows.filter(function (x) { return x.used; }), last: last, sheet: sheet };
}

function nextRow(t) { return t.last + 1; }

function loadAll() {
  return fetchValues(state.fileId, ranges()).then(function (v) {
    const take = function (i) { return v[i] || []; };

    checkHead(SH.TODO,  take(3)[0]);
    checkHead(SH.LOG,   take(4)[0]);
    checkHead(SH.SCHED, take(5)[0]);
    checkHead(SH.MEMO,  take(6)[0]);
    checkHead(SH.MEET,  take(7)[0]);
    checkHead(SH.CONT,  take(10)[0]);

    const d = {};

    // 설정 — 목록 세 개 (3행 머리글 확인)
    const cfg = take(0);
    const ch = (cfg[0] || []).map(txt);
    if (ch[0] !== '진행 상태' || ch[1] !== '우선순위' || ch[2] !== '접수 경로') {
      throw new Error('설정 시트의 목록 머리글이 다릅니다. 컴퓨터에서 「설치 · 화면 고치기」를 눌러 주세요.');
    }
    const col = function (j, def) {
      const a = cfg.slice(1).map(function (r) { return txt(r[j]); }).filter(Boolean);
      return a.length ? a : def;
    };
    d.sts    = col(0, [ST.NEW, ST.DOING, ST.HOLD, ST.DONE]);
    d.pris   = col(1, ['높음', '보통', '낮음']);
    d.routes = col(2, ['전화', '방문', '메일']);
    const me = take(1);
    d.me = { name: txt((me[0] || [])[1]), org: txt((me[1] || [])[1]), fy: parseInt(txt((me[2] || [])[1]), 10) || 1 };
    if (d.me.fy < 1 || d.me.fy > 12) d.me.fy = 1;

    d.home  = parseHome(take(2));
    d.todo  = table(take(3), SH.TODO, TD_COLS);
    d.log   = table(take(4), SH.LOG, LG_COLS);
    d.sched = table(take(5), SH.SCHED, SC_COLS);
    d.memo  = table(take(6), SH.MEMO, 2);
    d.meet  = table(take(7), SH.MEET, MT_COLS);
    d.cont  = table(take(10), SH.CONT, 5);
    d.rt    = parseRoutine(take(8), take(9));
    d.goals = take(11).map(function (r) { return txt(r[0]); }).filter(Boolean);
    d.meta  = take(12);

    state.d = d;
    return d;
  });
}

/**
 * 「오늘의 할 일」 시트 — 시트가 계산해 둔 값을 그대로 읽습니다 (④ 안 가).
 *   A2:I80 을 읽으므로 0번째 줄이 2행입니다.
 *   B2 날짜 · 5행 숫자 넷(A·C·E·G) · 9행부터 할 일(A:C) · 루틴(E:F) · 7일 일정(H:I)
 */
function parseHome(raw) {
  const at = function (row, c) { return ((raw[row - 2] || [])[c - 1]); };
  const h = {};
  h.date = asDate(at(2, 2));
  h.kpi = [at(5, 1), at(5, 3), at(5, 5), at(5, 7)].map(function (x) { return typeof x === 'number' ? x : txt(x); });
  h.todos = []; h.routines = []; h.week = [];
  for (let r = 9; r <= 80; r++) {
    const a = at(r, 1), b = at(r, 2), c = at(r, 3);
    if (!blank(b)) h.todos.push({ due: asDate(a), task: txt(b), st: txt(c) });
    else if (r === 9 && !blank(a) && typeof a === 'string') h.todoEmpty = txt(a);   // 「이날 할 일이 없습니다」
    const e = at(r, 5), f = at(r, 6);
    if (!blank(e)) {
      if (blank(f)) h.rtEmpty = txt(e);
      else h.routines.push({ name: txt(e), done: txt(f).indexOf('☑') === 0 });
    }
    const hh = at(r, 8), ii = at(r, 9);
    if (!blank(ii)) h.week.push({ when: txt(hh), what: txt(ii) });
    else if (!blank(hh)) h.weekEmpty = txt(hh);
  }
  return h;
}

/** 루틴 — 이름 · 요일 규칙 · 날짜 줄 */
function parseRoutine(head, dates) {
  const names = (head[0] || []), rules = (head[1] || []);
  const list = [];
  for (let j = 1; j <= RT.max; j++) {
    const n = txt(names[j]);
    if (n) list.push({ name: n, col: j + 1, rule: txt(rules[j]) });
  }
  const rows = [];
  dates.forEach(function (r, i) {
    const d = asDate(r[0]);
    if (d) rows.push({ r: RT.row + i, d: dayOnly(d) });
  });
  return { list: list, rows: rows };
}

/** _메타 시트에서 값 하나 */
function metaFind(key) {
  const rows = state.d.meta || [];
  for (let i = 0; i < rows.length; i++) {
    if (txt(rows[i][0]) === key) return { r: i + 1, v: rows[i][1] };
  }
  return { r: 0, v: '' };
}

/**
 * _메타 순번을 하나 올려 쓰고 새 번호를 돌려줍니다 (Work.gs metaSet 과 같은 자리).
 * 없던 키면 맨 아래에 한 줄 붙입니다.
 */
function metaNext(batch, key) {
  const f = metaFind(key);
  const n = (Number(f.v) || 0) + 1;
  if (f.r) {
    batch.cell(SH.META, f.r, 2, n);
    state.d.meta[f.r - 1][1] = n;
  } else {
    const r = Math.max((state.d.meta || []).length, 1) + 1;
    batch.row(SH.META, r, 1, [key, n]);
    state.d.meta[r - 1] = [key, n];
  }
  return n;
}

/** 저장한 뒤 다시 읽습니다. 시트 수식이 다시 계산될 짬을 줍니다 */
function reloadSoon(ms) {
  return new Promise(function (res) { setTimeout(res, ms || 900); })
    .then(loadAll)
    .then(function () { renderAll(); })
    .catch(function (e) { toast(e.message || '다시 읽지 못했습니다.', 5000); });
}

/* ================================================================
 *  시트 규칙 — onEdit 이 해 주던 일을 앱이 직접 합니다
 *
 *  ★ API 로 쓰면 시트의 onEdit 이 돌지 않습니다 (폰앱_공통틀.md 4번 ①).
 *    아래는 전부 Work.gs 의 onEdit 과 같은 규칙입니다. 한쪽을 고치면
 *    다른 쪽도 같이 고칩니다.
 * ================================================================ */

/** 날짜가 속한 회계연도. 시작 월이 3이면 2027년 2월은 2026년도 (Work.gs fiscalYear_) */
function fiscalYear(d) {
  const fs = state.d.me.fy || 1;
  return d.getMonth() + 1 >= fs ? d.getFullYear() : d.getFullYear() - 1;
}

/** 다음 접수번호 — 회계연도-0001 (Work.gs loadSeq_ · nextNo_) */
function nextLogNo(when) {
  const y = String(fiscalYear(when));
  let max = 0;
  state.d.log.rows.forEach(function (x) {
    const m = txt(x.v[LC.no - 1]).match(/^(\d{4})-(\d+)$/);
    if (m && m[1] === y) max = Math.max(max, parseInt(m[2], 10));
  });
  return y + '-' + ('000' + (max + 1)).slice(-4);
}

/* ── 연락처 찾기 (Work.gs matchContact_ 와 같은 순서) ── */

function digits(v) { return String(v).replace(/\D/g, ''); }

/** 번호 비교용 열쇠 — 하이픈 · 맨 앞 0 무시, +82 는 0 으로 */
function telKey(v) {
  let d = digits(v);
  if (d.indexOf('82') === 0 && d.length >= 11) d = '0' + d.slice(2);
  return d.replace(/^0+/, '');
}

/** 숫자로 바뀌어 맨 앞 0 이 빠진 번호를 되살린다 (9자리 이상만) */
function fixTel(v) {
  if (typeof v === 'number') {
    const s = String(Math.round(v));
    return s.length >= 9 ? '0' + s : s;
  }
  return blank(v) ? '' : String(v).trim();
}

function contacts() {
  return state.d.cont.rows.map(function (x) {
    const r = x.v;
    const tel = fixTel(r[CTC.tel - 1]);
    const org = [r[CTC.org - 1], r[CTC.dept - 1]].map(txt).filter(Boolean).join(' ');
    return { name: txt(r[CTC.name - 1]), tel: tel, telD: telKey(tel), org: org };
  }).filter(function (c) { return c.name || c.tel; });
}

function uniq(arr) {
  const seen = {}, o = [];
  arr.forEach(function (x) { if (x && !seen[x]) { seen[x] = 1; o.push(x); } });
  return o;
}

/**
 * 연락처에서 한 사람을 고른다.
 *   { one, msg, pick: { by:'name'|'tel', items:[사람…] } }
 * 시트에서는 ▼ 목록을 칸에 걸지만, 앱에서는 고를 사람을 단추로 띄웁니다.
 */
function matchContact(list, tel, name) {
  const hasTel = !!telKey(tel), hasName = !!txt(name);
  if (hasTel) {
    let m = list.filter(function (c) { return c.telD === telKey(tel); });
    if (m.length > 1 && hasName) {
      const nn = m.filter(function (c) { return c.name === txt(name); });
      if (nn.length) m = nn;
    }
    if (m.length === 1) return { one: m[0], msg: '' };
    if (m.length > 1) {
      const names = uniq(m.map(function (c) { return c.name; }));
      if (names.length === 1) {
        const orgs = uniq(m.map(function (c) { return c.org; }));
        return {
          one: { name: m[0].name, tel: m[0].tel, org: orgs.length === 1 ? orgs[0] : '' },
          msg: orgs.length > 1 ? '연락처에 소속이 서로 다르게 적혀 있어 소속은 비워 두었습니다. (' + orgs.join(' / ') + ')' : ''
        };
      }
      return { one: null, msg: '이 번호를 쓰는 사람이 ' + names.length + '명입니다. 아래에서 골라 주세요.',
               pick: { by: 'name', items: m.slice(0, 30) } };
    }
  }
  if (hasName) {
    const m = list.filter(function (c) { return c.name === txt(name); });
    if (m.length === 1) return { one: m[0], msg: '' };
    if (m.length > 1) {
      const keys = uniq(m.map(function (c) { return c.telD; }));
      if (keys.length === 1) {
        const orgs = uniq(m.map(function (c) { return c.org; }));
        return { one: { name: m[0].name, tel: m[0].tel, org: orgs.length === 1 ? orgs[0] : '' }, msg: '' };
      }
      return { one: null, msg: '「' + txt(name) + '」이(가) ' + keys.length + '명입니다. 아래에서 골라 주세요.',
               pick: { by: 'tel', items: m.slice(0, 30) } };
    }
  }
  return { one: null, msg: '' };
}

/* ── 할일 ─────────────────────────────────────────────────────── */

function todoNewRow(o) {
  const v = new Array(TD_COLS).fill('');
  v[TC.task - 1]  = o.task;
  v[TC.no - 1]    = o.no || '';
  v[TC.start - 1] = o.start ? Day(o.start) : '';
  v[TC.due - 1]   = o.due ? Day(o.due) : '';
  v[TC.pri - 1]   = o.pri || PRI_DEFAULT;
  v[TC.pct - 1]   = o.pct === undefined ? 0 : o.pct;
  v[TC.st - 1]    = o.st || ST.NEW;
  v[TC.done - 1]  = o.done ? Day(o.done) : '';
  v[TC.goal - 1]  = o.goal || '';
  v[TC.etc - 1]   = o.etc || '';
  v[TC.reg - 1]   = Day(today());
  v[TC.stamp - 1] = Stamp();          // 연동 — 고친 시각 (태스크와 비교해 나중 것을 따름)
  v[TC.lk - 1]    = false;
  return v;
}

/**
 * 할일 한 줄을 고칩니다 — Work.gs onEditTodo_ 의 2 ~ 5 번과 같습니다.
 *   t  : { r, v }  (읽어 온 줄)
 *   ch : { 열번호: 새 값 }
 * 바뀐 칸만 b(Batch) 에 담습니다. 업무 분장 반영은 따로 읽어야 해서 Promise 를 돌려줍니다.
 */
function todoEdit(t, ch, b) {
  const v = t.v.slice();
  const dirty = {};
  const hit = function (c) { return Object.prototype.hasOwnProperty.call(ch, c); };
  const g = function (c) { return v[c - 1]; };
  const s = function (c, val) { v[c - 1] = val; dirty[c] = 1; };
  Object.keys(ch).forEach(function (k) { s(Number(k), ch[k]); });

  if ([TC.task, TC.due, TC.pct, TC.st, TC.etc].some(hit)) s(TC.stamp, Stamp());

  // 2. 진행률 — 100% 면 자동 완료
  if (hit(TC.pct)) {
    const p = normPct(g(TC.pct));
    s(TC.pct, p);
    if (p >= 1) {
      if (g(TC.st) !== ST.DONE) s(TC.st, ST.DONE);
      if (blank(g(TC.done))) s(TC.done, Day(today()));
    } else if (g(TC.st) === ST.DONE) {
      s(TC.st, ST.DOING);
      s(TC.done, '');
    } else if (p > 0 && g(TC.st) === ST.NEW) {
      s(TC.st, ST.DOING);
    }
  }
  // 3. 상태 — 완료면 100% 와 완료일, 되돌리면 완료일을 지우고 100% 로 남은 진행률은 비움
  if (hit(TC.st)) {
    if (g(TC.st) === ST.DONE) {
      if (normPct(g(TC.pct)) !== 1) s(TC.pct, 1);
      if (blank(g(TC.done))) s(TC.done, Day(today()));
    } else {
      if (!blank(g(TC.done))) s(TC.done, '');
      if (!blank(g(TC.pct)) && normPct(g(TC.pct)) >= 1) s(TC.pct, '');
    }
  }

  let after = Promise.resolve();
  // 4. 대장 · 프로젝트에서 온 일이면 그쪽에도
  const no = txt(g(TC.no));
  if (no && (hit(TC.pct) || hit(TC.st))) {
    if (/^PJ-\d+$/.test(no)) after = mirrorToPtask(no, g(TC.st), g(TC.pct), b);
    else mirrorToLog(no, g(TC.st), g(TC.done), b);
  }
  // 5. 일정과 연결된 할 일이면 짝 일정도 (⑤ 안 가)
  const pair = txt(g(TC.pair));
  if (pair && [TC.task, TC.start, TC.due, TC.pct, TC.st].some(hit)) {
    if (!todoToSched(v, pair, b)) { s(TC.pair, ''); s(TC.lk, PAIR_BROKEN); }
  }

  Object.keys(dirty).forEach(function (c) { b.cell(SH.TODO, t.r, Number(c), v[c - 1]); });
  return after;
}

/** 할일에서 바꾼 상태를 접수대장에 (Work.gs mirrorToLog_) */
function mirrorToLog(no, st, done, b) {
  const x = state.d.log.rows.filter(function (y) { return txt(y.v[LC.no - 1]) === no; })[0];
  if (!x) return;
  b.row(SH.LOG, x.r, LC.st, [st, st === ST.DONE ? (blank(done) ? Day(today()) : done) : '']);
}

/** 할일에서 바꾼 진행 상황을 업무 분장에 (Work.gs mirrorToPtask_) */
function mirrorToPtask(id, st, pct, b) {
  if (!state.hasPtask) return Promise.resolve();
  return fetchValues(state.fileId, [a1(SH.PTASK, 'K4:K')]).then(function (v) {
    const rows = v[0] || [];
    for (let i = 0; i < rows.length; i++) {
      if (txt(rows[i][0]) === id) {
        b.row(SH.PTASK, FIRST + i, PTC.pct, [blank(pct) ? '' : normPct(pct), st]);
        return;
      }
    }
  });
}

/** 할일 → 짝 일정. 짝이 없으면 false (Work.gs todoToSched_) */
function todoToSched(tv, id, b) {
  const x = state.d.sched.rows.filter(function (y) { return txt(y.v[SCC.pair - 1]) === id; })[0];
  if (!x) return false;
  let d = asDate(x.v[SCC.date - 1]), e = asDate(x.v[SCC.edate - 1]);
  const due = asDate(tv[TC.due - 1] && tv[TC.due - 1].day ? tv[TC.due - 1].day : tv[TC.due - 1]);
  const start = asDate(tv[TC.start - 1] && tv[TC.start - 1].day ? tv[TC.start - 1].day : tv[TC.start - 1]);
  const multi = function (a, z) { return a && z && dayOnly(z) > dayOnly(a); };
  if (due) {
    if (multi(d, e)) {
      if (start) d = dayOnly(start);
      e = dayOnly(due);
      if (!multi(d, e)) { d = dayOnly(due); e = null; }
    } else { d = dayOnly(due); e = null; }
  }
  b.row(SH.SCHED, x.r, SCC.date, [d ? Day(d) : '', e ? Day(e) : '']);
  b.cell(SH.SCHED, x.r, SCC.title, tv[TC.task - 1]);
  b.cell(SH.SCHED, x.r, SCC.stamp, Stamp());
  b.cell(SH.SCHED, x.r, SCC.tdone, tv[TC.st - 1] === ST.DONE);
  return true;
}

/* ── 접수대장 ─────────────────────────────────────────────────── */

/** 대장에서 바꾼 상태를 할일에 (Work.gs mirrorToTodo_) */
function mirrorToTodo(no, st, done, b) {
  const t = state.d.todo.rows.filter(function (y) { return txt(y.v[TC.no - 1]) === no; })[0];
  if (!t || blank(st)) return;
  const ch = {};
  ch[TC.st] = st;
  if (st === ST.DONE) {
    ch[TC.pct] = 1;
    ch[TC.done] = blank(done) ? (blank(t.v[TC.done - 1]) ? Day(today()) : t.v[TC.done - 1]) : done;
  } else {
    ch[TC.done] = '';
    if (!blank(t.v[TC.pct - 1]) && normPct(t.v[TC.pct - 1]) >= 1) ch[TC.pct] = '';
  }
  ch[TC.stamp] = Stamp();
  Object.keys(ch).forEach(function (c) { b.cell(SH.TODO, t.r, Number(c), ch[c]); });
  // 짝 일정이 있으면 완료 표시도 맞춥니다
  const pair = txt(t.v[TC.pair - 1]);
  if (pair) {
    const v = t.v.slice(); v[TC.st - 1] = st;
    todoToSched(v, pair, b);
  }
}

/* ── 회의록 후속 조치 → 할일 (Work.gs parseDue_ · parseFollow_ · followToTodo_) ── */

/** 기한 글자 → 날짜. 2026-10-20 · 10-20 · 10.20 · 10월 20일. 연도가 없으면 회의 날짜 기준 (지났으면 다음 해) */
function parseDue(p, base) {
  p = String(p).trim();
  let m = p.match(/^(\d{4})[-.](\d{1,2})[-.](\d{1,2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = p.match(/^(\d{1,2})[-.](\d{1,2})\.?$/) || p.match(/^(\d{1,2})\s*월\s*(\d{1,2})\s*일$/);
  if (!m) return null;
  const bb = base ? dayOnly(base) : today();
  let d = new Date(bb.getFullYear(), +m[1] - 1, +m[2]);
  if (d < bb) d = new Date(bb.getFullYear() + 1, +m[1] - 1, +m[2]);
  return d;
}

const BULLET = /^\s*([-•·*▶▷]|\d+[.)])\s*/;

function parseFollow(line, mt) {
  const parts = String(line).replace(BULLET, '').split('/').map(function (x) { return x.trim(); });
  const o = { what: parts[0], owner: '', due: null };
  parts.slice(1).forEach(function (p) {
    if (!p) return;
    const d = parseDue(p, mt.date);
    if (d && !o.due) o.due = d;
    else if (!o.owner) o.owner = p;
  });
  if (!o.owner) o.owner = txt(mt.owner);
  if (!o.due && mt.due) o.due = dayOnly(mt.due);
  return o;
}

function followLines(text) {
  return String(text || '').split(/\r?\n/).map(function (x) { return x.trim(); })
    .filter(function (x) { return x.replace(BULLET, '').trim(); });
}

/* ── 일정 펼치기 — 달력 · 앞으로 30일 (Work.gs occurrences_ 와 같은 식) ── */

const LUNAR_DATA = '30,3026,829;414,1874,0;768,3749,0;1123,2858,529;1506,1611,0;1860,2715,0;2215,2726,430;2599,1386,0;2953,2905,0;3308,2986,229;3692,1874,0;4046,3493,629;4430,2853,0;4784,2635,0;5138,2395,529;5522,2733,0;5877,1386,0;6231,1461,229;6615,2985,0;6970,3538,729;7354,3474,0;7708,3365,0;8062,3373,529;8446,2390,0;8800,693,0;9154,2781,429;9539,1748,0;9893,3497,0;10248,3786,229;10632,3730,0;10986,1702,629;11369,1319,0;11723,2647,0;12078,2390,530;12462,2778,0;12817,1748,0;13171,1873,330;13555,1865,0;13909,2835,730;14293,2707,0;14647,1323,0;15001,1307,630;15385,2413,0;15740,2922,0;16095,3492,430;16479,2980,0;16833,2889,0;17187,3403,229;17571,2709,0;17925,2731,729;18309,1325,0;18663,2733,0;19018,2730,530;19402,3506,0;19757,3492,0;20111,3745,330;20495,3402,0;20849,3477,829;21233,2710,0;21587,1366,0;21941,1397,629;22325,2773,0;22680,1746,0;23034,1877,429;23418,3749,0;23773,3658,0;24127,1614,329;24510,2715,0;24865,2774,729;25249,1386,0;25603,2905,0;25958,2994,529;26342,1874,0;26696,1829,0;27050,2859,429;27434,2635,0;27788,2475,829;28172,685,0;28526,1387,0;28881,1449,630;29265,3497,0;29620,3474,0;29974,3477,429;30358,3365,0;30712,3661,1029;31096,2646,0;31450,694,0;31804,2797,629;32189,1748,0;32543,3497,0;32898,3794,529;33282,3730,0;33636,3366,0;33990,1326,329;34373,2647,0;34728,2486,829;35112,2906,0;35467,1748,0;35821,1897,529;36205,1865,0;36559,1683,0;36913,2711,429;37297,1323,0;37651,2651,0;38006,2734,229;38390,874,0;38744,3541,729;39129,2980,0;39483,2889,0;39837,3411,529;40221,2709,0;40575,1325,0;40929,1325,330;41313,2733,0;41668,2986,929;42052,1490,0;42406,3493,0;42761,3754,529;43145,3402,0;43499,2709,0;43853,2717,429;44237,1366,0;44591,2741,0;44946,2774,229;45330,1746,0;45684,1893,629;46068,3749,0;46423,3658,0;46777,1622,529;47160,3227,0;47515,1370,0;47869,1389,329;48253,2921,0;48608,3922,1129;48992,1874,0;49346,2853,0;49700,2827,630;50084,2635,0;50438,1195,0;50792,699,529;51176,1389,0;51531,2921,0;51886,3498,229;52270,3474,0;52624,3749,729;53008,3365,0;53362,2637,0;53716,2637,530;54100,694,0;54454,1461,0';
let LUNAR_T = null;

function lunarTable() {
  if (!LUNAR_T) LUNAR_T = LUNAR_DATA.split(';').map(function (x) { return x.split(',').map(Number); });
  return LUNAR_T;
}

/** 음력 (y, m, d, 윤달?) → 양력. 범위 밖이면 null. 윤달이 없는 해면 평달로 */
function lunarToSolar(y, m, d, leap) {
  const T = lunarTable();
  const i = y - 1900;
  if (i < 0 || i >= T.length || m < 1 || m > 12 || d < 1 || d > 30) return null;
  const start = T[i][0], bits = T[i][1], lp = T[i][2];
  const leapM = Math.floor(lp / 100), leapDays = lp % 100;
  const len = function (mm) { return (bits >> (mm - 1)) & 1 ? 30 : 29; };
  let days = start;
  for (let mm = 1; mm < m; mm++) { days += len(mm); if (leapM === mm) days += leapDays; }
  let monthLen = len(m);
  if (leap && leapM === m) { days += len(m); monthLen = leapDays; }
  days += Math.min(d, monthLen) - 1;
  return new Date(1900, 0, 1 + days);
}

/** 날짜 칸 읽기. 음력 2월 30일처럼 양력에 없는 날은 글자로 들어오므로 글자도 읽는다 */
function parseYMD(v) {
  const dd = asDate(v);
  if (dd) return { y: dd.getFullYear(), m: dd.getMonth() + 1, d: dd.getDate() };
  if (blank(v)) return null;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})\s*[-./년]\s*(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) return { y: +m[1], m: +m[2], d: +m[3] };
  m = s.match(/^(\d{1,2})\s*[-./월]\s*(\d{1,2})/);
  if (m) return { y: 0, m: +m[1], d: +m[2] };
  return null;
}

function ymd(y, m, d) {
  const last = new Date(y, m, 0).getDate();
  return new Date(y, m - 1, Math.min(d, last));
}

/** 여러 날 일정이면 시작일 뒤로 며칠 더 이어지는지. 하루짜리 · 음력은 0 */
function spanDays(row) {
  if (row[SCC.lunar - 1] === true) return 0;
  const a = asDate(row[SCC.date - 1]), b = asDate(row[SCC.edate - 1]);
  if (!a || !b) return 0;
  const d = Math.round((dayOnly(b) - dayOnly(a)) / 864e5);
  return d > 0 ? d : 0;
}

/** 일정 한 줄이 [from, to] 사이에 오는 날을 모두 펼친다. 반복 · 음력 · 반복 끝 포함 */
function occurrences(row, from, to) {
  const p = parseYMD(row[SCC.date - 1]);
  if (!p) return [];
  from = dayOnly(from); to = dayOnly(to);
  const rep = txt(row[SCC.rep - 1]) || '없음';
  const lunar = row[SCC.lunar - 1] === true;
  const leap = row[SCC.leap - 1] === true;
  const u = asDate(row[SCC.until - 1]);
  const until = u ? dayOnly(u) : null;
  const o = [];
  const add = function (d) {
    if (!d) return;
    d = dayOnly(d);
    if (d >= from && d <= to && (!until || d <= until)) o.push(d);
  };
  if (lunar && (rep === '없음' || rep === '매년')) {
    if (rep === '없음') { if (p.y) add(lunarToSolar(p.y, p.m, p.d, leap)); return o; }
    for (let Y = from.getFullYear() - 1; Y <= to.getFullYear(); Y++) {
      if (p.y && Y < p.y) continue;
      add(lunarToSolar(Y, p.m, p.d, leap));
    }
    return o;
  }
  const base = ymd(p.y || 1900, p.m, p.d);
  if (rep === '없음') { if (p.y) add(base); return o; }
  if (rep === '매주') {
    const d = new Date(base);
    if (d < from) d.setDate(d.getDate() + Math.ceil((from - d) / 864e5 / 7) * 7);
    for (; d <= to; d.setDate(d.getDate() + 7)) add(new Date(d));
    return o;
  }
  if (rep === '매월') {
    for (let y = from.getFullYear(), m = from.getMonth() + 1; y < to.getFullYear() || (y === to.getFullYear() && m <= to.getMonth() + 1); m++) {
      if (m > 12) { m = 1; y++; }
      const d = ymd(y, m, p.d);
      if (d >= base) add(d);
    }
    return o;
  }
  for (let Y = from.getFullYear(); Y <= to.getFullYear(); Y++) {
    const d = ymd(Y, p.m, p.d);
    if (d >= base) add(d);
  }
  return o;
}

/**
 * [from, to] 사이의 일정 — 날마다 한 칸씩.
 * { day, start(시작일), span, t(시각), title, row }  여러 날 일정은 걸친 날마다 나옵니다.
 */
function schedBetween(from, to) {
  const list = [];
  state.d.sched.rows.forEach(function (x) {
    const r = x.v;
    if (blank(r[SCC.title - 1])) return;
    const sp = spanDays(r);
    occurrences(r, addDays(from, -sp), to).forEach(function (d) {
      for (let k = 0; k <= sp; k++) {
        const day = addDays(d, k);
        if (day < from || day > to) continue;
        list.push({ day: day, start: d, span: sp, k: k, t: timeStr(r[SCC.start - 1]), te: timeStr(r[SCC.end - 1]),
                    title: txt(r[SCC.title - 1]), kind: txt(r[SCC.kind - 1]), place: txt(r[SCC.place - 1]),
                    memo: txt(r[SCC.memo - 1]), rep: txt(r[SCC.rep - 1]), lunar: r[SCC.lunar - 1] === true,
                    tdone: r[SCC.tdone - 1] === true, row: x });
      }
    });
  });
  list.sort(function (a, b) { return a.day - b.day || String(a.t || '99').localeCompare(String(b.t || '99')); });
  return list;
}

/* ================================================================
 *  화면 그리기
 * ================================================================ */

const TAB_TITLE = { today: '오늘', todo: '할일', log: '접수', sched: '일정', more: '더보기' };

function goMain() {
  renderAll();
  renderPinButton();
  markSeen();
  show('main');
  tab(state.tab || 'today');
}

function tab(name) {
  state.tab = name;
  ['today', 'todo', 'log', 'sched', 'more'].forEach(function (k) {
    $('v-' + k).hidden = (k !== name);
  });
  document.querySelectorAll('.tab').forEach(function (t) {
    t.classList.toggle('on', t.dataset.tab === name);
  });
  $('top-title').textContent = TAB_TITLE[name];
  const t = today();
  $('top-sub').textContent = (t.getMonth() + 1) + '월 ' + t.getDate() + '일 ' + WD.charAt(t.getDay()) + '요일';
  $('v-' + name).scrollTop = 0;
}

function renderAll() {
  if (!state.d || !state.d.todo) return;
  renderToday();
  renderTodo();
  renderLog();
  renderSched();
  renderMore();
}

function clear(n) { while (n.firstChild) n.removeChild(n.firstChild); return n; }
function emptyLine(box, msg) { box.appendChild(el('p', 'empty', msg)); }

function stTag(st) {
  const s = txt(st);
  if (!s) return null;
  const cls = s === ST.DONE ? 'done' : s === ST.DOING ? 'doing' : s === ST.HOLD ? 'hold' : '';
  return el('span', 'tag ' + cls, s);
}

/** 동그라미 체크 단추 */
function tick(on, label, onClick, box) {
  const b = el('button', 'tick' + (on ? ' on' : '') + (box ? ' box' : ''));
  b.type = 'button';
  b.setAttribute('aria-label', label);
  b.setAttribute('aria-pressed', String(!!on));
  b.appendChild(el('i'));
  b.addEventListener('click', function (e) { e.stopPropagation(); onClick(b); });
  return b;
}

function itemRow(opt) {
  const row = el('div', 'item' + (opt.done ? ' done' : ''));
  if (opt.tick) row.appendChild(opt.tick);
  const main = el(opt.onClick ? 'button' : 'div', 'item-main');
  if (opt.onClick) { main.type = 'button'; main.addEventListener('click', opt.onClick); }
  main.appendChild(el('span', 'item-t', opt.title));
  if (opt.sub && opt.sub.length) {
    const s = el('span', 'item-s');
    opt.sub.forEach(function (x) { if (x) s.appendChild(typeof x === 'string' ? el('span', '', x) : x); });
    main.appendChild(s);
  }
  row.appendChild(main);
  if (opt.right) row.appendChild(typeof opt.right === 'string' ? el('span', 'item-r', opt.right) : opt.right);
  return row;
}

/* ── 오늘 ─────────────────────────────────────────────────────── */

function renderToday() {
  const h = state.d.home;
  const t = today();
  const isToday = !h.date || sameDay(h.date, t);

  $('td-other').hidden = isToday;
  if (!isToday) $('td-other-msg').textContent = '시트가 ' + (h.date.getMonth() + 1) + '월 ' + h.date.getDate() + '일 (' + WD.charAt(h.date.getDay()) + ')을 보고 있어요';

  const labels = isToday ? ['진행 중', '오늘 마감', '마감 지남', '이번 주 완료'] : ['진행 중', '그날 마감', '마감 지남', '그 주 완료'];
  const k = clear($('td-kpi'));
  labels.forEach(function (lb, i) {
    const box = el('div', 'kpi' + (i === 2 && Number(h.kpi[i]) > 0 ? ' alert' : ''));
    box.appendChild(el('b', '', blank(h.kpi[i]) ? '—' : String(h.kpi[i])));
    box.appendChild(el('span', '', lb));
    k.appendChild(box);
  });

  // 할 일 — 시트가 고른 목록 그대로 (마감이 그날까지이거나 이미 시작한 안 끝난 일)
  const box = clear($('td-todos'));
  $('td-todo-n').textContent = h.todos.length ? h.todos.length + '건' : '';
  if (!h.todos.length) emptyLine(box, h.todoEmpty || '이날 할 일이 없습니다');
  const base = h.date || t;
  h.todos.forEach(function (x) {
    const late = x.due && dayOnly(x.due) < base;
    const due = x.due ? el('span', late ? 'late' : '', '마감 ' + mdw(x.due)) : null;
    box.appendChild(itemRow({
      title: x.task,
      sub: [due, stTag(x.st)],
      tick: tick(false, '완료로 표시', function (b) { homeTodoDone(x, b); }),
      onClick: function () { const tr = findTodo(x); if (tr) openTodo(tr); else toast('할일 시트에서 이 줄을 찾지 못했습니다. 다시 읽어 주세요.'); }
    }));
  });

  // 루틴
  const rb = clear($('td-routine'));
  if (!h.routines.length) emptyLine(rb, h.rtEmpty || '오늘 할 루틴이 없습니다');
  h.routines.forEach(function (x) {
    rb.appendChild(itemRow({
      title: x.name,
      done: false,
      right: x.done ? '함' : '',
      tick: tick(x.done, x.done ? '체크 풀기' : '체크하기', function (b) { routineToggle(x, b); }, true)
    }));
  });

  // 7일 일정 — 시트의 「이날부터 7일 일정」 그대로
  const wb = clear($('td-week'));
  if (!h.week.length) emptyLine(wb, h.weekEmpty || '앞으로 7일 일정이 없습니다');
  h.week.forEach(function (x) { wb.appendChild(itemRow({ title: x.what, sub: [x.when] })); });
}

/** 「오늘의 할 일」 목록의 한 줄 → 할일 시트의 그 줄 */
function findTodo(x) {
  const cands = state.d.todo.rows.filter(function (t) {
    return txt(t.v[TC.task - 1]) === x.task && txt(t.v[TC.st - 1]) !== ST.DONE;
  });
  if (cands.length <= 1) return cands[0] || null;
  const same = cands.filter(function (t) {
    const d = asDate(t.v[TC.due - 1]);
    return (!d && !x.due) || (d && x.due && sameDay(d, x.due));
  });
  return same[0] || cands[0];
}

/* ── 할일 ─────────────────────────────────────────────────────── */

function todoSortKey(t) {
  const d = asDate(t.v[TC.due - 1]);
  return d ? d.getTime() : 9e15;
}

function renderTodo() {
  const rows = state.d.todo.rows;
  const open = rows.filter(function (t) { return txt(t.v[TC.st - 1]) !== ST.DONE; })
    .sort(function (a, b) { return todoSortKey(a) - todoSortKey(b) || a.r - b.r; });
  const done = rows.filter(function (t) { return txt(t.v[TC.st - 1]) === ST.DONE; })
    .sort(function (a, b) {
      const x = asDate(a.v[TC.done - 1]), y = asDate(b.v[TC.done - 1]);
      return (y ? y.getTime() : 0) - (x ? x.getTime() : 0) || b.r - a.r;
    }).slice(0, 10);

  $('tl-n').textContent = open.length + '건';
  const box = clear($('tl-open'));
  if (!open.length) emptyLine(box, '안 끝난 일이 없습니다');
  const t0 = today();
  open.forEach(function (t) {
    const v = t.v;
    const due = asDate(v[TC.due - 1]);
    const pr = txt(v[TC.pri - 1]);
    const pct = normPct(v[TC.pct - 1]);
    const bar = el('span', 'minibar'); const fill = el('i'); fill.style.width = Math.round(pct * 100) + '%'; bar.appendChild(fill);
    box.appendChild(itemRow({
      title: txt(v[TC.task - 1]),
      sub: [
        due ? el('span', dayOnly(due) < t0 ? 'late' : '', '마감 ' + mdw(due)) : '마감 없음',
        pr && pr !== PRI_DEFAULT ? el('span', 'tag' + (pr === '높음' ? ' hi' : ''), pr) : null,
        stTag(v[TC.st - 1]),
        pct > 0 ? bar : null,
        pct > 0 ? Math.round(pct * 100) + '%' : null
      ],
      tick: tick(false, '완료로 표시', function (b) { quickTodo(t, b, true); }),
      onClick: function () { openTodo(t); }
    }));
  });

  const db = clear($('tl-done'));
  if (!done.length) emptyLine(db, '끝낸 일이 없습니다');
  done.forEach(function (t) {
    const dd = asDate(t.v[TC.done - 1]);
    db.appendChild(itemRow({
      title: txt(t.v[TC.task - 1]),
      done: true,
      sub: [dd ? '완료 ' + mdw(dd) : ''],
      tick: tick(true, '완료 되돌리기', function (b) { quickTodo(t, b, false); }),
      onClick: function () { openTodo(t); }
    }));
  });
}

/* ── 접수 ─────────────────────────────────────────────────────── */

const lg = { auto: {}, picked: null, timer: null };

function renderLog() {
  const sel = $('lg-route');
  const cur = sel.value;
  clear(sel);
  state.d.routes.forEach(function (r) { const o = el('option', '', r); o.value = r; sel.appendChild(o); });
  sel.value = cur && state.d.routes.indexOf(cur) >= 0 ? cur
    : (state.d.routes.indexOf(ROUTE_DEFAULT) >= 0 ? ROUTE_DEFAULT : state.d.routes[0]);

  const box = clear($('lg-recent'));
  const rows = state.d.log.rows.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, 5);
  if (!rows.length) emptyLine(box, '아직 접수한 건이 없습니다');
  rows.forEach(function (x) {
    const v = x.v;
    const at = asDate(v[LC.at - 1]);
    const who = [txt(v[LC.name - 1]), txt(v[LC.org - 1])].filter(Boolean).join(' · ') || '(이름 없음)';
    box.appendChild(itemRow({
      title: who,
      sub: [txt(v[LC.no - 1]), at ? mdw(at) : '', txt(v[LC.memo - 1]).slice(0, 40)],
      right: stTag(v[LC.st - 1]) || '',
      onClick: function () { openLog(x); }
    }));
  });
}

/** 이름 · 번호를 적으면 연락처에서 찾습니다. 사람이 직접 적은 칸은 덮지 않습니다 */
function logLookup(src) {
  // 지난번에 자동으로 채운 칸은 비우고 다시 찾습니다 (사람이 고친 칸은 그대로)
  ['name', 'tel', 'org'].forEach(function (k) {
    if (k !== src && lg.auto[k] && $('lg-' + k).value === lg.auto[k]) $('lg-' + k).value = '';
  });
  lg.auto = {};
  const name = $('lg-name').value, tel = $('lg-tel').value;
  const hint = $('lg-hint'), pick = clear($('lg-pick'));
  pick.hidden = true; hint.hidden = true; hint.className = 'hint';
  if (!txt(name) && !telKey(tel)) return;

  const res = matchContact(contacts(), tel, name);
  if (res.one) {
    fillFrom(res.one);
    hint.textContent = '연락처에서 찾았습니다.' + (res.msg ? ' ' + res.msg : '');
    hint.hidden = false;
  } else if (res.pick) {
    hint.textContent = res.msg; hint.className = 'hint warn'; hint.hidden = false;
    res.pick.items.forEach(function (c) {
      const lab = (res.pick.by === 'tel' ? (c.tel || '번호 없음') : c.name) + ' · ' + (c.org || '소속 없음');
      const b = el('button', 'chip', lab); b.type = 'button';
      b.addEventListener('click', function () {
        pick.querySelectorAll('.chip').forEach(function (z) { z.classList.remove('on'); });
        b.classList.add('on');
        lg.auto = {};
        if (res.pick.by === 'tel') { $('lg-tel').value = c.tel; } else { $('lg-name').value = c.name; }
        fillFrom(c, true);
        hint.textContent = '골랐습니다.'; hint.className = 'hint';
      });
      pick.appendChild(b);
    });
    pick.hidden = false;
  } else {
    hint.textContent = '연락처에 없는 분입니다. 적은 그대로 들어갑니다.';
    hint.hidden = false;
  }
}

function fillFrom(c, force) {
  [['name', c.name], ['tel', c.tel], ['org', c.org]].forEach(function (p) {
    const box = $('lg-' + p[0]);
    if (p[1] && (force || !txt(box.value))) {
      if (!txt(box.value) || force) { box.value = p[1]; lg.auto[p[0]] = p[1]; }
    }
  });
}

function resetLogForm() {
  ['lg-name', 'lg-tel', 'lg-org', 'lg-memo', 'lg-task'].forEach(function (id) { $(id).value = ''; });
  $('lg-done').checked = false;
  $('lg-hint').hidden = true;
  clear($('lg-pick')).hidden = true;
  lg.auto = {};
}

/* ── 일정 ─────────────────────────────────────────────────────── */

function renderSched() {
  const t = today();
  const list = schedBetween(t, addDays(t, 29)).filter(function (x) { return x.k === 0 || sameDay(x.day, t); });
  const box = clear($('sc-list'));
  if (!list.length) emptyLine(box, '앞으로 30일 일정이 없습니다');
  list.forEach(function (x) { box.appendChild(schedItem(x, true)); });

  if (!state.calY) { state.calY = t.getFullYear(); state.calM = t.getMonth(); state.calSel = t; }
  renderCal();
  $('sc-listwrap').hidden = state.schedView !== 'list';
  $('sc-calwrap').hidden = state.schedView !== 'cal';
  document.querySelectorAll('.seg-b').forEach(function (b) { b.classList.toggle('on', b.dataset.sv === state.schedView); });
}

function schedItem(x, withDate) {
  const icon = x.kind === '기념일' ? '🎂 ' : '';
  const when = x.span ? mdw(x.start) + ' ~ ' + mdw(addDays(x.start, x.span)) : (withDate ? mdw(x.day) : '');
  const tm = x.t ? (x.te ? x.t + '~' + x.te : x.t) : '하루 종일';
  return itemRow({
    title: icon + x.title,
    done: x.tdone,
    sub: [when, tm, x.place, x.rep && x.rep !== '없음' ? x.rep : '', x.lunar ? '음력' : ''],
    onClick: function () { openSchedView(x); }
  });
}

function renderCal() {
  const y = state.calY, m = state.calM;
  $('cal-title').textContent = y + '년 ' + (m + 1) + '월';
  const first = new Date(y, m, 1);
  const from = addDays(first, -first.getDay());
  const to = addDays(from, 41);
  const sc = schedBetween(from, to);
  const dues = {};
  state.d.todo.rows.forEach(function (t) {
    if (txt(t.v[TC.st - 1]) === ST.DONE) return;
    const d = asDate(t.v[TC.due - 1]);
    if (d) dues[ymdStr(d)] = (dues[ymdStr(d)] || 0) + 1;
  });
  const has = {};
  sc.forEach(function (x) { has[ymdStr(x.day)] = 1; });

  const g = clear($('cal-grid'));
  const t0 = today();
  for (let i = 0; i < 42; i++) {
    const d = addDays(from, i);
    const k = ymdStr(d);
    const b = el('button');
    b.type = 'button';
    b.className = (d.getMonth() !== m ? 'out ' : '') + (d.getDay() === 0 ? 'sun ' : '') +
      (sameDay(d, t0) ? 'today ' : '') + (state.calSel && sameDay(d, state.calSel) ? 'sel' : '');
    b.appendChild(el('span', '', String(d.getDate())));
    const marks = el('span', 'marks');
    if (has[k]) marks.appendChild(el('i', 'dot d-s'));
    if (dues[k]) marks.appendChild(el('i', 'dot d-t'));
    b.appendChild(marks);
    b.setAttribute('aria-label', (d.getMonth() + 1) + '월 ' + d.getDate() + '일' + (has[k] ? ' 일정 있음' : '') + (dues[k] ? ' 마감 ' + dues[k] + '건' : ''));
    b.addEventListener('click', function () { state.calSel = d; renderCal(); });
    g.appendChild(b);
  }
  renderCalDay();
}

function renderCalDay() {
  const d = state.calSel || today();
  $('cal-day-title').textContent = mdw(d);
  const box = clear($('cal-day'));
  const sc = schedBetween(d, d);
  const td = state.d.todo.rows.filter(function (t) {
    const x = asDate(t.v[TC.due - 1]);
    return x && sameDay(x, d);
  });
  if (!sc.length && !td.length) emptyLine(box, '이날 일정 · 마감이 없습니다');
  sc.forEach(function (x) { box.appendChild(schedItem(x, false)); });
  td.forEach(function (t) {
    const isDone = txt(t.v[TC.st - 1]) === ST.DONE;
    box.appendChild(itemRow({
      title: '✅ ' + txt(t.v[TC.task - 1]),
      done: isDone,
      sub: ['할 일 마감', stTag(t.v[TC.st - 1])],
      onClick: function () { openTodo(t); }
    }));
  });
}

/* ── 더보기 ───────────────────────────────────────────────────── */

function renderMore() {
  const mb = clear($('mm-recent'));
  const memos = state.d.memo.rows.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, 10);
  if (!memos.length) emptyLine(mb, '아직 메모가 없습니다');
  memos.forEach(function (x) {
    const d = asDate(x.v[0]);
    mb.appendChild(itemRow({ title: txt(x.v[1]), sub: [d ? mdw(d) : ''] }));
  });

  const tb = clear($('mt-recent'));
  const mts = state.d.meet.rows.slice().sort(function (a, b) { return b.r - a.r; }).slice(0, 5);
  if (!mts.length) emptyLine(tb, '아직 회의록이 없습니다');
  mts.forEach(function (x) {
    const v = x.v, d = asDate(v[MC.date - 1]);
    tb.appendChild(itemRow({
      title: txt(v[MC.title - 1]) || '(회의명 없음)',
      sub: [txt(v[MC.id - 1]), d ? mdw(d) : '', txt(v[MC.made - 1])],
      onClick: function () { openMeetView(x); }
    }));
  });
  $('app-file').textContent = state.fileName ? '연결한 파일 : ' + state.fileName : '';
}

/* ================================================================
 *  아래에서 올라오는 창
 * ================================================================ */

function openPanel(title, build, buttons) {
  $('panel-title').textContent = title;
  const body = clear($('panel-body'));
  build(body);
  const foot = clear($('panel-foot'));
  (buttons || []).forEach(function (bt) {
    const b = el('button', bt.cls || 'btn-main', bt.label);
    b.type = 'button';
    b.addEventListener('click', function () { bt.onClick(b); });
    foot.appendChild(b);
  });
  foot.hidden = !(buttons && buttons.length);
  $('sheet-scrim').hidden = false;
  $('panel').hidden = false;
  body.scrollTop = 0;
}

function closePanel() {
  $('panel').hidden = true;
  $('sheet-scrim').hidden = true;
}

/* 입력 칸 만들기 */
function fInput(box, label, id, type, value, ph) {
  const f = el('div', 'field');
  const l = el('label', '', label); l.htmlFor = id;
  const i = el('input'); i.id = id; i.type = type || 'text'; i.value = value || '';
  if (ph) i.placeholder = ph;
  f.appendChild(l); f.appendChild(i); box.appendChild(f);
  return i;
}
function fArea(box, label, id, value, ph, rows) {
  const f = el('div', 'field');
  const l = el('label', '', label); l.htmlFor = id;
  const i = el('textarea'); i.id = id; i.rows = rows || 3; i.value = value || '';
  if (ph) i.placeholder = ph;
  f.appendChild(l); f.appendChild(i); box.appendChild(f);
  return i;
}
function fSelect(box, label, id, items, value) {
  const f = el('div', 'field');
  const l = el('label', '', label); l.htmlFor = id;
  const s = el('select'); s.id = id;
  items.forEach(function (it) { const o = el('option', '', it === '' ? '— 없음 —' : it); o.value = it; s.appendChild(o); });
  if (value !== undefined && items.indexOf(value) < 0 && value !== '') {
    const o = el('option', '', value); o.value = value; s.appendChild(o);
  }
  s.value = value === undefined ? items[0] : value;
  f.appendChild(l); f.appendChild(s); box.appendChild(f);
  return s;
}
function two(box) { const t = el('div', 'two'); box.appendChild(t); return t; }
function dateVal(v) { const d = asDate(v && v.day ? v.day : v); return d ? ymdStr(d) : ''; }
function readDate(s) {
  const m = txt(s).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? new Date(+m[1], +m[2] - 1, +m[3]) : null;
}
function foldBox(box, label) {
  const b = el('button', 'btn-dash', label); b.type = 'button';
  const wrap = el('div', 'detail-fold'); wrap.hidden = true;
  b.addEventListener('click', function () { wrap.hidden = !wrap.hidden; b.textContent = wrap.hidden ? label : '자세히 접기'; });
  box.appendChild(b); box.appendChild(wrap);
  return wrap;
}
function readonly(box, label, text) {
  if (!txt(text)) return;
  box.appendChild(el('p', 'label-sm', label));
  box.appendChild(el('div', 'readonly', text));
}

/* ── 할일 추가 · 고치기 ─────────────────────────────────────────── */

function openTodo(t) {
  const isNew = !t;
  const v = t ? t.v : new Array(TD_COLS).fill('');
  const goals = [''].concat(state.d.goals);
  let pct = normPct(v[TC.pct - 1]);
  let task, due, start, pri, st, goal, etc;

  openPanel(isNew ? '할 일 추가' : '할 일', function (box) {
    task = fArea(box, '할 일', 'p-task', txt(v[TC.task - 1]), '무엇을 할지', 2);
    const r1 = two(box);
    due = fInput(r1, '마감일', 'p-due', 'date', dateVal(v[TC.due - 1]));
    pri = fSelect(r1, '우선순위', 'p-pri', state.d.pris, txt(v[TC.pri - 1]) || PRI_DEFAULT);
    if (!isNew) {
      box.appendChild(el('p', 'label-sm', '진행률'));
      const chips = el('div', 'chips');
      [0, 0.25, 0.5, 0.75, 1].forEach(function (p) {
        const c = el('button', 'chip' + (Math.abs(p - pct) < 0.001 ? ' on' : ''), Math.round(p * 100) + '%');
        c.type = 'button';
        c.addEventListener('click', function () {
          pct = p;
          chips.querySelectorAll('.chip').forEach(function (z) { z.classList.remove('on'); });
          c.classList.add('on');
        });
        chips.appendChild(c);
      });
      box.appendChild(chips);
      st = fSelect(box, '상태', 'p-st', state.d.sts, txt(v[TC.st - 1]) || ST.NEW);
    }
    const more = foldBox(box, '자세히 — 시작일 · 목표 · 비고');
    start = fInput(more, '시작일 (이날 전에는 오늘의 할 일에 안 나옵니다)', 'p-start', 'date', dateVal(v[TC.start - 1]));
    goal = fSelect(more, '목표 (만다라트)', 'p-goal', goals, txt(v[TC.goal - 1]));
    etc = fInput(more, '비고', 'p-etc', 'text', txt(v[TC.etc - 1]));
    const info = [];
    if (txt(v[TC.no - 1])) info.push('접수번호 ' + txt(v[TC.no - 1]));
    if (txt(v[TC.pair - 1])) info.push('일정과 연결된 할 일입니다 — 고치면 일정도 같이 바뀝니다');
    if (info.length) box.appendChild(el('p', 'hint', info.join(' · ')));
  }, isNew ? [
    { label: '추가', onClick: function (b) { saveTodoNew(b); } }
  ] : [
    { label: '완료', cls: 'btn-sub good', onClick: function (b) { saveTodoEdit(t, b, true); } },
    { label: '저장', onClick: function (b) { saveTodoEdit(t, b, false); } }
  ]);

  function saveTodoNew(b) {
    const tk = txt(task.value);
    if (!tk) { toast('할 일을 적어 주세요.'); return; }
    const v2 = todoNewRow({ task: tk, due: readDate(due.value), start: readDate(start.value), pri: pri.value,
                            goal: goal.value, etc: txt(etc.value) });
    const r = nextRow(state.d.todo);
    run(b, function () {
      return new Batch().row(SH.TODO, r, 1, v2).send();
    }, '할 일을 넣었습니다.');
  }

  function saveTodoEdit(t2, b, finish) {
    const tk = txt(task.value);
    if (!tk) { toast('할 일을 적어 주세요.'); return; }
    const ch = {};
    const cmpDate = function (c, inp) {
      const a = dateVal(t2.v[c - 1]), z = inp.value;
      if (a !== z) ch[c] = z ? Day(readDate(z)) : '';
    };
    if (tk !== txt(t2.v[TC.task - 1])) ch[TC.task] = tk;
    cmpDate(TC.due, due); cmpDate(TC.start, start);
    if (pri.value !== txt(t2.v[TC.pri - 1])) ch[TC.pri] = pri.value;
    if (goal.value !== txt(t2.v[TC.goal - 1])) ch[TC.goal] = goal.value;
    if (txt(etc.value) !== txt(t2.v[TC.etc - 1])) ch[TC.etc] = txt(etc.value);
    if (finish) ch[TC.st] = ST.DONE;
    else {
      if (st.value !== txt(t2.v[TC.st - 1])) ch[TC.st] = st.value;
      else if (Math.abs(pct - normPct(t2.v[TC.pct - 1])) > 0.001) ch[TC.pct] = pct;
    }
    if (!Object.keys(ch).length) { closePanel(); return; }
    const bt = new Batch();
    run(b, function () {
      return todoEdit(t2, ch, bt).then(function () { return bt.send(); });
    }, finish ? '완료했습니다.' : '고쳤습니다.');
  }
}

/** 목록에서 동그라미를 눌렀을 때 — 완료 / 되돌리기 */
function quickTodo(t, btn, toDone) {
  btn.classList.toggle('on', toDone);
  btn.disabled = true;
  const ch = {}; ch[TC.st] = toDone ? ST.DONE : ST.DOING;
  const b = new Batch();
  run(null, function () {
    return todoEdit(t, ch, b).then(function () { return b.send(); });
  }, toDone ? '완료했습니다.' : '진행중으로 되돌렸습니다.', function () { btn.classList.toggle('on', !toDone); btn.disabled = false; });
}

function homeTodoDone(x, btn) {
  const t = findTodo(x);
  if (!t) { toast('할일 시트에서 이 줄을 찾지 못했습니다. 다시 읽어 주세요.'); return; }
  quickTodo(t, btn, true);
}

/* ── 루틴 체크 ──────────────────────────────────────────────────── */

function routineToggle(x, btn) {
  const day = state.d.home.date ? dayOnly(state.d.home.date) : today();
  const rt = state.d.rt;
  const c = rt.list.filter(function (z) { return z.name === x.name; })[0];
  const row = rt.rows.filter(function (z) { return sameDay(z.d, day); })[0];
  if (!c) { toast('루틴 시트에서 「' + x.name + '」을 찾지 못했습니다.'); return; }
  if (!row) { toast('루틴 시트에 이날 줄이 없습니다. 컴퓨터에서 파일을 한 번 열면 날짜 줄이 이어집니다.', 5000); return; }
  const on = !x.done;
  btn.classList.toggle('on', on);
  btn.disabled = true;
  run(null, function () {
    return new Batch().cell(SH.RT, row.r, c.col, on).send();
  }, on ? '체크했습니다.' : '체크를 풀었습니다.', function () { btn.classList.toggle('on', !on); btn.disabled = false; });
}

/* ── 접수 저장 · 상태 바꾸기 ─────────────────────────────────────── */

function saveLog() {
  const name = txt($('lg-name').value), tel = txt($('lg-tel').value);
  const memo = txt($('lg-memo').value), task = txt($('lg-task').value);
  if (!name && !tel && !memo && !task) { toast('이름 · 번호 · 내용 중 하나는 적어 주세요.'); return; }
  const now = new Date();
  const no = nextLogNo(now);
  const done = $('lg-done').checked;
  const st = done ? ST.DONE : ST.NEW;
  const v = new Array(LG_COLS).fill('');
  v[LC.no - 1] = no;
  v[LC.at - 1] = Stamp(now);
  v[LC.route - 1] = $('lg-route').value || ROUTE_DEFAULT;
  v[LC.name - 1] = name;
  v[LC.tel - 1] = tel;                     // 글자로 들어갑니다 (앞의 0 지킴)
  v[LC.org - 1] = txt($('lg-org').value);
  v[LC.memo - 1] = memo;
  v[LC.task - 1] = task;
  v[LC.st - 1] = st;
  v[LC.done - 1] = done ? Day(now) : '';
  const b = new Batch().row(SH.LOG, nextRow(state.d.log), 1, v);
  // 처리할 일 → 할일 시트 (Work.gs upsertTodo_ — 새 접수번호라 늘 새 줄)
  if (task) {
    b.row(SH.TODO, nextRow(state.d.todo), 1, todoNewRow({
      task: task, no: no, st: st, pct: done ? 1 : 0, done: done ? now : null
    }));
  }
  run($('btn-log-save'), function () { return b.send(); },
    no + ' 접수' + (task ? ' · 할일에 올렸습니다' : '') + '.', null, resetLogForm);
}

function openLog(x) {
  const v = x.v;
  let st;
  openPanel('접수 ' + txt(v[LC.no - 1]), function (box) {
    const at = asDate(v[LC.at - 1]);
    readonly(box, '접수일시 · 경로', (at ? mdw(at) + ' ' + p2(at.getHours()) + ':' + p2(at.getMinutes()) : '') + ' · ' + txt(v[LC.route - 1]));
    readonly(box, '이름 · 소속', [txt(v[LC.name - 1]), txt(v[LC.org - 1])].filter(Boolean).join(' · '));
    readonly(box, '전화번호', fixTel(v[LC.tel - 1]));
    readonly(box, '내용', txt(v[LC.memo - 1]));
    readonly(box, '처리할 일', txt(v[LC.task - 1]));
    st = fSelect(box, '상태', 'p-lst', state.d.sts, txt(v[LC.st - 1]) || ST.NEW);
    if (txt(v[LC.task - 1])) box.appendChild(el('p', 'hint', '상태를 바꾸면 할일 쪽도 같이 바뀝니다.'));
  }, [{ label: '저장', onClick: function (b) {
    const nv = st.value;
    if (nv === txt(v[LC.st - 1])) { closePanel(); return; }
    // Work.gs onEditLog_ 3 · 5 번
    const done = nv === ST.DONE ? (blank(v[LC.done - 1]) ? Day(today()) : v[LC.done - 1]) : '';
    const bt = new Batch().row(SH.LOG, x.r, LC.st, [nv, done]);
    mirrorToTodo(txt(v[LC.no - 1]), nv, done, bt);
    run(b, function () { return bt.send(); }, '상태를 바꿨습니다.');
  } }]);
}

/* ── 일정 추가 · 보기 ──────────────────────────────────────────── */

function openSchedNew() {
  const base = state.schedView === 'cal' && state.calSel ? state.calSel : today();
  let title, date, t1, t2, place, edate, kind, memo;
  openPanel('일정 추가', function (box) {
    title = fInput(box, '제목', 'p-stitle', 'text', '', '예: 팀 회의');
    date = fInput(box, '날짜', 'p-sdate', 'date', ymdStr(base));
    const r = two(box);
    t1 = fInput(r, '시작 시각', 'p-st1', 'time', '');
    t2 = fInput(r, '종료 시각', 'p-st2', 'time', '');
    box.appendChild(el('p', 'hint', '하루 종일이면 시각을 비워 두세요. 반복 · 음력 일정은 시트에서 적어 주세요.'));
    place = fInput(box, '장소', 'p-splace', 'text', '');
    const more = foldBox(box, '자세히 — 여러 날 · 종류 · 메모');
    edate = fInput(more, '종료 날짜 (여러 날이면)', 'p-sedate', 'date', '');
    kind = fSelect(more, '종류', 'p-skind', SC_KIND, SC_KIND[0]);
    memo = fInput(more, '메모', 'p-smemo', 'text', '');
  }, [{ label: '추가', onClick: function (b) {
    const tt = txt(title.value), d = readDate(date.value), e = readDate(edate.value);
    if (!tt) { toast('제목을 적어 주세요.'); return; }
    if (!d) { toast('날짜를 골라 주세요.'); return; }
    if (e && e < d) { toast('종료 날짜가 시작 날짜보다 앞입니다.'); return; }
    const v = new Array(12).fill('');            // 1~12열만. 13열 「다가오는 일정」은 수식 자리
    v[SCC.date - 1] = Day(d);
    v[SCC.edate - 1] = e && e > d ? Day(e) : '';
    v[SCC.start - 1] = t1.value ? Time(t1.value) : '';
    v[SCC.end - 1] = t2.value ? Time(t2.value) : '';
    v[SCC.title - 1] = tt;
    v[SCC.kind - 1] = kind.value || SC_KIND[0];   // Work.gs onEditSched_ — 종류 · 반복 기본값
    v[SCC.rep - 1] = SC_REP[0];
    v[SCC.lunar - 1] = false;
    v[SCC.leap - 1] = false;
    v[SCC.place - 1] = txt(place.value);
    v[SCC.memo - 1] = txt(memo.value);
    const r = nextRow(state.d.sched);
    run(b, function () {
      return new Batch().row(SH.SCHED, r, 1, v).cell(SH.SCHED, r, SCC.stamp, Stamp()).send();
    }, '일정을 넣었습니다.');
  } }]);
}

function openSchedView(x) {
  openPanel(x.title, function (box) {
    const when = x.span ? mdw(x.start) + ' ~ ' + mdw(addDays(x.start, x.span)) : mdw(x.day);
    readonly(box, '날짜', when + (x.lunar ? ' (음력 일정)' : ''));
    readonly(box, '시각', x.t ? (x.te ? x.t + ' ~ ' + x.te : x.t) : '하루 종일');
    readonly(box, '반복', x.rep && x.rep !== '없음' ? x.rep : '');
    readonly(box, '장소', x.place);
    readonly(box, '메모', x.memo);
    if (x.tdone) box.appendChild(el('p', 'hint', '연결된 할 일을 끝냈습니다.'));
    box.appendChild(el('p', 'hint', '일정 고치기 · 지우기는 시트에서 해 주세요.'));
  }, []);
}

/* ── 메모 ─────────────────────────────────────────────────────── */

function saveMemo() {
  const s = txt($('mm-text').value);
  if (!s) { toast('메모를 적어 주세요.'); return; }
  const r = nextRow(state.d.memo);
  run($('btn-memo-save'), function () {
    return new Batch().row(SH.MEMO, r, 1, [Day(today()), s]).send();   // Work.gs onEditMemo_ — 날짜 오늘
  }, '메모를 넣었습니다.', null, function () { $('mm-text').value = ''; });
}

/* ── 회의록 ───────────────────────────────────────────────────── */

function openMeetNew() {
  const f = {};
  openPanel('회의록 쓰기', function (box) {
    f.title = fInput(box, '회의명', 'p-mtitle', 'text', '');
    const r = two(box);
    f.date = fInput(r, '날짜', 'p-mdate', 'date', ymdStr(today()));
    f.time = fInput(r, '시각', 'p-mtime', 'time', '');
    f.place = fInput(box, '장소', 'p-mplace', 'text', '');
    f.who = fInput(box, '참석자', 'p-mwho', 'text', '');
    f.body = fArea(box, '회의 내용', 'p-mbody', '', '', 4);
    f.decide = fArea(box, '결정사항', 'p-mdec', '', '', 3);
    f.follow = fArea(box, '후속 조치 — 한 줄에 하나씩, 줄마다 할일이 됩니다', 'p-mfol', '',
      '자료 정리 / 담당자 / 11-20\n결과 공유', 3);
    box.appendChild(el('p', 'hint', '「할 일 / 담당 / 기한」 순서. 담당 · 기한을 비우면 아래 칸 값을 씁니다.'));
    const r2 = two(box);
    f.owner = fInput(r2, '담당', 'p-mowner', 'text', '');
    f.due = fInput(r2, '기한', 'p-mdue', 'date', '');
  }, [{ label: '저장', onClick: function (b) { saveMeet(f, b); } }]);
}

function saveMeet(f, btn) {
  const title = txt(f.title.value);
  const body = txt(f.body.value), decide = txt(f.decide.value), follow = f.follow.value;
  if (!title && !body && !decide && !txt(follow)) { toast('회의명이나 내용을 적어 주세요.'); return; }
  const date = readDate(f.date.value) || today();
  const due = readDate(f.due.value);
  const b = new Batch();
  const id = 'MT-' + ('000' + metaNext(b, 'mtseq')).slice(-4);     // Work.gs nextMeetId_
  const lines = followLines(follow);
  const mt = { date: date, owner: txt(f.owner.value), due: due };

  // 후속 조치 → 할일 (Work.gs followToTodo_). 새 회의번호라 늘 새 줄
  let r = nextRow(state.d.todo);
  lines.forEach(function (line, i) {
    const o = parseFollow(line, mt);
    if (!o.what) return;
    b.row(SH.TODO, r++, 1, todoNewRow({
      task: (title ? '[' + title + '] ' : '') + o.what,
      no: id + '-' + (i + 1),
      due: o.due,
      etc: o.owner ? '담당 ' + o.owner : ''
    }));
  });

  const v = new Array(MT_COLS).fill('');
  v[MC.id - 1] = id;
  v[MC.date - 1] = Day(date);
  v[MC.time - 1] = f.time.value ? Time(f.time.value) : '';
  v[MC.title - 1] = title;
  v[MC.place - 1] = txt(f.place.value);
  v[MC.who - 1] = txt(f.who.value);
  v[MC.body - 1] = body;
  v[MC.decide - 1] = decide;
  v[MC.follow - 1] = lines.join('\n');
  v[MC.owner - 1] = mt.owner;
  v[MC.due - 1] = due ? Day(due) : '';
  v[MC.made - 1] = lines.length ? '할일 ' + lines.length + '건' : '';
  b.row(SH.MEET, nextRow(state.d.meet), 1, v);

  run(btn, function () { return b.send(); },
    id + ' 저장' + (lines.length ? ' · 후속 조치 ' + lines.length + '건을 할일에 올렸습니다' : '') + '.');
}

function openMeetView(x) {
  const v = x.v;
  openPanel(txt(v[MC.title - 1]) || '회의록', function (box) {
    const d = asDate(v[MC.date - 1]);
    readonly(box, '회의번호 · 날짜', txt(v[MC.id - 1]) + ' · ' + (d ? mdw(d) : '') + (timeStr(v[MC.time - 1]) ? ' ' + timeStr(v[MC.time - 1]) : ''));
    readonly(box, '장소', txt(v[MC.place - 1]));
    readonly(box, '참석자', txt(v[MC.who - 1]));
    readonly(box, '회의 내용', txt(v[MC.body - 1]));
    readonly(box, '결정사항', txt(v[MC.decide - 1]));
    readonly(box, '후속 조치', txt(v[MC.follow - 1]));
    readonly(box, '할일', txt(v[MC.made - 1]));
    box.appendChild(el('p', 'hint', '고치기는 시트에서 해 주세요.'));
  }, []);
}

/* ── 저장 공통 ────────────────────────────────────────────────── */

/**
 * 쓰고 → 알리고 → 창을 닫고 → 다시 읽습니다.
 * 같은 단추를 두 번 눌러 두 줄 들어가는 일이 없게 막습니다.
 */
function run(btn, work, okMsg, onFail, onOk) {
  if (state.busy) { toast('앞에 저장한 것을 처리하는 중입니다. 잠시만요.'); if (onFail) onFail(); return; }
  state.busy = true;
  if (btn) btn.disabled = true;
  const end = function () { state.busy = false; if (btn) btn.disabled = false; };
  work().then(function () {
    closePanel();
    if (onOk) onOk();
    toast(okMsg);
    // ★ 다시 읽기가 끝날 때까지 다음 저장을 막습니다.
    //   옛 자료로 「다음 빈 줄」을 정하면 방금 쓴 줄을 덮어씁니다.
    return reloadSoon().then(end, end);
  }).catch(function (e) {
    end();
    if (onFail) onFail();
    toast(e.message || '저장하지 못했습니다.', 6000);
  });
}

/** 「오늘의 할 일」 날짜를 오늘로 — 시트에서 날짜를 지운 것과 같습니다 */
function homeToToday(btn) {
  run(btn, function () {
    return writeMany([{ range: a1(SH.HOME, 'B2'), values: [[{ f: '=TODAY()' }]] }]);
  }, '시트를 오늘로 맞췄습니다.');
}

/* ================================================================
 *  비밀번호 잠금
 *
 *  ★ 이것은 자물쇠가 아니라 가리개입니다. 브라우저 저장소를 들여다볼
 *    줄 아는 사람은 지나갈 수 있습니다. 누가 폰을 집어 들었을 때
 *    업무수첩이 대뜸 보이지 않게 하는 용도입니다. 진짜 보호는 폰 자체의
 *    잠금화면입니다.
 *  번호는 그대로 두지 않고 소금을 섞어 해시로만 저장합니다.
 * ================================================================ */

function pinSaved() {
  try { return JSON.parse(localStorage.getItem(LS_PIN) || 'null'); }
  catch (e) { return null; }
}

function pinHash(pin, salt) {
  const data = new TextEncoder().encode(salt + ':' + pin);
  return crypto.subtle.digest('SHA-256', data).then(function (buf) {
    return Array.prototype.map.call(new Uint8Array(buf), function (b) {
      return ('0' + b.toString(16)).slice(-2);
    }).join('');
  });
}

function markSeen() {
  try { localStorage.setItem(LS_SEEN, String(Date.now())); } catch (e) { /* 무시 */ }
}

function seenAgo() {
  try {
    const t = Number(localStorage.getItem(LS_SEEN) || 0);
    return t ? (Date.now() - t) : Infinity;
  } catch (e) { return Infinity; }
}

/** 지금 잠가야 하는가 */
function shouldLock() {
  return !!pinSaved() && seenAgo() > LOCK_AFTER;
}

function drawKeypad() {
  const pad = $('keypad');
  if (pad.children.length) return;
  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '', '0', 'back'];
  keys.forEach(function (k) {
    const b = document.createElement('button');
    b.type = 'button';
    if (!k) {
      b.className = 'blank';
      b.disabled = true;
      b.setAttribute('aria-hidden', 'true');
    } else if (k === 'back') {
      b.setAttribute('aria-label', '한 자 지우기');
      b.innerHTML = '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" ' +
        'stroke="currentColor" stroke-width="1.9" stroke-linecap="round" ' +
        'aria-hidden="true"><path d="M20 6H9l-5 6 5 6h11z"/>' +
        '<path d="M15 10l-4 4M11 10l4 4"/></svg>';
      b.addEventListener('click', pinBack);
    } else {
      b.textContent = k;
      b.addEventListener('click', function () { pinPush(k); });
    }
    pad.appendChild(b);
  });
}

function drawDots() {
  const n = state.pinBuf.length;
  /* ★ childNodes 를 쓰면 안 됩니다. 태그 사이의 줄바꿈 공백까지 자식으로
   *   세어서 점이 한 칸씩 밀립니다. 하나 눌러도 안 차고 네 개를 눌러도
   *   세 개만 차서, 한 번 더 누르게 되고 설정이 영영 안 됩니다.
   *   children 은 태그만 셉니다. */
  const dots = $('lock-dots').children;
  for (let i = 0; i < dots.length; i++) {
    dots[i].classList.toggle('on', i < n);
  }
}

function openPin(mode) {
  state.pinMode = mode;        // 'unlock' | 'set1' | 'set2' | 'off'
  state.pinBuf = '';
  state.pinFirst = '';
  drawKeypad();
  drawDots();
  $('lock-msg').textContent = '';
  $('lock-title').textContent =
    mode === 'set1' ? '쓸 비밀번호 네 자리를 정하세요' :
    mode === 'off'  ? '잠금을 끄려면 비밀번호를 넣으세요' :
                      '비밀번호를 입력하세요';
  $('btn-pin-cancel').hidden = (mode === 'unlock');
  $('btn-pin-forgot').hidden = (mode !== 'unlock');
  show('lock');
}

function pinPush(d) {
  if (state.pinBuf.length >= 4) return;
  state.pinBuf += d;
  drawDots();
  if (state.pinBuf.length === 4) setTimeout(pinDone, 120);
}

function pinBack() {
  state.pinBuf = state.pinBuf.slice(0, -1);
  drawDots();
  $('lock-msg').textContent = '';
}

function pinFail(msg) {
  $('lock-msg').textContent = msg;
  state.pinBuf = '';
  drawDots();
}

function pinDone() {
  const pin = state.pinBuf;
  const mode = state.pinMode;

  if (mode === 'set1') {
    state.pinFirst = pin;
    state.pinBuf = '';
    state.pinMode = 'set2';
    drawDots();
    $('lock-title').textContent = '한 번 더 넣어 주세요';
    return;
  }

  if (mode === 'set2') {
    if (pin !== state.pinFirst) {
      state.pinMode = 'set1';
      state.pinFirst = '';
      $('lock-title').textContent = '쓸 비밀번호 네 자리를 정하세요';
      pinFail('두 번이 달랐습니다. 다시 정해 주세요.');
      return;
    }
    const salt = String(Math.random()).slice(2) + String(Date.now());
    pinHash(pin, salt).then(function (h) {
      try { localStorage.setItem(LS_PIN, JSON.stringify({ s: salt, h: h })); }
      catch (e) { /* 사생활 모드 */ }
      markSeen();
      renderPinButton();
      show('main');
      toast('비밀번호를 걸었습니다. 5분 넘게 안 쓰면 다시 물어봅니다.', 3600);
    });
    return;
  }

  // unlock · off — 맞는지 본다
  const saved = pinSaved();
  if (!saved) { markSeen(); show('main'); return; }
  pinHash(pin, saved.s).then(function (h) {
    if (h !== saved.h) { pinFail('번호가 다릅니다.'); return; }

    if (mode === 'off') {
      try { localStorage.removeItem(LS_PIN); } catch (e) { /* 무시 */ }
      markSeen();
      renderPinButton();
      show('main');
      toast('잠금을 껐습니다.');
      return;
    }
    markSeen();
    if (state.fileId) { show('main'); return; }
    enterSaved();          // 아직 안 읽었으면 지금 읽습니다
  });
}

function renderPinButton() {
  $('btn-pin').textContent = pinSaved() ? '비밀번호 잠금 끄기' : '비밀번호 잠금 켜기';
}

/* ================================================================
 *  시작
 * ================================================================ */

function wire() {
  $('btn-signin').addEventListener('click', function () {
    if (!cfgReady()) {
      toast('구글 클라우드 설정값이 아직 들어 있지 않습니다. app.js 맨 위 CFG 세 값을 채워 주세요.', 7000);
      return;
    }
    ensureToken(true).then(function () {
      let saved = null;
      try { saved = localStorage.getItem(LS_FILE); } catch (e) { saved = null; }
      if (saved) { connectFile(saved); return; }
      show('pick');
      loadPicker();
    }).catch(function (e) {
      toast(e.message || '로그인하지 못했습니다.', 5000);
    });
  });

  $('btn-pick').addEventListener('click', openPicker);
  $('btn-pick-back').addEventListener('click', function () { show('connect'); });
  $('btn-unlink').addEventListener('click', unlink);

  document.querySelectorAll('[data-reload]').forEach(function (b) {
    b.addEventListener('click', function () {
      if (state.busy) return;
      splash(true);
      loadAll().then(function () { splash(false); renderAll(); toast('다시 읽었습니다.'); })
               .catch(function (e) { splash(false); toast(e.message || '읽지 못했습니다.', 6000); });
    });
  });

  document.querySelectorAll('.tab').forEach(function (t) {
    t.addEventListener('click', function () { tab(t.dataset.tab); });
  });

  // 오늘
  $('btn-today-fix').addEventListener('click', function () { homeToToday($('btn-today-fix')); });

  // 할일
  $('btn-todo-add').addEventListener('click', function () { openTodo(null); });
  $('btn-done-fold').addEventListener('click', function () {
    const open = $('tl-done-wrap').hidden;
    $('tl-done-wrap').hidden = !open;
    $('btn-done-fold').setAttribute('aria-expanded', String(open));
    $('btn-done-label').textContent = open ? '끝낸 일 접기' : '끝낸 일 보기 (최근 10)';
    $('btn-done-fold').querySelector('.mark').textContent = open ? '−' : '+';
  });

  // 접수 — 이름 · 번호를 적으면 잠깐 뒤에 연락처를 찾습니다
  ['name', 'tel'].forEach(function (k) {
    $('lg-' + k).addEventListener('input', function () {
      clearTimeout(lg.timer);
      lg.timer = setTimeout(function () { logLookup(k); }, 400);
    });
  });
  $('lg-form').addEventListener('submit', function (e) { e.preventDefault(); saveLog(); });

  // 일정
  document.querySelectorAll('.seg-b').forEach(function (b) {
    b.addEventListener('click', function () { state.schedView = b.dataset.sv; renderSched(); });
  });
  $('btn-sched-add').addEventListener('click', openSchedNew);
  $('btn-cal-prev').addEventListener('click', function () {
    state.calM -= 1; if (state.calM < 0) { state.calM = 11; state.calY -= 1; }
    state.calSel = new Date(state.calY, state.calM, 1); renderCal();
  });
  $('btn-cal-next').addEventListener('click', function () {
    state.calM += 1; if (state.calM > 11) { state.calM = 0; state.calY += 1; }
    state.calSel = new Date(state.calY, state.calM, 1); renderCal();
  });

  // 더보기
  $('mm-form').addEventListener('submit', function (e) { e.preventDefault(); saveMemo(); });
  $('btn-meet-add').addEventListener('click', openMeetNew);

  // 창 닫기
  $('btn-panel-x').addEventListener('click', closePanel);
  $('sheet-scrim').addEventListener('click', closePanel);
  $('panel-body').addEventListener('submit', function (e) { e.preventDefault(); });

  // 비밀번호
  $('btn-pin').addEventListener('click', function () { openPin(pinSaved() ? 'off' : 'set1'); });
  $('btn-pin-cancel').addEventListener('click', function () { show(state.fileId ? 'main' : 'connect'); });
  $('btn-pin-forgot').addEventListener('click', function () {
    // 진짜 열쇠는 구글 계정입니다. 잠금을 풀고 로그인부터 다시 합니다.
    try {
      localStorage.removeItem(LS_PIN);
      localStorage.removeItem(LS_TOK);
      localStorage.removeItem(LS_RT);
    } catch (e) { /* 무시 */ }
    state.token = null;
    state.tokenExp = 0;
    renderPinButton();
    show('connect');
    toast('잠금을 풀었습니다. 구글 로그인으로 다시 들어오세요.', 4200);
  });

  // 화면을 떠난 시각을 적어 두고, 오래 지나 돌아오면 잠급니다
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) { markSeen(); return; }
    if (!state.token || state.tokenExp - Date.now() < 5 * 60 * 1000) {
      ensureToken(false).catch(function () { /* 조용히 */ });
    } else {
      scheduleRefresh();
    }
    if (shouldLock() && state.screen === 'main') { closePanel(); openPin('unlock'); }
  });
}

/** 저장해 둔 파일로 조용히 들어갑니다 */
function enterSaved() {
  let saved = null;
  try { saved = localStorage.getItem(LS_FILE); state.fileName = localStorage.getItem(LS_NAME) || ''; } catch (e) { saved = null; }
  if (!saved || !cfgReady()) { splash(false); show('connect'); return; }

  splash(true);
  ensureToken(false).then(function () {
    return openFile(saved);
  }).then(function () {
    splash(false);
    goMain();
  }).catch(function (e) {
    console.error('저장해 둔 파일로 들어가지 못했습니다', e);
    splash(false);
    // 머리글이 다르다 같은 안내는 보여 줍니다
    if (e && e.message && /시트|머리글/.test(e.message)) toast(e.message, 8000);
    show('connect');
  });
}

function boot() {
  wire();
  loadPicker();
  loadToken();
  renderPinButton();

  let saved = null;
  try { saved = localStorage.getItem(LS_FILE); } catch (e) { saved = null; }

  // 잠가야 하면 읽기 전에 먼저 물어봅니다. 뒤에 내용이 비치지 않게.
  if (saved && shouldLock()) { splash(false); openPin('unlock'); return; }
  enterSaved();
}

/** 구글 스크립트 두 개가 다 올라온 뒤에 시작합니다 */
(function waitForGoogle(tries) {
  tries = tries || 0;
  if (gisReady() && typeof gapi !== 'undefined') { boot(); return; }
  if (tries > 60) { wire(); splash(false); show('connect'); return; }
  setTimeout(function () { waitForGoogle(tries + 1); }, 100);
})();

/* 홈 화면 추가용 */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', function () {
    navigator.serviceWorker.register('sw.js').catch(function () { /* 무시 */ });
  });
}
