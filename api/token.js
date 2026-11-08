/* ================================================================
 *  열쇠 바꿔주는 중계 함수 — 튼튼 업무수첩 (가계부 앱의 것과 같은 코드)
 *
 *  하는 일은 하나뿐입니다.
 *   · 구글에서 받은 일회용 코드  →  출입증 + 갱신용 열쇠로 바꿔 돌려줌
 *   · 갱신용 열쇠               →  새 출입증으로 바꿔 돌려줌
 *
 *  ★ 아무것도 저장하지 않습니다. 데이터베이스도 로그도 없습니다.
 *    업무수첩 내용은 이 함수를 지나가지 않습니다. 받은 것을 구글에 그대로
 *    넘기고, 구글이 준 답을 그대로 돌려줄 뿐입니다.
 *
 *  ★ 클라이언트 보안 비밀번호는 코드에 적지 않습니다.
 *    Vercel 환경변수 GOOGLE_CLIENT_SECRET 에서 읽습니다.
 *    (Vercel → 프로젝트 → Settings → Environment Variables)
 * ================================================================ */

// ★ app.js 맨 위 CFG.clientId 와 같은 값을 넣습니다 (업무수첩 새 프로젝트의 클라이언트 ID)
const CLIENT_ID = '여기에_클라이언트_ID.apps.googleusercontent.com';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'POST 만 받습니다' });
    return;
  }

  const secret = process.env.GOOGLE_CLIENT_SECRET;
  if (!secret) {
    res.status(500).json({
      error: 'no_secret',
      hint: 'Vercel 환경변수 GOOGLE_CLIENT_SECRET 이 없습니다'
    });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const form = new URLSearchParams();
  form.set('client_id', CLIENT_ID);
  form.set('client_secret', secret);

  if (body.code) {
    form.set('grant_type', 'authorization_code');
    form.set('code', body.code);
    // 팝업으로 받은 코드는 이 값으로 바꿉니다 (구글이 정한 약속어)
    form.set('redirect_uri', body.redirect_uri || 'postmessage');
    if (body.code_verifier) form.set('code_verifier', body.code_verifier);
  } else if (body.refresh_token) {
    form.set('grant_type', 'refresh_token');
    form.set('refresh_token', body.refresh_token);
  } else {
    res.status(400).json({ error: 'code 또는 refresh_token 이 있어야 합니다' });
    return;
  }

  try {
    const r = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString()
    });
    const text = await r.text();
    let json;
    try { json = JSON.parse(text); } catch (e) { json = { error: 'bad_response', raw: text.slice(0, 300) }; }

    // 받은 것을 그대로 돌려줍니다. 여기서 저장하는 것은 없습니다.
    res.status(r.status).json(json);
  } catch (e) {
    res.status(502).json({ error: 'google_unreachable', detail: String(e).slice(0, 200) });
  }
}
