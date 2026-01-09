这是一份为你量身定制的 **README.md** 文档。它完全基于你目前 **V8.0 极速加载版** 的代码逻辑编写，包含了从部署、数据库配置到变量设置的所有细节。

你可以直接复制下面的内容，保存为 GitHub 仓库根目录下的 `README.md`。

---

# 🚀 FlareNav - 极简高性能云端导航站

基于 **Cloudflare Pages + D1 数据库** 构建的现代化个人导航站。
拥有极致的毛玻璃 UI 设计、毫秒级点击统计、详细到秒的访问日志，以及完全无服务器（Serverless）的低成本部署体验。

## ✨ 核心特性

* **⚡ 极速体验**：基于 Edge Network 运行，集成图片 Preload 预加载技术，秒开无白屏。
* **💎 极致 UI**：全站自适应高级毛玻璃（Glassmorphism）设计，动态光影交互，完美适配桌面与移动端。
* **📊 数据看板**：内置 `/admin` 管理后台，支持查看全站总点击、月度点击、单个链接点击占比。
* **📝 详细日志**：**独家功能**，支持点击卡片侧滑查看每一次点击的精确时间（精确到秒）。
* **☁️ 零成本**：使用 Cloudflare Pages 免费版托管，搭配 D1 免费额度数据库，无需购买服务器。
* **🔗 便捷配置**：通过环境变量管理链接数据（JSON 格式），修改配置无需改动代码。

---

## 🛠️ 部署指南

### 第一步：准备工作

1. Fork 本仓库到你的 GitHub 账号。
2. 确保仓库根目录**只包含** `functions/` 文件夹和 `README.md`，**切勿**添加 `worker.js` 或 `wrangler.toml` 文件（否则会导致 Pages 识别错误）。

### 第二步：创建 Cloudflare Pages 项目

1. 登录 Cloudflare Dashboard，进入 **Workers & Pages** -> **Create Application** -> **Pages** -> **Connect to Git**。
2. 选择你 Fork 的仓库。
3. **关键构建设置 (Build settings)**：
* **Framework preset**: `None` (无)
* **Build command**: `(留空)`
* **Build output directory**: `.` (填一个英文句点)



### 第三步：配置 D1 数据库

1. 在 Cloudflare 左侧菜单选择 **D1**，创建一个新数据库（例如命名为 `nav_db`）。
2. 进入数据库详情页，点击 **Console** 标签。
3. **依次执行**以下两条 SQL 语句以初始化表结构：
**1. 创建统计表 (Stats):**
```sql
CREATE TABLE IF NOT EXISTS stats (
    id TEXT PRIMARY KEY,
    name TEXT,
    type TEXT,
    total_clicks INTEGER DEFAULT 0,
    year_clicks INTEGER DEFAULT 0,
    month_clicks INTEGER DEFAULT 0,
    last_year TEXT,
    last_month TEXT,
    last_time TEXT
);

```


**2. 创建日志表 (Logs):**
```sql
CREATE TABLE IF NOT EXISTS logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    link_id TEXT,
    click_time TEXT,
    month_key TEXT
);

```


4. 回到 Pages 项目 -> **Settings** -> **Functions** -> **D1 database bindings**。
* 变量名称 (Variable name): **`db`** (必须是小写)
* D1 database: 选择你刚才创建的数据库。
* **注意**：Production 和 Preview 环境都需要绑定。



### 第四步：设置环境变量

进入 Pages 项目 -> **Settings** -> **Environment variables**，添加以下变量：

| 变量名 | 必填 | 说明 | 示例值 |
| --- | --- | --- | --- |
| `LINKS` | ✅ | 核心导航数据 (JSON 格式，见下文) | `[{"id":"google","name":"谷歌",...}]` |
| `FRIENDS` | ❌ | 友情链接数据 (JSON 格式) | `[{"name":"友链1","url":"..."}]` |
| `admin` | ✅ | 后台管理密码 | `yourpassword123` |
| `TITLE` | ❌ | 网站主标题 | `我的导航站` |
| `SUBTITLE` | ❌ | 网站副标题 | `发现好资源` |
| `img` | ❌ | 背景图片直链 (支持 Preload 加速) | `https://example.com/bg.jpg` |
| `CONTACT_URL` | ❌ | 底部联系按钮跳转地址 | `https://t.me/yourname` |

---

## 📋 JSON 配置示例

### `LINKS` (核心套餐/链接)

将此 JSON 压缩为一行后填入环境变量。

```json
[
  {
    "id": "item1",
    "name": "超值套餐",
    "emoji": "🔥",
    "note": "不仅快还稳定",
    "url": "https://real-link.com",
    "backup_url": "https://backup-link.com"
  },
  {
    "id": "item2",
    "name": "备用节点",
    "emoji": "🚀",
    "note": "临时使用",
    "url": "https://another-link.com"
  }
]

```

### `FRIENDS` (友情链接)

```json
[
  { "name": "Google", "url": "https://google.com" },
  { "name": "GitHub", "url": "https://github.com" }
]

```

---

## ⚙️ 管理与使用

### 访问管理后台

访问 `https://你的域名/admin`，输入环境变量中设置的 `admin` 密码即可登录。

### 功能说明

1. **数据概览**：查看全站总点击、本月点击排行。
2. **详细日志**：点击任意卡片，右侧会滑出该链接的详细访问记录（精确到秒）。
3. **最后活跃**：卡片右下角实时显示最后一次点击的时间。

### 如何更新背景图片？

由于项目开启了**极速预加载**，浏览器缓存较强。建议使用以下方式更新：

1. 准备新的图片 URL。
2. 修改环境变量 `img` 为新地址。
3. 在 Deployments 页面点击 **Retry deployment**。
* *Tip: 如果图片地址不变（覆盖了原图），请在 URL 后面加参数，例如 `bg.jpg?v=2` 以强制刷新用户缓存。*


---

## 📂 项目结构

```text
├── functions/
│   └── [[path]].js      # Pages 核心逻辑 (接管所有路由)
├── index.html           # 静态入口 (占位文件)
├── worker.js            # Worker 版本完整代码
├── README.md            # 项目说明
└── LICENSE              # MIT 协议

```

## 📄 开源协议

本项目基于 [MIT License](https://www.google.com/search?q=LICENSE) 协议。

---

## 🤝 贡献与支持

如果你觉得这个项目对你有帮助，欢迎点一个 Star ⭐️！

