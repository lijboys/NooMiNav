export async function onRequest(context) {
  const { request, env } = context;
  const url = new URL(request.url);

  let LINKS_DATA = [];
  try {
    LINKS_DATA = env.LINKS ? JSON.parse(env.LINKS) : [];
  } catch (e) {
    return new Response("LINKS 格式错误", { status: 500 });
  }

  const TITLE = env.TITLE || "云端加速 · 精选导航";
  const SUBTITLE = env.SUBTITLE || "优质套餐推荐 · 随时畅联";
  const CONTACT_URL = env.CONTACT_URL || "https://t.me/Fuzzy_Fbot";
  const BG_IMG = env.img ? `url('${env.img}')` : 'none';

  if (url.pathname.startsWith("/go/")) {
    const parts = url.pathname.split("/").filter(Boolean);
    const id = parts[1];
    const isBackup = parts[2] === "backup";
    const item = LINKS_DATA.find(l => l.id === id);
    if (item) {
      if (env.kv) {
        const statsKey = isBackup ? `click_${id}_backup` : `click_${id}`;
        const count = await env.kv.get(statsKey) || 0;
        await env.kv.put(statsKey, (parseInt(count) + 1).toString());
      }
      return Response.redirect(isBackup && item.backup_url ? item.backup_url : item.url, 302);
    }
  }

  if (url.pathname === "/stats" && env.kv) {
    let statsHtml = `<html><head><meta charset="UTF-8"><title>统计</title></head><body style="background:#030712;color:#fff;padding:40px;"><h1>📊 点击统计</h1><ul>`;
    for (const item of LINKS_DATA) {
        const c = await env.kv.get(`click_${item.id}`) || 0;
        statsHtml += `<li>${item.name}: ${c} 次</li>`;
    }
    return new Response(statsHtml + "</ul></body></html>", { headers: { "content-type": "text/html;charset=UTF-8" } });
  }

  // HTML 内容与上面的 Worker 版一致
  const html = `... (此处粘贴上面代码中 html 变量内的全部内容) ...`;

  return new Response(html, { headers: { "content-type": "text/html;charset=UTF-8" } });
}
