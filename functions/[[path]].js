export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);
  const COOKIE_NAME = "nav_session_v8_speed";

  // --- 1. 核心配置 ---
  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质资源推荐 · 随时畅联";
  const ADMIN_PASS = env.admin || "123456"; 
  // 获取原始图片链接用于预加载
  const RAW_IMG = env.img || ""; 
  // CSS 用的背景样式
  const BG_CSS = RAW_IMG ? `url('${RAW_IMG}')` : 'none';
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

  const getJson = (k) => { try { return env[k] ? JSON.parse(env[k]) : []; } catch(e) { return []; } };
  const LINKS_DATA = getJson('LINKS');
  const FRIENDS_DATA = getJson('FRIENDS');

  // 时间工具 (UTC+8)
  const getNow = () => new Date(new Date().getTime() + 8 * 3600000);
  const now = getNow();
  const currYear = now.getFullYear().toString();
  const currMonth = (now.getMonth() + 1).toString().padStart(2, '0');
  const dateKey = `${currYear}_${currMonth}`;
  const fullTimeStr = now.toISOString().replace('T', ' ').substring(0, 19);

  // 统一背景 HTML (带淡入动画)
  // 技巧：先用纯色填充，图片加载完后通过 CSS 淡入，解决"加载一半"的丑陋感
  const SHARED_BG_HTML = `
    <div class="bg-placeholder" style="position:fixed;inset:0;background:#0f172a;z-index:-3;"></div>
    <div class="bg-img" style="position:fixed;inset:0;background:${BG_CSS} center/cover;z-index:-2;filter:brightness(0.85);opacity:0;transition:opacity 0.8s ease-in;"></div>
    <div style="position:fixed;inset:0;background:rgba(15, 23, 42, 0.75);backdrop-filter:blur(10px);z-index:-1;"></div>
    <script>
      // 图片预加载完毕后执行淡入
      const img = new Image();
      img.src = "${RAW_IMG}";
      img.onload = () => { document.querySelector('.bg-img').style.opacity = 1; };
    </script>
  `;

  // 字体栈
  const FONT_STACK = `'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`;

  try {
    // API: 获取日志
    if (url.pathname === "/admin/api/logs") {
      const id = url.searchParams.get('id');
      const m = url.searchParams.get('m') || dateKey;
      if (!env.db) return new Response("{}", {status: 500});
      const { results } = await env.db.prepare("SELECT click_time FROM logs WHERE link_id = ? AND month_key = ? ORDER BY id DESC LIMIT 100").bind(id, m).all();
      return new Response(JSON.stringify(results || []), { headers: { "content-type": "application/json" } });
    }

    // 路由: 管理后台
    if (url.pathname === "/admin") {
      const cookie = request.headers.get('Cookie') || '';
      
      if (request.method === 'POST') {
        const formData = await request.formData();
        if (formData.get('password') === ADMIN_PASS) {
          return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=true; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict` } });
        }
      }

      if (!cookie.includes(`${COOKIE_NAME}=true`)) return new Response(renderLoginPageV8(TITLE, SHARED_BG_HTML, FONT_STACK, RAW_IMG), { headers: { "content-type": "text/html;charset=UTF-8" } });

      const selectedMonth = url.searchParams.get('m') || dateKey;
      const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
      return new Response(renderStatsHTMLV8(results || [], TITLE, selectedMonth, SHARED_BG_HTML, FONT_STACK, RAW_IMG), { headers: { "content-type": "text/html;charset=UTF-8" } });
    }

    // 登出
    if (url.pathname === "/admin/logout") return new Response(null, { status: 302, headers: { 'Location': '/admin', 'Set-Cookie': `${COOKIE_NAME}=; Path=/; Max-Age=0` } });

    // 跳转逻辑
    if (url.pathname.startsWith("/go/")) {
      const id = url.pathname.split("/")[2];
      const isBackup = url.pathname.split("/")[3] === "backup";
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        if (env.db) context.waitUntil(recordClick(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, dateKey, fullTimeStr));
        return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
      }
    }

    if (url.pathname.startsWith("/fgo/")) {
      const idx = parseInt(url.pathname.split("/")[2]);
      const friend = FRIENDS_DATA[idx];
      if (friend) {
        if (env.db) context.waitUntil(recordClick(env.db, `friend_${idx}`, friend.name, 'friend', currYear, dateKey, fullTimeStr));
        return Response.redirect(friend.url, 302);
      }
    }

    // 主页
    return new Response(renderMainHTMLV8(TITLE, SUBTITLE, SHARED_BG_HTML, CONTACT_URL, LINKS_DATA, FRIENDS_DATA, FONT_STACK, RAW_IMG), { headers: { "content-type": "text/html;charset=UTF-8" } });

  } catch (err) {
    return new Response(`🚨 System Error: ${err.message}`, { status: 500 });
  }
}

async function recordClick(db, id, name, type, y, m, timeStr) {
  try {
    await db.prepare("INSERT INTO logs (link_id, click_time, month_key) VALUES (?, ?, ?)").bind(id, timeStr, m).run();
    await db.prepare(`INSERT INTO stats (id, name, type, total_clicks, year_clicks, month_clicks, last_year, last_month, last_time) VALUES (?1, ?2, ?3, 1, 1, 1, ?4, ?5, ?6) ON CONFLICT(id) DO UPDATE SET total_clicks = total_clicks + 1, year_clicks = CASE WHEN last_year = ?4 THEN year_clicks + 1 ELSE 1 END, month_clicks = CASE WHEN last_month = ?5 THEN month_clicks + 1 ELSE 1 END, last_year = ?4, last_month = ?5, last_time = ?6, name = ?2`).bind(id, name, type, y, m, timeStr).run();
  } catch (e) { console.error("DB Error", e); }
}

/** --- 界面 V8: 极速预加载版 --- **/

// 通用 Head 注入：核心优化点
const getPreloadHead = (title, fs, rawImg) => `
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${title}</title>
  ${rawImg ? `<link rel="preload" as="image" href="${rawImg}">` : ''}
  <style>
    body { margin: 0; min-height: 100vh; font-family: ${fs}; color: #fff; display: flex; justify-content: center; align-items: center; }
  </style>
`;

function renderMainHTMLV8(T, S, BG_HTML, C, L, F, FS, RAW_IMG) {
  return `<!DOCTYPE html><html lang="zh-CN"><head>${getPreloadHead(T, FS, RAW_IMG)}<style>
    .container { width: 90%; max-width: 680px; padding: 40px 0; }
    header { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); padding: 40px; border-radius: 24px; text-align: center; margin-bottom: 30px; box-shadow: 0 20px 40px rgba(0,0,0,0.4); animation: fadeIn 0.6s ease-out; }
    h1 { font-size: 2.2rem; margin: 0; background: linear-gradient(to right, #fff, #bae6fd); -webkit-background-clip: text; -webkit-text-fill-color: transparent; font-weight: 900; letter-spacing: -0.02em; text-shadow: 0 2px 10px rgba(0,0,0,0.5); }
    .sub { color: #94a3b8; margin-top: 10px; font-weight: 500; font-size: 0.95rem; }
    .label { font-size: 0.8rem; color: #a78bfa; margin: 25px 0 12px 5px; font-weight: 800; letter-spacing: 0.1em; text-transform: uppercase; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; }
    .card { display: flex; height: 85px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.08); border-radius: 18px; overflow: hidden; transition: 0.3s; box-shadow: 0 4px 6px rgba(0,0,0,0.2); animation: slideUp 0.6s ease-out backwards; }
    .card:hover { transform: translateY(-3px); border-color: #38bdf8; background: rgba(30, 41, 59, 0.8); box-shadow: 0 10px 25px rgba(56, 189, 248, 0.2); }
    .link-main { flex: 1; display: flex; align-items: center; padding: 0 24px; text-decoration: none; color: #fff; }
    .emoji { font-size: 1.8rem; margin-right: 18px; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.3)); }
    .name { font-weight: 700; font-size: 1.1rem; text-shadow: 0 1px 3px rgba(0,0,0,0.8); }
    .note { font-size: 0.75rem; color: #fcd34d; margin-top: 4px; font-weight: 600; text-shadow: 0 1px 2px rgba(0,0,0,1); }
    .link-sub { width: 50px; display: flex; align-items: center; justify-content: center; background: rgba(0,0,0,0.2); border-left: 1px solid rgba(255,255,255,0.1); color: #cbd5e1; font-size: 0.75rem; writing-mode: vertical-lr; text-decoration: none; transition: 0.2s; }
    .link-sub:hover { background: #38bdf8; color: #000; }
    .f-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); gap: 12px; }
    .f-item { padding: 12px; background: rgba(30, 41, 59, 0.6); border: 1px solid rgba(255,255,255,0.1); border-radius: 12px; color: #e2e8f0; text-align: center; text-decoration: none; font-size: 0.9rem; transition: 0.2s; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
    .f-item:hover { background: #a78bfa; color: #fff; border-color: #a78bfa; }
    .btn { display: inline-block; margin-top: 40px; padding: 14px 40px; background: linear-gradient(135deg, #3b82f6, #8b5cf6); border-radius: 50px; color: #fff; text-decoration: none; font-weight: 700; box-shadow: 0 4px 15px rgba(59, 130, 246, 0.4); text-shadow: 0 1px 2px rgba(0,0,0,0.3); }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  </style></head><body>${BG_HTML}<div class="container"><header><h1>${T}</h1><div class="sub">${S}</div></header>
    <div class="label">精选资源</div><div class="grid">${L.map((l,i)=>`<div class="card" style="animation-delay:${i*0.05}s"><a href="/go/${l.id}" class="link-main"><span class="emoji">${l.emoji}</span><div><div class="name">${l.name}</div><div class="note">⚠️ ${l.note}</div></div></a>${l.backup_url?`<a href="/go/${l.id}/backup" class="link-sub">备用</a>`:''}</div>`).join('')}</div>
    ${F.length>0?`<div class="label">合作伙伴</div><div class="f-grid">${F.map((f,i)=>`<a href="/fgo/${i}" target="_blank" class="f-item">${f.name}</a>`).join('')}</div>`:''}
    <div style="text-align:center"><a href="${C}" target="_blank" class="btn">💬 获取支持</a></div></div></body></html>`;
}

function renderStatsHTMLV8(results, T, m, BG_HTML, FS, RAW_IMG) {
  const total = results.reduce((s, r) => s + (r.total_clicks || 0), 0);
  return `<!DOCTYPE html><html lang="zh-CN"><head>${getPreloadHead(T, FS, RAW_IMG)}<style>
    .main { flex: 1; padding: 40px 5%; max-width: 1200px; margin: 0 auto; }
    .head-row { display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 40px; padding-bottom: 20px; border-bottom: 1px solid rgba(255,255,255,0.1); animation: fadeIn 0.8s; }
    h1 { font-size: 2rem; margin: 0; font-weight: 800; color: #fff; text-shadow: 0 2px 4px rgba(0,0,0,0.5); }
    .badge { background: linear-gradient(135deg, #ec4899, #8b5cf6); padding: 15px 30px; border-radius: 16px; text-align: center; box-shadow: 0 10px 20px rgba(0,0,0,0.3); }
    .badge-val { font-size: 2.5rem; font-weight: 900; line-height: 1; }
    .filter-row { margin-bottom: 30px; display: flex; gap: 15px; align-items: center; }
    select { background: rgba(15, 23, 42, 0.8); color: #fff; border: 1px solid #475569; padding: 10px 15px; border-radius: 10px; cursor: pointer; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; }
    .card { background: rgba(30, 41, 59, 0.7); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(15px); border-radius: 20px; padding: 25px; transition: 0.2s; cursor: pointer; animation: slideUp 0.5s backwards; }
    .card:hover { background: rgba(30, 41, 59, 0.9); border-color: #a78bfa; transform: translateY(-2px); }
    .c-top { display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; font-weight: 700; }
    .c-title { font-size: 1.25rem; font-weight: 700; margin: 15px 0; color: #fff; text-shadow: 0 1px 2px rgba(0,0,0,0.8); }
    .c-data { display: flex; justify-content: space-between; margin-bottom: 15px; font-size: 0.9rem; }
    .highlight { color: #fcd34d; font-weight: 700; }
    .bar-bg { height: 6px; background: rgba(0,0,0,0.3); border-radius: 3px; overflow: hidden; }
    .bar-fill { height: 100%; background: #38bdf8; }
    .c-time { font-size: 0.75rem; color: #cbd5e1; margin-top: 15px; text-align: right; font-family: monospace; }
    .drawer { position: fixed; top: 0; right: -400px; width: 350px; height: 100vh; background: #0f172a; border-left: 1px solid #334155; box-shadow: -10px 0 30px rgba(0,0,0,0.5); transition: 0.3s cubic-bezier(0.4, 0, 0.2, 1); z-index: 100; padding: 30px; overflow-y: auto; display: flex; flex-direction: column; }
    .drawer.open { right: 0; }
    .drawer h3 { margin: 0 0 20px 0; font-size: 1.2rem; border-bottom: 1px solid #334155; padding-bottom: 15px; }
    .log-item { display: flex; justify-content: space-between; padding: 12px 0; border-bottom: 1px solid #1e293b; font-size: 0.85rem; color: #cbd5e1; }
    .log-time { font-family: monospace; color: #38bdf8; }
    .close-btn { position: absolute; top: 20px; right: 20px; cursor: pointer; font-size: 1.5rem; color: #64748b; }
    @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
    @keyframes slideUp { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
  </style></head><body>${BG_HTML}<div class="main">
    <div class="head-row"><div><h1>数据中心</h1><p>周期: ${m}</p></div><div class="badge"><span>总点击</span><div class="badge-val">${total}</div></div></div>
    <div class="filter-row"><select onchange="location.href='?m='+this.value"><option value="${m}">当前月份</option><option value="2025_12">2025_12</option></select><a href="/admin/logout" style="color:#ef4444;text-decoration:none;font-weight:700">退出登录</a></div>
    <div class="grid">${results.map((r,i)=>{ const p=total>0?((r.total_clicks/total)*100).toFixed(1):0; return `<div class="card" onclick="showLogs('${r.id}', '${m}', '${r.name||r.id}')" style="animation-delay:${i*0.03}s"><div class="c-top"><span>#${r.type.toUpperCase()}</span><span>${p}%</span></div><div class="c-title">${r.name||r.id}</div><div class="c-data"><span>本月: <b class="highlight">${r.month_clicks}</b></span><span>年度: <b>${r.year_clicks}</b></span></div><div class="bar-bg"><div class="bar-fill" style="width:${p}%"></div></div><div class="c-time">最后点击: ${r.last_time||'无记录'}</div><div style="font-size:0.7rem;color:#94a3b8;margin-top:5px;text-align:right">👉 查看详情</div></div>`}).join('')}</div></div>
    <div id="drawer" class="drawer"><div class="close-btn" onclick="closeDrawer()">×</div><h3 id="d-title">记录</h3><div id="d-list">加载中...</div></div><div id="mask" onclick="closeDrawer()" style="position:fixed;inset:0;background:rgba(0,0,0,0.5);z-index:90;display:none;backdrop-filter:blur(2px)"></div>
    <script>async function showLogs(id,m,n){document.getElementById('drawer').classList.add('open');document.getElementById('mask').style.display='block';document.getElementById('d-title').innerText=n;document.getElementById('d-list').innerHTML='<p>查询中...</p>';try{const r=await fetch(\`/admin/api/logs?id=\${id}&m=\${m}\`);const d=await r.json();document.getElementById('d-list').innerHTML=d.length?d.map((l,i)=>\`<div class="log-item"><span>#\${i+1}</span><span class="log-time">\${l.click_time}</span></div>\`).join(''):'<p>无详细记录</p>';}catch(e){document.getElementById('d-list').innerText='错误';}}function closeDrawer(){document.getElementById('drawer').classList.remove('open');document.getElementById('mask').style.display='none';}</script></body></html>`;
}

function renderLoginPageV8(T, BG_HTML, FS, RAW_IMG) {
  return `<!DOCTYPE html><html><head>${getPreloadHead(T, FS, RAW_IMG)}<style>
    .card { background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); padding: 40px; border-radius: 24px; text-align: center; width: 320px; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
    h1 { background: linear-gradient(to right, #7dd3fc, #c084fc); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 30px; font-weight: 900; }
    input { width: 100%; padding: 14px; background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.2); border-radius: 12px; color: #fff; margin-bottom: 20px; outline: none; }
    button { width: 100%; padding: 14px; background: #3b82f6; border: none; border-radius: 12px; color: #fff; font-weight: 700; cursor: pointer; transition: 0.2s; }
    button:hover { background: #2563eb; transform: scale(1.02); }
  </style></head><body>${BG_HTML}<div class="card"><h1>安全验证</h1><form method="POST"><input type="password" name="password" placeholder="密码..." required autofocus><button type="submit">进入后台</button></form></div></body></html>`;
}
