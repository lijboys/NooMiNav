export default {
  async fetch(request, env) {
    // 1. 从环境变量读取数据，如果没有则显示一个“配置中”的提示
    let LINKS_DATA = [];
    try {
      LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : [];
    } catch (e) {
      return new Response("环境变量 LINKS 格式错误", { status: 500 });
    }

    const TITLE = env.TITLE || "云端加速 · 精选导航";
    const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 极速稳定连接";
    const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";

    const url = new URL(request.url);

    // 2. 统计与重定向逻辑
    if (url.pathname.startsWith("/go/")) {
      const parts = url.pathname.split("/");
      const id = parts[2];
      const isBackup = parts[3] === "backup"; // 检测是否是备用链接
      
      const item = LINKS_DATA.find(l => l.id === id);
      if (item) {
        // 统计点击次数 (需要绑定名为 STATS 的 KV)
        if (env.STATS) {
          const key = isBackup ? `${id}_backup` : id;
          const count = await env.STATS.get(key) || 0;
          await env.STATS.put(key, parseInt(count) + 1);
        }
        return Response.redirect(isBackup ? item.backup_url : item.url, 302);
      }
    }

    // 3. 构造页面
    const html = `
    <!DOCTYPE html>
    <html lang="zh-CN">
    <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>${TITLE}</title>
        <style>
            :root { --primary: #8b5cf6; --bg: #030712; --card-bg: rgba(255, 255, 255, 0.03); --border: rgba(255, 255, 255, 0.08); }
            * { margin: 0; padding: 0; box-sizing: border-box; }
            body { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg); font-family: -apple-system, system-ui, sans-serif; color: white; overflow-x: hidden; }
            .bg-glow { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: radial-gradient(circle at 10% 10%, rgba(139,92,246,0.1) 0%, transparent 50%), radial-gradient(circle at 90% 90%, rgba(236,72,193,0.1) 0%, transparent 50%); z-index: -1; filter: blur(80px); }
            .container { width: 90%; max-width: 440px; padding: 40px 0; text-align: center; }
            header { margin-bottom: 40px; }
            header h1 { font-size: 2.2rem; background: linear-gradient(to right, #a78bfa, #f472b6); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 10px; font-weight: 800; }
            header p { color: #94a3b8; font-size: 0.95rem; }
            .card-list { display: grid; gap: 18px; }
            .card-wrapper { position: relative; display: flex; align-items: stretch; gap: 10px; }
            .item-link { flex: 1; display: flex; align-items: center; padding: 18px; background: var(--card-bg); backdrop-filter: blur(16px); -webkit-backdrop-filter: blur(16px); border: 1px solid var(--border); border-radius: 20px; text-decoration: none; color: white; transition: 0.3s; }
            .item-link:hover { border-color: var(--primary); transform: translateY(-3px); background: rgba(255,255,255,0.06); }
            .backup-link { display: flex; align-items: center; justify-content: center; width: 60px; background: rgba(255,255,255,0.05); border: 1px solid var(--border); border-radius: 18px; text-decoration: none; color: #94a3b8; font-size: 0.8rem; writing-mode: vertical-lr; transition: 0.3s; }
            .backup-link:hover { background: var(--primary); color: white; transform: translateY(-3px); }
            .emoji-box { width: 46px; height: 46px; background: rgba(255,255,255,0.05); border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; margin-right: 14px; }
            .info { text-align: left; }
            .name { font-weight: 600; font-size: 1.05rem; margin-bottom: 4px; }
            .note { font-size: 0.75rem; color: #fbbf24; background: rgba(251, 191, 36, 0.1); padding: 2px 8px; border-radius: 6px; display: inline-block; }
            .footer { margin-top: 50px; }
            .contact-btn { display: inline-flex; align-items: center; gap: 10px; background: linear-gradient(135deg, #6366f1 0%, #a855f7 100%); padding: 12px 28px; border-radius: 50px; color: white; text-decoration: none; font-size: 0.9rem; font-weight: 600; box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4); }
        </style>
    </head>
    <body>
        <div class="bg-glow"></div>
        <div class="container">
            <header>
                <h1>${TITLE}</h1>
                <p>${SUBTITLE}</p>
            </header>
            <div class="card-list">
                ${LINKS_DATA.map(link => `
                    <div class="card-wrapper">
                        <a href="/go/${link.id}" class="item-link">
                            <div class="emoji-box">${link.emoji}</div>
                            <div class="info">
                                <div class="name">${link.name}</div>
                                <div class="note">⚠️ ${link.note}</div>
                            </div>
                        </a>
                        ${link.backup_url ? `<a href="/go/${link.id}/backup" class="backup-link">备用</a>` : ''}
                    </div>
                `).join('')}
            </div>
            <div class="footer">
                <a href="${CONTACT_URL}" target="_blank" class="contact-btn">💬 联系我们</a>
            </div>
        </div>
    </body>
    </html>
    `;
    return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
  }
};
