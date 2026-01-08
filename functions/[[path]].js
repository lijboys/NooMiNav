export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  // --- 1. 基础配置读取 ---
  let LINKS_DATA = [];
  try { LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : []; } catch (e) {}
  let FRIENDS_DATA = [];
  try { FRIENDS_DATA = env.FRIENDS ? JSON.parse(env.FRIENDS) : []; } catch (e) {}

  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const ADMIN_PASS = env.admin; // 密码变量名
  const COOKIE_NAME = "nav_admin_auth";

  // 时间逻辑 (UTC+8)
  const now = new Date(new Date().getTime() + 8 * 3600000);
  const currYear = now.getFullYear().toString();
  const currMonth = `${currYear}_${(now.getMonth() + 1).toString().padStart(2, '0')}`;

  // --- 2. 管理员逻辑 (/admin) ---
  if (url.pathname === "/admin") {
    const cookie = request.headers.get('Cookie') || '';
    
    // 处理登录请求 (POST)
    if (request.method === 'POST') {
      const formData = await request.formData();
      const inputPass = formData.get('password');
      if (inputPass === ADMIN_PASS) {
        // 密码正确，设置 Cookie 并重定向
        return new Response(null, {
          status: 302,
          headers: {
            'Location': '/admin',
            'Set-Cookie': `${COOKIE_NAME}=true; Path=/; Max-Age=86400; HttpOnly; SameSite=Strict`
          }
        });
      }
    }

    // 检查是否有有效 Cookie
    if (!cookie.includes(`${COOKIE_NAME}=true`)) {
      // 没有权限，返回自定义的“访问验证”网页
      return new Response(renderLoginPage(TITLE), { 
        headers: { "content-type": "text/html;charset=UTF-8" } 
      });
    }

    // 已验证，显示 D1 统计后台
    if (!env.db) return new Response("错误：未绑定 D1 数据库 (变量名 db)");
    const { results } = await env.db.prepare("SELECT * FROM stats ORDER BY total_clicks DESC").all();
    return new Response(renderStatsHTML(results, TITLE, currYear, now.getMonth() + 1), { 
      headers: { "content-type": "text/html;charset=UTF-8" } 
    });
  }

  // --- 3. 跳转逻辑 (记录统计) ---
  // A. 套餐跳转
  if (url.pathname.startsWith("/go/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[1];
    const isBackup = parts[2] === "backup";
    const item = LINKS_DATA.find(l => l.id === id);
    if (item) {
      await updateStats(env.db, isBackup ? `${id}_backup` : id, item.name + (isBackup ? "(备用)" : ""), 'link', currYear, currMonth);
      return Response.redirect(isBackup ? item.backup_url : item.url, 302);
    }
  }
  // B. 友链跳转
  if (url.pathname.startsWith("/fgo/")) {
    const index = parseInt(url.pathname.split("/")[2]);
    const friend = FRIENDS_DATA[index];
    if (friend) {
      await updateStats(env.db, `friend_${index}`, friend.name, 'friend', currYear, currMonth);
      return Response.redirect(friend.url, 302);
    }
  }

  // --- 4. 默认返回主页 ---
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';
  const SUBTITLE = env.SUBTITLE || "优质套餐推荐";
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
  return new Response(renderMainHTML(TITLE, SUBTITLE, BG_IMG, CONTACT_URL, LINKS_DATA, FRIENDS_DATA), { 
    headers: { "content-type": "text/html;charset=UTF-8" } 
  });
}

// --- 网页版登录界面模板 ---
function renderLoginPage(title) {
  return `
  <!DOCTYPE html>
  <html lang="zh-CN">
  <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>访问验证 - ${title}</title>
      <style>
          body { background: #030712; color: white; font-family: sans-serif; display: flex; align-items: center; justify-content: center; height: 100vh; margin: 0; }
          .auth-card { background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.1); backdrop-filter: blur(20px); padding: 40px; border-radius: 24px; width: 90%; max-width: 360px; text-align: center; box-shadow: 0 20px 50px rgba(0,0,0,0.5); }
          h1 { font-size: 1.8rem; background: linear-gradient(to right, #a78bfa, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; }
          p { color: #94a3b8; font-size: 0.9rem; margin-bottom: 30px; }
          input { width: 100%; padding: 14px; border-radius: 12px; border: 1px solid rgba(255,255,255,0.2); background: rgba(0,0,0,0.2); color: white; font-size: 1rem; margin-bottom: 20px; box-sizing: border-box; outline: none; transition: 0.3s; }
          input:focus { border-color: #8b5cf6; box-shadow: 0 0 0 2px rgba(139,92,246,0.3); }
          button { width: 100%; padding: 14px; border-radius: 12px; border: none; background: linear-gradient(135deg, #6366f1, #a855f7); color: white; font-weight: bold; font-size: 1rem; cursor: pointer; transition: 0.3s; }
          button:hover { transform: scale(1.02); filter: brightness(1.1); }
      </style>
  </head>
  <body>
      <div class="auth-card">
          <h1>访问验证</h1>
          <p>请输入后台密码继续访问</p>
          <form method="POST">
              <input type="password" name="password" placeholder="密码..." required autofocus>
              <button type="submit">提交</button>
          </form>
      </div>
  </body>
  </html>`;
}

// --- 统计页和主页渲染逻辑 (保持之前的 D1 仪表盘设计) ---
function renderStatsHTML(...) { ... }
function renderMainHTML(...) { ... }
async function updateStats(...) { ... }
