/**
 * HONGUI 个人网站 — Cloudflare Workers 单文件 ES Module
 *
 * 必须绑定（变量名不可更改）：
 *   R2 存储桶绑定：first
 *     - 博客图片前缀 blog/（jpg、png、webp、gif，不存视频）
 *     - 网盘文件前缀 drive/
 *     - 站点音乐前缀 music/（mp3、m4a、ogg、wav，≤15MB）
 *   KV 命名空间绑定：one
 *     - 文章正文与索引、阅读量、点赞、关于、价值观、AI 设置、站点音乐、访问统计
 *   环境变量 / Secret（请用加密 Secret 设置）：
 *     ADMIN_USER       管理员账号
 *     ADMIN_SECRET     管理员密码
 *     SESSION_SECRET   会话 HMAC 密钥（至少 16 位随机字符）
 *   AI 密钥（只用加密 Worker Secret，永不写入 KV、永不返回前端）：
 *     AI_KEY_GENERAL   通用档     stepfun-ai/step-5-preview（integrate.api.nvidia.com，支持图片）
 *     AI_KEY_IMAGE     画图档     black-forest-labs/flux-3-image-klein（ai.api.nvidia.com/v1/genai）
 *   模型名、API 地址、温度、top_p、max_tokens、步数等可在后台 /admin?tab=ai 修改，保存在 KV。
 *
 * 免费层约定：首页只读文章索引；阅读量与访问量经 Cache API 去重并按约 10 分钟合并写入 KV；
 * 点赞用 Cache API 按 IP+文章去重；网盘只走 R2，不写 KV；测速响应 no-store 且限制单次流量。
 */

const CATEGORIES = ["鄞州高中随想", "公路骑行日记", "乒乓球手记", "极客技术折腾"];
const SITE_NAME = "项宏";

const INITIAL_ARTICLES = [
  {
    id: "yinzhou-highschool-reflection",
    title: "在鄞州高中的晨曦与自省：于理性求索中感知生活",
    category: "鄞州高中随想",
    publishedAt: "2026-08-20T13:30:00.000Z",
    summary: "在忙碌的高中节奏中，保持对物理科学的探索欲望与对内心秩序的坚守，记录青春求学路上的沉淀与感悟。",
    content: "## 晨光下的鄞州校园\n\n高中生活有着独特的节奏与张力。每天清晨走进教室，晨光穿过树梢洒在课桌上，那是思考与探索的起点。\n\n> 理性不是冰冷的公式，而是看清世界复杂性后依然葆有的热忱与笃定。\n\n### 物理与技术的魅力\n\n探索科学规律的过程，就像是在混沌中寻找秩序。无论是力学模型的建立，还是逻辑电路的设计，每一行推演都在锻炼我们严谨的思维习惯。\n\n保持专注，保持对知识的敬畏，踏实走好脚下的每一步。"
  },
  {
    id: "cycling-ningbo-coastline",
    title: "破风前行：宁波沿海与东钱湖的公路骑行手记",
    category: "公路骑行日记",
    publishedAt: "2026-08-15T10:45:00.000Z",
    summary: "车轮丈量大地，迎着微风穿梭在东钱湖畔与沿海公路，在均匀的心率与踏频中体验纯粹的专注与速度。",
    content: "## 踏频与心跳的共鸣\n\n公路骑行不仅是一项运动，更是一场与自我的深度对话。当踏频稳定在 90 RPM，呼吸与风声同频共振，周围的喧嚣便自然消退。\n\n### 装备与路线记录\n\n- **推荐路线**：东钱湖环湖绿道 ➔ 沿海景观线\n- **核心体验**：平路巡航、爬坡耐力训练、下坡风阻控制\n\n在长距离骑行中，体能的分配与节奏的掌控至关重要。每一次冲过坡顶，眼前的开阔视野都是对坚持最好的回馈。"
  },
  {
    id: "table-tennis-tactics",
    title: "方寸球台间的攻防哲学：乒乓球技术与心理博弈",
    category: "乒乓球手记",
    publishedAt: "2026-08-10T08:20:00.000Z",
    summary: "弧圈球的旋转、落点的刁钻、发抢的果决，在方寸之间体会反应速度与策略博弈的极客乐趣。",
    content: "## 旋转与速度的掌控\n\n乒乓球的魅力在于极短反应时间内的决策精度。从发球的旋转变化，到第三板的果断上手，每一个回合都是智力与身体协调性的较量。\n\n```text\n发球抢攻战术模型：\n侧上/侧下旋发球 ➔ 预判接发落点 ➔ 正手暴冲 / 快速快撕 ➔ 连续压制\n```\n\n保持冷静的心态与灵活的步伐转换，是赢下关键分的基石。"
  },
  {
    id: "cloudflare-workers-fullstack-geek",
    title: "探索 Edge Computing：用 Cloudflare 打造极简全栈架构",
    category: "极客技术折腾",
    publishedAt: "2026-08-01T02:15:00.000Z",
    summary: "利用 Cloudflare Workers 边缘计算、KV 分布式键值存储与 R2 对象存储，构建毫秒级响应的高性能单文件博客空间。",
    content: "## 为什么选择边缘计算架构？\n\n传统的服务器托管模式往往受制于机房地域与网络延迟，而 Cloudflare 的边缘网络让代码直接在离用户最近的节点运行。\n\n### 架构核心亮点\n\n1. **全栈单文件部署**：HTML、CSS、API 与路由合为一体，无需繁重的构建流水线。\n2. **R2 零出口费用存储**：无缝承载图片与静态资产。\n3. **KV 高速缓存**：全球低延迟分发文章元数据。\n\n技术探索永无止境，极简与高效始终是架构设计的追求。"
  }
];

let SEED_LOCK = null;
async function ensureSeeded(env) {
  if (!env || !env.one) return;
  /* never share a promise across requests: Workers cannot resolve I/O started by another request, which hangs the waiter */
  if (SEED_LOCK === true) return;
  await (async () => {
    try {
      const idx = await getIndex(env);
      if (idx.length) { SEED_LOCK = true; return; }
      const now = new Date().toISOString();
      const meta = [];
      for (const item of INITIAL_ARTICLES) {
        const post = {
          id: item.id,
          title: item.title,
          category: item.category,
          summary: item.summary,
          content: item.content,
          cover: "blog/covers/" + item.id + "-1600.webp",
          status: "published",
          publishedAt: item.publishedAt,
          updatedAt: now,
          views: 128,
          likes: 32
        };
        await kvStore(env).put("post:" + item.id, JSON.stringify(post));
        meta.push(indexItem(post));
      }
      await kvStore(env).put("idx", JSON.stringify(meta));
      SEED_LOCK = true;
    } catch (e) {
      console.error("seed failed", e);
    }
  })();
}
const MAX_DRIVE = 2 * 1024 * 1024 * 1024;
const PART_SIZE = 10 * 1024 * 1024;
const SIMPLE_UPLOAD = 95 * 1024 * 1024;
const R2_FREE = 10 * 1024 * 1024 * 1024;
const R2_WARN = 8 * 1024 * 1024 * 1024;
const IMAGE_MAX = 5 * 1024 * 1024;
const MUSIC_MAX = 15 * 1024 * 1024;

const CLOUD_ASNS = {
  7224: "Amazon AWS", 10124: "Amazon AWS", 14618: "Amazon AWS", 16509: "Amazon AWS", 38895: "Amazon AWS",
  15169: "Google", 19527: "Google", 36040: "Google", 396982: "Google Cloud",
  8068: "Microsoft", 8069: "Microsoft", 8075: "Microsoft Azure",
  13335: "Cloudflare", 209242: "Cloudflare",
  14061: "DigitalOcean", 62567: "DigitalOcean", 20473: "Vultr", 63949: "Akamai / Linode",
  16276: "OVH", 35540: "OVH", 209847: "OVHcloud", 24940: "Hetzner", 213230: "Hetzner",
  45102: "Alibaba Cloud", 37963: "Alibaba Cloud", 134963: "Alibaba Cloud",
  45090: "Tencent Cloud", 132203: "Tencent Cloud", 132591: "Tencent Cloud",
  55990: "Huawei Cloud", 55967: "Huawei Cloud", 136907: "Huawei Cloud",
  31898: "Oracle Cloud", 62785: "Oracle Cloud",
  9009: "M247", 60068: "CDN77 / Datacamp", 212238: "Datacamp",
  30633: "Leaseweb", 28753: "Leaseweb", 16265: "Leaseweb",
  51167: "Contabo", 40021: "Contabo", 12876: "Scaleway", 16262: "Scaleway / Online",
  58065: "Equinix Metal", 54825: "Equinix Metal", 21859: "Zenlayer",
  36352: "ColoCrossing", 53667: "FranTech", 19318: "InterServer", 32475: "SingleHop",
  62240: "Clouvider", 206092: "Clouvider", 49981: "WorldStream",
  58519: "China Telecom Cloud", 58520: "China Telecom Cloud", 23724: "China Telecom IDC",
  134420: "UCloud", 59077: "Kaopu Cloud", 132883: "Wangsu",
  26496: "GoDaddy", 398101: "GoDaddy", 46606: "Unified Layer", 55293: "A2 Hosting",
  20454: "Secured Servers", 29802: "Hivelocity", 32097: "Wholesale Internet",
  54540: "Incero", 55286: "ServerMania", 57169: "EDIS", 29066: "Velia.net",
  201106: "Spartan Host", 202448: "MyLoc", 58212: "dataforest", 60404: "Liteserver"
};

const DEFAULT_VALUES = [
  { title: "自然而立", text: "保持自然、健康的性别气质。男生可以有担当，也可以有力量；女生可以独立，也可以继续成长。不必为了追随时尚，去否定自己本来的样子。" },
  { title: "超然自见", text: "以更开阔的眼光看世界。见山见水时，也能从一时的局限里走出来。少为别人的目光和自己的苛责反复消耗，看清别人真实的样子，也坦然接受别人眼中那个真实的自己。" },
  { title: "少做内耗", text: "尽量不把力气耗在内耗上。把精力留给自己能够把握的事情，不被无谓的评价和一阵一阵的情绪牵着走。" },
  { title: "真诚有界", text: "以真诚待人。受人滴水之恩，当以涌泉相报。不主动招惹是非；若被冒犯，也守住自己的底线。" },
  { title: "方向不偏", text: "守住自己的价值观。朋友不在多，方向不能偏，宁缺毋滥。" },
  { title: "心向阳光", text: "世界并非只有阴影。选择朝有光的地方走，不让自己滑向阴暗。" }
];

const DEFAULT_ABOUT = "项宏，浙江省宁波市鄞州区的高中生，一名喜欢动手的开发者。\n\n平日喜欢公路骑行和乒乓球，也热衷于把想法做成可以运行的东西。这个网站由我独立设计，博客、网盘、AI 对话和网络测速跑在同一份 Cloudflare Worker 上。\n\n**联系**\n\n- Telegram：[@your_telegram](https://t.me/your_telegram)\n- 微信：your_wechat";

const DEFAULT_MODES = {
  general: "你是项宏个人网站里的助手。回答清晰、准确、友善，默认使用简体中文，除非用户使用其他语言。不确定时直接说明，不要编造。",
  polish: "你是中文写作编辑。请在保留原意的前提下润色文字，使表达自然、得体、有层次。先给出改写结果，再用简短条目说明主要改动。",
  code: "你是务实的编程助手。给出能运行的代码、必要解释和边界情况。不要编造不存在的 API；如果信息不足，先说明假设。",
  translate: "你是翻译。自动判断语言方向，以中英为主，翻译准确、自然，保留专有名词。只输出译文，除非用户要求解释。",
  study: "你是耐心的学习辅导员。面对高中生讲解概念时由浅入深，先给直觉，再给步骤，鼓励思考，而不是只抛结论。"
};
const DEFAULT_SYSTEM_PROMPT = "你服务于项宏的个人网站。回答对高中生也清楚易懂，语气稳重，不夸张。对合法且仅轻微敏感的话题请继续有帮助地回答，不要突然拒绝、删除或撤回已给出的回答；不要在答完后又说「我必须撤回」。始终遵守法律：不协助儿童性剥削、武器滥用等违法请求。若必须拒绝，请简短说明原因并提供安全的替代方向。";
const HARD_AI_FALLBACK = "保持有帮助；对合法且轻微敏感的话题不要突然拒绝或中途撤回已答内容，不要说「我必须撤回」。严禁儿童性剥削、武器制造滥用等违法协助。若必须拒绝，简短说明并给出安全替代。";

const AI_TIERS = ["general", "image"];
const AI_CHAT_TIERS = ["general"];
const AI_TIER_LABEL = { general: "通用", image: "画图" };
const AI_TIER_DESC = {
  general: "日常问答、写作与看图，响应快",
  image: "根据文字描述生成图片"
};
const AI_TIER_SECRET = { general: "AI_KEY_GENERAL", image: "AI_KEY_IMAGE" };
const AI_DEFAULT_BASE = "https://integrate.api.nvidia.com/v1";
const AI_IMAGE_BASE = "https://ai.api.nvidia.com/v1/genai";
const AI_IMAGE_SIZES = { "1:1": [1024, 1024], "16:9": [1344, 768], "9:16": [768, 1344] };
const AI_MODES = ["general", "polish", "code", "translate", "study"];

function defaultTier(id) {
  if (id === "image") return { kind: "image", baseUrl: AI_IMAGE_BASE, model: "black-forest-labs/flux-3-image-klein", stream: false, supportsImages: false, temperature: 0, topP: 0, maxTokens: 0, thinking: false, steps: 50 };
  const base = { kind: "chat", baseUrl: AI_DEFAULT_BASE, stream: true, supportsImages: true, steps: 0 };
  return Object.assign(base, { model: "stepfun-ai/step-5-preview", temperature: 0.5, topP: 1, maxTokens: 4096, thinking: false });
}

function defaultAi() {
  const tiers = {};
  for (const id of AI_TIERS) tiers[id] = defaultTier(id);
  return {
    tiers,
    defaultTier: "general",
    guestTier: "general",
    adminTier: "general",
    allowGuest: true,
    guestImages: true,
    guestDailyLimit: 20,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
    modePrompts: Object.assign({}, DEFAULT_MODES)
  };
}

function escapeHtml(s) {
  return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function safeUrl(u) {
  let s = String(u || "").trim().replace(/[\u0000-\u001f\s]/g, "");
  if (s.startsWith("//")) return "";
  if (s.startsWith("/image/") || s.startsWith("/api/drive/file")) {
    if (s.includes("..") || s.includes("\\")) return "";
    return s;
  }
  if (/^https?:\/\//i.test(s)) return s;
  return "";
}

function inlineMd(text) {
  const src = String(text || "");
  const re = /(`[^`\n]+`)|(\*\*([^*]+)\*\*)|(\*([^*\n]+)\*)|(~~([^~]+)~~)|(!\[([^\]]*)\]\(([^)\s]+)\))|(\[([^\]]+)\]\(([^)\s]+)\))/g;
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    out += escapeHtml(src.slice(last, m.index));
    if (m[1]) out += "<code>" + escapeHtml(m[1].slice(1, -1)) + "</code>";
    else if (m[2]) out += "<strong>" + inlineMd(m[3]) + "</strong>";
    else if (m[4]) out += "<em>" + inlineMd(m[5]) + "</em>";
    else if (m[6]) out += "<del>" + inlineMd(m[7]) + "</del>";
    else if (m[8]) {
      const iu = safeUrl(m[10]);
      if (iu) out += '<img src="' + escapeHtml(iu) + '" alt="' + escapeHtml(m[9]) + '" loading="lazy">';
      else out += escapeHtml(m[8]);
    } else if (m[11]) {
      const hu = safeUrl(m[13]);
      if (hu) {
        const ext = /^https?:/i.test(hu);
        out += '<a href="' + escapeHtml(hu) + '"' + (ext ? ' target="_blank" rel="noopener noreferrer"' : "") + ">" + inlineMd(m[12]) + "</a>";
      } else out += escapeHtml(m[11]);
    }
    last = m.index + m[0].length;
  }
  out += escapeHtml(src.slice(last));
  return out;
}

function renderMath(tex, display) {
  let t = escapeHtml(String(tex || "").trim());
  const map = [
    ["\\times", "×"], ["\\cdot", "·"], ["\\leq", "≤"], ["\\geq", "≥"], ["\\neq", "≠"],
    ["\\approx", "≈"], ["\\pm", "±"], ["\\infty", "∞"], ["\\alpha", "α"], ["\\beta", "β"],
    ["\\gamma", "γ"], ["\\pi", "π"], ["\\theta", "θ"], ["\\lambda", "λ"], ["\\rightarrow", "→"],
    ["\\leftarrow", "←"], ["\\to", "→"]
  ];
  for (const [k, v] of map) t = t.split(k).join(v);
  t = t.replace(/\\frac\{([^{}]+)\}\{([^{}]+)\}/g, '<span class="frac"><span class="fn">$1</span><span class="fd">$2</span></span>');
  t = t.replace(/\^\{([^{}]+)\}/g, "<sup>$1</sup>").replace(/_\{([^{}]+)\}/g, "<sub>$1</sub>");
  t = t.replace(/\^([A-Za-z0-9])/g, "<sup>$1</sup>").replace(/_([A-Za-z0-9])/g, "<sub>$1</sub>");
  return '<span class="math' + (display ? " block" : "") + '">' + t + "</span>";
}

function highlightCode(code, lang) {
  const src = String(code || "").replace(/\n$/, "");
  const table = {
    js: "const|let|var|function|return|if|else|for|while|class|new|await|async|try|catch|throw|import|export|from|of|in|break|continue|true|false|null|undefined",
    ts: "const|let|var|function|return|if|else|interface|type|class|new|await|async|import|export|from|true|false|null|undefined",
    py: "def|return|if|elif|else|for|while|class|import|from|as|try|except|with|yield|lambda|pass|None|True|False|in|not|and|or",
    css: "color|background|display|flex|grid|margin|padding|font|border|width|height|position",
    html: "html|head|body|div|span|script|style|link|meta|img|a",
    sh: "echo|cd|ls|sudo|export|if|then|fi|for|in|do|done"
  };
  table.javascript = table.js;
  table.typescript = table.ts;
  table.python = table.py;
  table.bash = table.sh;
  const key = String(lang || "").toLowerCase();
  const words = table[key] || "";
  const hash = key === "py" || key === "python" || key === "bash" || key === "sh" || key === "yaml" || key === "yml";
  const CM = hash ? /#[^\n]*/.source : /\/\/[^\n]*|\/\*[\s\S]*?\*\//.source;
  const STR = /"(?:\\.|[^"\\\n])*"|'(?:\\.|[^'\\\n])*'|`(?:\\.|[^`\\])*`/.source;
  const re = new RegExp("(" + CM + ")|(" + STR + ")|\\b(" + (words || "(?!)") + ")\\b|\\b(\\d+(?:\\.\\d+)?)\\b", "g");
  let out = "";
  let last = 0;
  let m;
  while ((m = re.exec(src))) {
    if (!m[0]) { re.lastIndex++; continue; }
    out += escapeHtml(src.slice(last, m.index));
    const cls = m[1] != null ? "cm" : m[2] != null ? "str" : m[3] != null ? "kw" : "num";
    out += '<span class="' + cls + '">' + escapeHtml(m[0]) + "</span>";
    last = m.index + m[0].length;
  }
  out += escapeHtml(src.slice(last));
  const label = escapeHtml(lang || "text");
  return '<div class="codewrap"><div class="codebar"><span>' + label + '</span><button type="button" class="mini" data-copy="1">复制</button></div><pre class="code"><code>' + out + "</code></pre></div>";
}

function renderMarkdown(src) {
  const raw = String(src || "").replace(/\r\n/g, "\n");
  const re = /```([^\n`]*)\n([\s\S]*?)```/g;
  const parts = [];
  let last = 0;
  let m;
  while ((m = re.exec(raw))) {
    parts.push(renderMdBlocks(raw.slice(last, m.index)));
    parts.push(highlightCode(m[2], (m[1] || "").trim().split(/\s+/)[0] || ""));
    last = m.index + m[0].length;
  }
  parts.push(renderMdBlocks(raw.slice(last)));
  return parts.join("\n");
}

function renderMdBlocks(raw) {
  const maths = [];
  const text = String(raw || "").replace(/\$\$([\s\S]+?)\$\$|\$(?=\S)([^$\n]*?\S)\$(?!\d)/g, (_, block, inline) => {
    maths.push({ display: block != null, tex: block != null ? block : inline });
    return "\u0000M" + (maths.length - 1) + "\u0000";
  });
  const lines = text.split("\n");
  const html = [];
  let i = 0;
  const isHr = (line) => /^\s*(-{3,}|\*{3,}|_{3,})\s*$/.test(line);
  const isHeading = (line) => /^(#{1,6})\s+/.test(line);
  const isQuote = (line) => /^>\s?/.test(line);
  const isUl = (line) => /^\s*[-*+]\s+/.test(line);
  const isOl = (line) => /^\s*\d+\.\s+/.test(line);
  const isSep = (line) => /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(line);
  const splitRow = (line) => {
    let s = line.trim();
    if (s.startsWith("|")) s = s.slice(1);
    if (s.endsWith("|")) s = s.slice(0, -1);
    return s.split("|").map((c) => c.trim());
  };
  while (i < lines.length) {
    const line = lines[i];
    if (!line.trim()) { i++; continue; }
    if (isHr(line)) { html.push("<hr>"); i++; continue; }
    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      const level = h[1].length;
      html.push("<h" + level + ">" + inlineMd(h[2]) + "</h" + level + ">");
      i++;
      continue;
    }
    if (isQuote(line)) {
      const qs = [];
      while (i < lines.length && isQuote(lines[i])) {
        qs.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      html.push("<blockquote>" + qs.map((t) => "<p>" + inlineMd(t) + "</p>").join("") + "</blockquote>");
      continue;
    }
    if (line.includes("|") && i + 1 < lines.length && isSep(lines[i + 1])) {
      const head = splitRow(line);
      i += 2;
      const body = [];
      while (i < lines.length && lines[i].includes("|") && lines[i].trim()) {
        body.push(splitRow(lines[i]));
        i++;
      }
      html.push("<div class=\"tablewrap\"><table><thead><tr>" + head.map((c) => "<th>" + inlineMd(c) + "</th>").join("") + "</tr></thead><tbody>" +
        body.map((row) => "<tr>" + head.map((_, n) => "<td>" + inlineMd(row[n] || "") + "</td>").join("") + "</tr>").join("") +
        "</tbody></table></div>");
      continue;
    }
    if (isUl(line)) {
      const items = [];
      while (i < lines.length && isUl(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      html.push("<ul>" + items.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</ul>");
      continue;
    }
    if (isOl(line)) {
      const items = [];
      while (i < lines.length && isOl(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      html.push("<ol>" + items.map((it) => "<li>" + inlineMd(it) + "</li>").join("") + "</ol>");
      continue;
    }
    const ps = [line];
    i++;
    while (i < lines.length && lines[i].trim() && !isHeading(lines[i]) && !isQuote(lines[i]) && !isUl(lines[i]) && !isOl(lines[i]) && !isHr(lines[i]) && !(lines[i].includes("|") && i + 1 < lines.length && isSep(lines[i + 1]))) {
      ps.push(lines[i]);
      i++;
    }
    html.push("<p>" + ps.map((t) => inlineMd(t)).join("<br>") + "</p>");
  }
  return html.join("\n").replace(/\u0000M(\d+)\u0000/g, (_, n) => {
    const item = maths[Number(n)];
    return item ? renderMath(item.tex, item.display) : "";
  });
}

function HttpError(status, message) {
  const e = new Error(message);
  e.status = status;
  return e;
}

function baseHeaders() {
  const h = new Headers();
  h.set("X-Content-Type-Options", "nosniff");
  h.set("X-Frame-Options", "DENY");
  h.set("Referrer-Policy", "strict-origin-when-cross-origin");
  h.set("Permissions-Policy", "camera=(), microphone=(self), geolocation=()");
  h.set("Cross-Origin-Opener-Policy", "same-origin");
  h.set("Cross-Origin-Resource-Policy", "same-origin");
  h.set("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'; base-uri 'none'");
  h.set("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  return h;
}
function pageCsp(nonce) {
  return "default-src 'self'; img-src 'self' data: blob:; media-src 'self' blob: data:; style-src 'self' 'unsafe-inline'; script-src 'self' 'nonce-" + nonce + "'; connect-src 'self' https:; font-src 'self' data:; worker-src 'self' blob:; frame-src 'self' blob:; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'none'; upgrade-insecure-requests";
}
function newNonce() {
  const a = new Uint8Array(16);
  crypto.getRandomValues(a);
  return b64urlEncode(a);
}

function json(data, status = 200, extra) {
  const h = baseHeaders();
  h.set("Content-Type", "application/json; charset=utf-8");
  h.set("Cache-Control", "no-store");
  if (extra) {
    for (const [k, v] of Object.entries(extra)) {
      if (k.toLowerCase() === "set-cookie") h.append("Set-Cookie", v);
      else h.set(k, v);
    }
  }
  if (typeof globalThis !== "undefined" && globalThis.__honguiReqMethod === "HEAD") {
    return new Response(null, { status, headers: h });
  }
  return new Response(JSON.stringify(data), { status, headers: h });
}

function fail(status, error) {
  return json({ ok: false, error, code: status }, status);
}

function textResponse(body, type, status, extra) {
  const h = baseHeaders();
  h.set("Content-Type", type);
  if (extra) for (const [k, v] of Object.entries(extra)) h.set(k, v);
  return new Response(body, { status: status || 200, headers: h });
}

function redirect(location, status = 302) {
  const h = baseHeaders();
  h.set("Location", location);
  return new Response(null, { status, headers: h });
}

function isLocalHostName(h) { return h === "localhost" || h === "127.0.0.1" || h === "[::1]" || /\.localhost$/.test(h); }
function isAiHost(url) { const h = url.hostname; return h === "ai.hongspaces.com" || h === "ai.localhost"; }
function aiOriginFor(url) { return isLocalHostName(url.hostname) ? url.protocol + "//ai.localhost" + (url.port ? ":" + url.port : "") : "https://ai.hongspaces.com"; }
function mainOriginFor(url) { return isLocalHostName(url.hostname) ? url.protocol + "//localhost" + (url.port ? ":" + url.port : "") : "https://hongspaces.com"; }
const AI_HOST_API = ["/api/ai/", "/api/auth/", "/api/admin/ai-chats", "/api/drive/", "/api/ping", "/api/visitor", "/api/gate/status"];
async function cacheMatch(req) {
  try { return await caches.default.match(req); } catch { return null; }
}
async function cachePut(req, res) {
  try { await caches.default.put(req, res); } catch { /* 免费层缓存不可用时忽略 */ }
}
async function cacheDel(url) {
  try { await caches.default.delete(new Request(url)); } catch { /* ignore */ }
}
function cacheReq(name) {
  return new Request("https://internal.hongui/" + name);
}

async function hashHex(s) {
  const dig = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(String(s)));
  return [...new Uint8Array(dig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function shortHash(s) {
  return (await hashHex(s)).slice(0, 24);
}

function clientIp(request) {
  const cf = request.headers.get("cf-connecting-ip");
  if (cf) return cf.trim();
  const xff = request.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return "未知";
}

const MEM = new Map();
function memCount(name, ttlSec, inc) {
  const now = Date.now();
  if (MEM.size > 5000) MEM.clear();
  let e = MEM.get(name);
  if (!e || e.until < now) { e = { n: 0, until: now + ttlSec * 1000 }; MEM.set(name, e); }
  if (inc) e.n += 1;
  return e.n;
}
async function tooMany(name, limit, ttl) {
  if (memCount("rl/" + name, ttl, true) > limit * 2) return true;
  try {
    const req = cacheReq("rl/" + name);
    const hit = await cacheMatch(req);
    let n = 0;
    if (hit) n = parseInt(await hit.text(), 10) || 0;
    if (n >= limit) return true;
    await cachePut(req, new Response(String(n + 1), { headers: { "Cache-Control": "public, max-age=" + ttl } }));
    return false;
  } catch {
    return false;
  }
}

function b64urlEncode(bytes) {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (let i = 0; i < arr.length; i += 0x8000) s += String.fromCharCode(...arr.subarray(i, i + 0x8000));
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}
function b64urlDecode(str) {
  const s = String(str || "").replace(/-/g, "+").replace(/_/g, "/");
  const pad = s + "=".repeat((4 - (s.length % 4)) % 4);
  const bin = atob(pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
async function hmacBytes(secret, data) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(String(secret || " ")),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, typeof data === "string" ? new TextEncoder().encode(data) : data);
  return new Uint8Array(sig);
}
function bytesEq(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let v = 0;
  for (let i = 0; i < a.length; i++) v |= a[i] ^ b[i];
  return v === 0;
}
function getCookie(request, name) {
  const raw = request.headers.get("Cookie") || "";
  for (const part of raw.split(/;\s*/)) {
    const i = part.indexOf("=");
    if (i > 0 && part.slice(0, i) === name) {
      try { return decodeURIComponent(part.slice(i + 1)); } catch { return part.slice(i + 1); }
    }
  }
  return "";
}
function sessionCookie(token, request, maxAge) {
  const host = new URL(request.url).hostname;
  const local = isLocalHostName(host);
  const bits = ["hongui_session=" + token, "HttpOnly", "Path=/", "SameSite=Strict", "Max-Age=" + maxAge];
  if (!local) bits.push("Secure");
  return bits.join("; ");
}
function sessionKey(env) {
  return String(env.SESSION_SECRET) + "\u0000" + String(env.ADMIN_SECRET);
}
async function credsOk(env, user, pass) {
  if (!env.SESSION_SECRET || !env.ADMIN_USER || !env.ADMIN_SECRET) return false;
  const ua = await hmacBytes(env.SESSION_SECRET, String(user || ""));
  const ub = await hmacBytes(env.SESSION_SECRET, String(env.ADMIN_USER));
  const pa = await hmacBytes(env.SESSION_SECRET, String(pass || ""));
  const pb = await hmacBytes(env.SESSION_SECRET, String(env.ADMIN_SECRET));
  return bytesEq(ua, ub) && bytesEq(pa, pb);
}
async function readSession(request, env) {
  try {
    const token = getCookie(request, "hongui_session");
    if (!token || !env.SESSION_SECRET || !env.ADMIN_USER || !env.ADMIN_SECRET) return null;
    const parts = token.split(".");
    if (parts.length !== 3 || parts[0] !== "v1") return null;
    const expect = await hmacBytes(sessionKey(env), parts[1]);
    let got;
    try { got = b64urlDecode(parts[2]); } catch { return null; }
    if (!bytesEq(expect, got)) return null;
    const payload = JSON.parse(new TextDecoder().decode(b64urlDecode(parts[1])));
    if (!payload || typeof payload.exp !== "number" || payload.exp < Date.now()) return null;
    if (payload.u !== env.ADMIN_USER) return null;
    return { user: payload.u };
  } catch {
    return null;
  }
}
async function makeToken(env, user) {
  const payload = b64urlEncode(new TextEncoder().encode(JSON.stringify({ u: user, exp: Date.now() + 7 * 86400000 })));
  const sig = b64urlEncode(await hmacBytes(sessionKey(env), payload));
  return "v1." + payload + "." + sig;
}
function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (!origin) return false;
  try {
    const o = new URL(origin);
    const u = new URL(request.url);
    return o.host === u.host && o.protocol === u.protocol;
  } catch {
    return false;
  }
}
function requireOrigin(request) {
  if (!sameOrigin(request)) throw HttpError(403, "请求来源不被允许");
}
async function requireUser(request, env) {
  const s = await readSession(request, env);
  if (!s) throw HttpError(401, "请先登录");
  return s;
}
function assertConfigured(env) {
  if (!env.ADMIN_USER || !env.ADMIN_SECRET || !env.SESSION_SECRET) {
    throw HttpError(503, "服务尚未配置管理员，请设置 ADMIN_USER、ADMIN_SECRET 与 SESSION_SECRET");
  }
  if (String(env.SESSION_SECRET).length < 16) throw HttpError(503, "SESSION_SECRET 太短，请使用至少 16 位的随机字符串");
}

async function readJson(request, max) {
  const len = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (Number.isFinite(len) && len > max) throw HttpError(413, "请求体过大");
  const text = await request.text();
  if (text.length > max) throw HttpError(413, "请求体过大");
  if (!text) return {};
  try { return JSON.parse(text); } catch { throw HttpError(400, "JSON 格式不正确"); }
}
function cleanLine(s, max) {
  return String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);
}
function makeSummary(md) {
  const text = String(md || "")
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/[#>*_\[\]()`~|-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return text.slice(0, 140);
}
function newId() {
  const a = new Uint8Array(8);
  crypto.getRandomValues(a);
  return [...a].map((b) => b.toString(16).padStart(2, "0")).join("");
}
function validBlogKey(key) {
  if (typeof key !== "string" || key.length > 300 || !key.startsWith("blog/") || key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  if (/[\u0000-\u001f]/.test(key)) return false;
  return /^blog\/.+\.(png|jpe?g|gif|webp)$/i.test(key);
}
function validMusicKey(key) {
  if (typeof key !== "string" || key.length > 300 || !key.startsWith("music/") || key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  if (/[\u0000-\u001f]/.test(key)) return false;
  return /^music\/.+\.(mp3|m4a|ogg|wav|aac)$/i.test(key);
}
function sniffAudio(bytes, name) {
  const n = String(name || "").toLowerCase();
  if (bytes.length >= 3 && bytes[0] === 0x49 && bytes[1] === 0x44 && bytes[2] === 0x33) return "audio/mpeg";
  if (bytes.length >= 2 && bytes[0] === 0xff && (bytes[1] & 0xe0) === 0xe0) return "audio/mpeg";
  if (bytes.length >= 4 && bytes[0] === 0x4f && bytes[1] === 0x67 && bytes[2] === 0x67 && bytes[3] === 0x53) return "audio/ogg";
  if (bytes.length >= 12 && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46) return "audio/wav";
  if (bytes.length >= 8 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) return "audio/mp4";
  if (/\.mp3$/i.test(n)) return "audio/mpeg";
  if (/\.ogg$/i.test(n)) return "audio/ogg";
  if (/\.wav$/i.test(n)) return "audio/wav";
  if (/\.(m4a|aac)$/i.test(n)) return "audio/mp4";
  return "";
}
function safeSegment(name) {
  let s = String(name || "").replace(/\\/g, "/").split("/").pop() || "";
  s = s.replace(/[\u0000-\u001f]/g, "").replace(/[\\/:*?"<>|%]/g, "_").trim();
  if (!s || s === "." || s === "..") s = "file";
  if (s === ".keep") s = "_keep";
  return s.slice(0, 120);
}
function normalizeRel(rel) {
  const parts = String(rel || "").replace(/\\/g, "/").split("/");
  const out = [];
  for (const p of parts) {
    if (!p || p === ".") continue;
    if (p === "..") return null;
    if (/[\u0000-\u001f]/.test(p)) return null;
    out.push(p);
  }
  return out.join("/");
}
function toDriveKey(rel) {
  const n = normalizeRel(rel);
  if (n == null) return null;
  return n ? "drive/" + n : "drive/";
}
function validDriveKey(key, allowDir) {
  if (typeof key !== "string" || !key.startsWith("drive/") || key.includes("..") || key.includes("\\") || key.includes("//")) return false;
  if (key.length > 520) return false;
  if (allowDir && (key === "drive/" || key.endsWith("/"))) return /^drive\/[\s\S]+\/$/.test(key) || key === "drive/";
  return key !== "drive/" && !key.endsWith("/");
}
function contentDisposition(filename, inline) {
  const ascii = String(filename || "file").replace(/[^\x20-\x7e]/g, "_").replace(/"/g, "");
  return (inline ? "inline" : "attachment") + '; filename="' + ascii + "\"; filename*=UTF-8''" + encodeURIComponent(filename || "file");
}
function dangerousFile(key, contentType) {
  const n = String(key || "").toLowerCase();
  const ct = String(contentType || "").toLowerCase();
  return /\.(html?|xhtml|svgz?|xml|xsl|xslt|mht|mhtml)$/.test(n) || ct.includes("html") || ct.includes("svg") || ct.includes("xml") || ct.includes("javascript");
}
function sniffImage(bytes) {
  if (bytes.length >= 8 && bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return "image/png";
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (bytes.length >= 6 && bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46) return "image/gif";
  if (bytes.length >= 12 && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50) return "image/webp";
  return "";
}
function extOf(name) {
  const m = /\.([a-z0-9]+)$/i.exec(String(name || ""));
  return m ? "." + m[1].toLowerCase() : "";
}
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!m) return { invalid: true };
  let start;
  let end;
  if (m[1] === "" && m[2] !== "") {
    const suffix = parseInt(m[2], 10);
    if (!Number.isFinite(suffix)) return { invalid: true };
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else if (m[1] !== "") {
    start = parseInt(m[1], 10);
    end = m[2] === "" ? size - 1 : parseInt(m[2], 10);
  } else return { invalid: true };
  if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || start > end || start >= size) return { invalid: true };
  end = Math.min(end, size - 1);
  return { start, end };
}
function etagHit(header, etag) {
  if (!header || !etag) return false;
  return header.split(",").some((p) => {
    const t = p.trim();
    return t === etag || t === "W/" + etag;
  });
}
function rfc822(ts) {
  const d = ts ? new Date(ts) : new Date();
  return isNaN(d.getTime()) ? new Date().toUTCString() : d.toUTCString();
}
function cdata(s) {
  return "<![CDATA[" + String(s || "").replace(/]]>/g, "]]]]><![CDATA[>") + "]]>";
}
function maskKey(k) {
  const s = String(k || "");
  if (!s) return "";
  if (s.length <= 4) return "****";
  return "****" + s.slice(-4);
}
function apiRoot(u) {
  let s = String(u || "").trim().replace(/\/+$/, "");
  s = s.replace(/\/chat\/completions$/i, "");
  return s;
}
function sanitizePublicError(text) {
  return String(text || "")
    .replace(/https?:\/\/[^\s"'<>]+/gi, "[地址已隐藏]")
    .replace(/\b(?:nvapi|sk|sk-ant|gsk)-[A-Za-z0-9_\-]{4,}/g, "[密钥已隐藏]")
    .replace(/bearer\s+[A-Za-z0-9_\-\.]+/gi, "[密钥已隐藏]")
    .replace(/[A-Za-z0-9_\-]{32,}/g, "[已隐藏]")
    .replace(/[\u0000-\u001f]/g, " ")
    .slice(0, 180);
}
function friendlyAiError(status, raw) {
  if (status === 401 || status === 403) return "该档位的 API 密钥无效或没有权限（" + status + "），请管理员检查对应的 Worker Secret";
  if (status === 404) return "模型名称或 API 地址不正确（404），请到后台 AI 设置检查";
  if (status === 413) return "内容太大（413），请减少图片或文字后再试";
  if (status === 429) return "请求过于频繁或额度不足（429），请稍后再试";
  if (status === 408 || status === 504) return "模型响应超时，请重试";
  if (status >= 500) return "模型服务暂时不可用（" + status + "），请稍后重试";
  const extra = sanitizePublicError(raw);
  return "模型请求失败（" + status + "）" + (extra ? "：" + extra : "，请检查模型名称和 API 地址");
}
function kvStore(env) {
  if (!env.one) throw HttpError(503, "未绑定 KV（one）");
  return env.one;
}
function bucket(env) {
  if (!env.first) throw HttpError(503, "未绑定 R2（first）");
  return env.first;
}
async function getIndex(env) {
  const raw = await kvStore(env).get("idx");
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    return Array.isArray(v) ? v : [];
  } catch {
    return [];
  }
}
async function getPost(env, id) {
  if (!/^[a-zA-Z0-9_-]{4,40}$/.test(id || "")) return null;
  const raw = await kvStore(env).get("post:" + id);
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}
function publishedSorted(idx) {
  return idx.filter((p) => p && p.status === "published").sort((a, b) => String(b.publishedAt || "").localeCompare(String(a.publishedAt || "")));
}
async function getAbout(env) {
  const raw = await kvStore(env).get("cfg:about");
  return raw == null ? DEFAULT_ABOUT : String(raw);
}
async function getValues(env) {
  const raw = await kvStore(env).get("cfg:values");
  if (!raw) return DEFAULT_VALUES;
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v) || !v.length) return DEFAULT_VALUES;
    return v.map((item, i) => ({
      title: cleanLine(item && item.title, 40) || DEFAULT_VALUES[i] && DEFAULT_VALUES[i].title || "价值观",
      text: cleanLine(item && item.text, 800)
    })).filter((item) => item.text);
  } catch {
    return DEFAULT_VALUES;
  }
}
const BG_PRESETS = ["default", "jiuzhai", "lijiang", "mogan", "coast", "huangshan", "white", "night"];
function cleanBg(b) {
  if (!b || typeof b !== "object") return null;
  if (b.k === "preset" && BG_PRESETS.includes(b.id)) return { k: "preset", id: b.id };
  if (b.k === "color" && /^#[0-9a-fA-F]{6}$/.test(String(b.c || ""))) return { k: "color", c: String(b.c).toLowerCase() };
  if (b.k === "img" && /^\/image\/[A-Za-z0-9_\-.\/%]{1,200}$/.test(String(b.url || "")) && !String(b.url).includes("..")) {
    const dark = b.tone === "dark";
    return { k: "img", src: "url", url: String(b.url), tone: dark ? "dark" : "light", lum: dark ? 0.25 : 0.75 };
  }
  return null;
}
let BG_MEM = { at: 0, v: null };
async function getSiteBg(env) {
  const now = Date.now();
  if (now - BG_MEM.at < 60000) return BG_MEM.v;
  let v = null;
  try {
    const raw = await kvStore(env).get("cfg:bg");
    if (raw) v = cleanBg(JSON.parse(raw));
  } catch { v = null; }
  BG_MEM = { at: now, v };
  return v;
}
function defaultMusicCfg() {
  return { enabled: false, autoplay: true, loop: true, volume: 0.35, current: "", v: 1 };
}
function cleanMusicCfg(raw) {
  const d = defaultMusicCfg();
  if (!raw || typeof raw !== "object") return d;
  d.enabled = !!raw.enabled;
  d.autoplay = raw.autoplay !== false;
  d.loop = raw.loop !== false;
  const vol = Number(raw.volume);
  d.volume = Number.isFinite(vol) ? Math.min(1, Math.max(0, vol)) : 0.35;
  d.current = validMusicKey(String(raw.current || "")) ? String(raw.current) : "";
  d.v = Number(raw.v) === 1 ? 1 : 0;
  return d;
}
async function getMusicCfg(env) {
  try {
    const raw = await kvStore(env).get("cfg:music");
    if (!raw) return defaultMusicCfg();
    const parsed = JSON.parse(raw);
    const cfg = cleanMusicCfg(parsed);
    if (cfg.current && !cfg.enabled && cfg.v !== 1) {
      cfg.enabled = true;
      cfg.v = 1;
      await kvStore(env).put("cfg:music", JSON.stringify({
        enabled: cfg.enabled,
        autoplay: cfg.autoplay,
        loop: cfg.loop,
        volume: cfg.volume,
        current: cfg.current,
        v: 1
      }));
    } else if (cfg.v !== 1) {
      cfg.v = 1;
    }
    return cfg;
  } catch {
    return defaultMusicCfg();
  }
}
function musicPublicUrl(origin, key) {
  return origin + "/music/" + key.split("/").map(encodeURIComponent).join("/");
}
async function getAiSaved(env) {
  const raw = await kvStore(env).get("cfg:ai");
  if (!raw) return null;
  try { return JSON.parse(raw); } catch { return null; }
}

const AI_CHAT_IDX = "ai:chat:idx";
const AI_CHAT_PREFIX = "ai:chat:";
const AI_CHAT_MAX = 80;
const AI_CHAT_MSG_MAX = 120;
function validAiChatId(id) {
  return typeof id === "string" && /^[a-z0-9]{6,48}$/i.test(id);
}
function stripHeavyImages(images) {
  if (!Array.isArray(images) || !images.length) return [];
  const out = [];
  let budget = 450000;
  for (const src of images.slice(0, 8)) {
    const s = String(src || "");
    if (!s.startsWith("data:image/")) continue;
    if (s.length > budget) {
      out.push("data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7");
      continue;
    }
    budget -= s.length;
    out.push(s);
  }
  return out;
}
function cleanAiChatSession(raw) {
  if (!raw || typeof raw !== "object") return null;
  const id = validAiChatId(raw.id) ? raw.id : "";
  if (!id) return null;
  const messages = Array.isArray(raw.messages) ? raw.messages.slice(-AI_CHAT_MSG_MAX).map((m) => {
    if (!m || typeof m !== "object") return null;
    const role = m.role === "assistant" ? "assistant" : "user";
    return {
      id: cleanLine(m.id, 40) || (Date.now().toString(36) + Math.random().toString(36).slice(2, 6)),
      role,
      content: String(m.content || "").slice(0, 60000),
      images: stripHeavyImages(m.images),
      kind: m.kind === "image" ? "image" : undefined,
      prompt: m.kind === "image" ? String(m.prompt || "").slice(0, 4000) : undefined,
      ts: Number(m.ts) || Date.now(),
      feedback: m.feedback === 1 || m.feedback === -1 ? m.feedback : 0,
      usage: m.usage && typeof m.usage === "object" ? {
        prompt_tokens: Number(m.usage.prompt_tokens) || 0,
        completion_tokens: Number(m.usage.completion_tokens) || 0,
        total_tokens: Number(m.usage.total_tokens) || 0
      } : null,
      error: !!m.error,
      tier: cleanLine(m.tier, 20),
      tierLabel: cleanLine(m.tierLabel, 40)
    };
  }).filter(Boolean) : [];
  return {
    id,
    title: cleanLine(raw.title, 80) || "新的对话",
    pinned: !!raw.pinned,
    mode: cleanLine(raw.mode, 20) || "general",
    messages,
    created: Number(raw.created) || Date.now(),
    updated: Number(raw.updated) || Date.now()
  };
}
async function listAiChatMeta(env) {
  const raw = await kvStore(env).get(AI_CHAT_IDX);
  if (!raw) return [];
  try {
    const v = JSON.parse(raw);
    if (!Array.isArray(v)) return [];
    return v.filter((x) => x && validAiChatId(x.id)).map((x) => ({
      id: x.id,
      title: cleanLine(x.title, 80) || "新的对话",
      pinned: !!x.pinned,
      mode: cleanLine(x.mode, 20) || "general",
      updated: Number(x.updated) || 0,
      created: Number(x.created) || 0,
      count: Number(x.count) || 0
    }));
  } catch {
    return [];
  }
}
async function saveAiChatMeta(env, list) {
  const slim = list.slice(0, AI_CHAT_MAX).map((x) => ({
    id: x.id,
    title: x.title,
    pinned: !!x.pinned,
    mode: x.mode || "general",
    updated: x.updated || 0,
    created: x.created || 0,
    count: x.count || 0
  }));
  await kvStore(env).put(AI_CHAT_IDX, JSON.stringify(slim));
}
async function getAiChat(env, id) {
  if (!validAiChatId(id)) return null;
  const raw = await kvStore(env).get(AI_CHAT_PREFIX + id);
  if (!raw) return null;
  try { return cleanAiChatSession(JSON.parse(raw)); } catch { return null; }
}
async function upsertAiChat(env, raw) {
  const session = cleanAiChatSession(raw);
  if (!session) throw HttpError(400, "会话格式不正确");
  let idx = await listAiChatMeta(env);
  idx = idx.filter((x) => x.id !== session.id);
  idx.unshift({
    id: session.id,
    title: session.title,
    pinned: session.pinned,
    mode: session.mode,
    updated: session.updated,
    created: session.created,
    count: session.messages.length
  });
  idx.sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
  const drop = idx.slice(AI_CHAT_MAX);
  idx = idx.slice(0, AI_CHAT_MAX);
  await kvStore(env).put(AI_CHAT_PREFIX + session.id, JSON.stringify(session));
  await saveAiChatMeta(env, idx);
  for (const d of drop) {
    await kvStore(env).delete(AI_CHAT_PREFIX + d.id);
  }
  return session;
}
async function deleteAiChat(env, id) {
  if (!validAiChatId(id)) throw HttpError(400, "会话 ID 无效");
  await kvStore(env).delete(AI_CHAT_PREFIX + id);
  const idx = (await listAiChatMeta(env)).filter((x) => x.id !== id);
  await saveAiChatMeta(env, idx);
  return true;
}
async function handleAdminAiChats(request, env, url, path, method) {
  const base = "/api/admin/ai-chats";
  if (path === base && method === "GET") {
    const full = url.searchParams.get("full") === "1";
    const meta = await listAiChatMeta(env);
    if (!full) return json({ ok: true, sessions: meta });
    const sessions = [];
    for (const m of meta) {
      const s = await getAiChat(env, m.id);
      if (s) sessions.push(s);
    }
    return json({ ok: true, sessions });
  }
  if (path === base && method === "POST") {
    const body = await readJson(request, 2500000);
    const session = await upsertAiChat(env, body.session || body);
    return json({ ok: true, session });
  }
  if (path === base && method === "DELETE" && url.searchParams.get("all") === "1") {
    const meta = await listAiChatMeta(env);
    for (const m of meta) await kvStore(env).delete(AI_CHAT_PREFIX + m.id);
    await saveAiChatMeta(env, []);
    return json({ ok: true });
  }
  if (path.startsWith(base + "/")) {
    const id = decodeURIComponent(path.slice((base + "/").length));
    if (method === "GET") {
      const session = await getAiChat(env, id);
      if (!session) return fail(404, "会话不存在");
      return json({ ok: true, session });
    }
    if (method === "PUT" || method === "POST") {
      const body = await readJson(request, 2500000);
      const raw = body.session || body;
      raw.id = id;
      const session = await upsertAiChat(env, raw);
      return json({ ok: true, session });
    }
    if (method === "DELETE") {
      await deleteAiChat(env, id);
      return json({ ok: true });
    }
  }
  return null;
}
function envKeyFor(env, id) {
  const name = AI_TIER_SECRET[id];
  return name ? String(env[name] || "").trim() : "";
}
function pickTier(v, fallback) {
  return AI_TIERS.includes(v) ? v : fallback;
}
function pickChatTier(v, fallback) {
  return AI_CHAT_TIERS.includes(v) ? v : fallback;
}
function mergeAi(saved, env) {
  const d = defaultAi();
  const s = saved || {};
  const st = s.v >= 5 && s.tiers && typeof s.tiers === "object" ? s.tiers : {};
  const modes = Object.assign({}, d.modePrompts, s.modePrompts || {});
  const tiers = {};
  for (const id of AI_TIERS) {
    const dt = d.tiers[id];
    const t = st[id] && typeof st[id] === "object" ? st[id] : {};
    const key = envKeyFor(env, id);
    const chat = dt.kind === "chat";
    tiers[id] = {
      id,
      kind: dt.kind,
      model: cleanLine(t.model, 160) || dt.model,
      baseUrl: apiRoot(t.baseUrl || dt.baseUrl),
      apiKey: key,
      keySource: key ? "env" : "none",
      secretName: AI_TIER_SECRET[id],
      temperature: chat ? clampNum(t.temperature, 0, 2, dt.temperature) : 0,
      topP: chat ? clampNum(t.topP, 0, 1, dt.topP) : 0,
      maxTokens: chat ? clampInt(t.maxTokens, 64, 32768, dt.maxTokens) : 0,
      supportsImages: chat ? (t.supportsImages != null ? !!t.supportsImages : dt.supportsImages) : false,
      stream: chat ? (t.stream != null ? !!t.stream : dt.stream) : false,
      thinking: false,
      steps: chat ? 0 : clampInt(t.steps, 1, 100, dt.steps)
    };
  }
  return {
    tiers,
    defaultTier: pickTier(s.defaultTier, d.defaultTier),
    guestTier: pickTier(s.guestTier, d.guestTier),
    adminTier: pickChatTier(s.adminTier, d.adminTier),
    allowGuest: s.allowGuest != null ? !!s.allowGuest : d.allowGuest,
    guestImages: s.guestImages != null ? !!s.guestImages : d.guestImages,
    guestDailyLimit: clampInt(s.guestDailyLimit, 1, 200, d.guestDailyLimit),
    systemPrompt: String((s.systemPrompt != null && String(s.systemPrompt).trim()) ? s.systemPrompt : d.systemPrompt).slice(0, 4000),
    modePrompts: {
      general: String(modes.general || "").slice(0, 4000),
      polish: String(modes.polish || "").slice(0, 4000),
      code: String(modes.code || "").slice(0, 4000),
      translate: String(modes.translate || "").slice(0, 4000),
      study: String(modes.study || "").slice(0, 4000)
    }
  };
}
// 旧版（v<5）配置里可能残留 KV 中的旧档位与密钥：首次读取时改写为不含任何密钥的新结构
async function migrateAiSaved(env, saved) {
  if (!saved || saved.v >= 5) return;
  const m = mergeAi(null, env);
  const next = {
    v: 5,
    tiers: {},
    defaultTier: "general",
    guestTier: "general",
    adminTier: "general",
    allowGuest: saved.allowGuest != null ? !!saved.allowGuest : true,
    guestImages: saved.guestImages != null ? !!saved.guestImages : true,
    guestDailyLimit: clampInt(saved.guestDailyLimit, 1, 200, 20),
    systemPrompt: saved.systemPrompt != null ? String(saved.systemPrompt).slice(0, 4000) : m.systemPrompt,
    modePrompts: Object.assign({}, DEFAULT_MODES, saved.modePrompts && typeof saved.modePrompts === "object" ? saved.modePrompts : {})
  };
  for (const k of Object.keys(next.modePrompts)) if (!AI_MODES.includes(k)) delete next.modePrompts[k];
  for (const k of AI_MODES) next.modePrompts[k] = String(next.modePrompts[k] || "").slice(0, 4000);
  await kvStore(env).put("cfg:ai", JSON.stringify(next));
}
function clampInt(n, min, max, fallback) {
  const v = parseInt(n, 10);
  if (!Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
function clampNum(n, min, max, fallback) {
  const v = Number(n);
  if (n === "" || n == null || !Number.isFinite(v)) return fallback;
  return Math.min(max, Math.max(min, v));
}
function publicTier(t) {
  return {
    id: t.id,
    kind: t.kind,
    label: AI_TIER_LABEL[t.id],
    model: t.model,
    baseUrl: t.baseUrl,
    apiKeyMasked: maskKey(t.apiKey),
    hasKey: !!t.apiKey,
    keySource: t.keySource,
    secretName: t.secretName,
    temperature: t.temperature,
    topP: t.topP,
    maxTokens: t.maxTokens,
    supportsImages: t.supportsImages,
    stream: t.stream,
    thinking: t.thinking,
    steps: t.steps
  };
}
function publicAi(cfg) {
  const tiers = {};
  for (const id of AI_TIERS) tiers[id] = publicTier(cfg.tiers[id]);
  return {
    tiers,
    defaultTier: cfg.defaultTier,
    guestTier: cfg.guestTier,
    adminTier: cfg.adminTier,
    allowGuest: cfg.allowGuest,
    guestImages: cfg.guestImages,
    guestDailyLimit: cfg.guestDailyLimit,
    systemPrompt: cfg.systemPrompt,
    modePrompts: cfg.modePrompts
  };
}
function guestMaxTokens(t) {
  return Math.min(t.maxTokens, t.thinking ? 8192 : 2048);
}
function briefTiers(cfg, isAdmin) {
  return AI_TIERS.map((id) => {
    const t = cfg.tiers[id];
    return {
      id,
      kind: t.kind,
      label: AI_TIER_LABEL[id],
      desc: AI_TIER_DESC[id],
      vision: t.kind === "chat" && !!t.supportsImages && (isAdmin || !!cfg.guestImages),
      thinking: !!t.thinking,
      temperature: t.temperature,
      maxTokens: isAdmin ? t.maxTokens : guestMaxTokens(t),
      sizes: t.kind === "image" ? Object.keys(AI_IMAGE_SIZES) : undefined,
      hasKey: !!t.apiKey,
      model: isAdmin ? t.model : undefined
    };
  });
}
function guestLimitFor(request, cfg) {
  const g = GATE_OF.get(request);
  return g && g.mode === "soft" ? Math.min(5, cfg.guestDailyLimit) : cfg.guestDailyLimit;
}
async function guestUsageToday(request, env, cfg) {
  const ip = clientIp(request);
  const day = new Date().toISOString().slice(0, 10);
  const req = cacheReq("aiguest/" + await shortHash(ip + ":" + day));
  const hit = await cacheMatch(req);
  const used = hit ? parseInt(await hit.text(), 10) || 0 : 0;
  const limit = guestLimitFor(request, cfg);
  return { used, limit, remaining: Math.max(0, limit - used) };
}
function indexItem(post) {
  return {
    id: post.id,
    title: post.title,
    category: post.category,
    publishedAt: post.publishedAt || "",
    updatedAt: post.updatedAt || "",
    summary: post.summary || "",
    cover: post.cover || "",
    status: post.status,
    views: post.views || 0,
    likes: post.likes || 0
  };
}

async function applyViewDelta(env, id, delta) {
  if (!delta) return;
  const post = await getPost(env, id);
  if (!post || post.status !== "published") return;
  post.views = (post.views || 0) + delta;
  await kvStore(env).put("post:" + id, JSON.stringify(post));
  const idx = await getIndex(env);
  const it = idx.find((x) => x.id === id);
  if (it) {
    it.views = post.views;
    await kvStore(env).put("idx", JSON.stringify(idx));
  }
}
async function recordView(env, ctx, ip, id) {
  const day = new Date().toISOString().slice(0, 10);
  const seen = cacheReq("seen/" + await shortHash(ip + ":" + id + ":" + day));
  if (await cacheMatch(seen)) return;
  await cachePut(seen, new Response("1", { headers: { "Cache-Control": "public, max-age=86400" } }));
  ctx.waitUntil(addView(env, id).catch(() => {}));
}
async function addView(env, id) {
  const lock = cacheReq("vlock/" + encodeURIComponent(id));
  const pend = cacheReq("vpend/" + encodeURIComponent(id));
  if (await cacheMatch(lock)) {
    const prev = await cacheMatch(pend);
    const n = (prev ? parseInt(await prev.text(), 10) || 0 : 0) + 1;
    await cachePut(pend, new Response(String(n), { headers: { "Cache-Control": "public, max-age=86400" } }));
    return;
  }
  const prev = await cacheMatch(pend);
  const extra = prev ? parseInt(await prev.text(), 10) || 0 : 0;
  await cachePut(lock, new Response("1", { headers: { "Cache-Control": "public, max-age=600" } }));
  await cachePut(pend, new Response("0", { headers: { "Cache-Control": "public, max-age=60" } }));
  await applyViewDelta(env, id, 1 + extra);
}
async function recordVisit(env, ctx, ip) {
  try {
    if (!env.one) return;
    const day = new Date().toISOString().slice(0, 10);
    const seen = cacheReq("visitseen/" + await shortHash(ip + ":" + day));
    if (await cacheMatch(seen)) return;
    await cachePut(seen, new Response("1", { headers: { "Cache-Control": "public, max-age=86400" } }));
    ctx.waitUntil(addVisit(env).catch(() => {}));
  } catch { /* ignore */ }
}
async function addVisit(env) {
  const lock = cacheReq("visitlock");
  const pend = cacheReq("visitpend");
  if (await cacheMatch(lock)) {
    const prev = await cacheMatch(pend);
    const n = (prev ? parseInt(await prev.text(), 10) || 0 : 0) + 1;
    await cachePut(pend, new Response(String(n), { headers: { "Cache-Control": "public, max-age=86400" } }));
    return;
  }
  const prev = await cacheMatch(pend);
  const extra = prev ? parseInt(await prev.text(), 10) || 0 : 0;
  await cachePut(lock, new Response("1", { headers: { "Cache-Control": "public, max-age=600" } }));
  await cachePut(pend, new Response("0", { headers: { "Cache-Control": "public, max-age=60" } }));
  const raw = await kvStore(env).get("stats:visits");
  const n = (parseInt(raw || "0", 10) || 0) + 1 + extra;
  await kvStore(env).put("stats:visits", String(n));
}
async function pendingOf(name) {
  const hit = await cacheMatch(cacheReq(name));
  if (!hit) return 0;
  return parseInt(await hit.text(), 10) || 0;
}

async function savePost(env, body, status) {
  const title = cleanLine(body.title, 100);
  if (!title) throw HttpError(400, "请填写标题");
  if (!CATEGORIES.includes(body.category)) throw HttpError(400, "分类不正确");
  const content = String(body.content || "");
  if (content.length > 200000) throw HttpError(400, "正文过长");
  if (status === "published" && !content.trim()) throw HttpError(400, "发布前请填写正文");
  const cover = String(body.cover || "").trim();
  if (cover && !validBlogKey(cover)) throw HttpError(400, "封面 Key 必须是 blog/ 开头的图片");
  let id = body.id ? String(body.id) : "";
  let prev = null;
  if (id) {
    if (!/^[a-zA-Z0-9_-]{4,40}$/.test(id)) throw HttpError(400, "文章编号不正确");
    prev = await getPost(env, id);
    if (!prev) throw HttpError(404, "文章不存在");
  } else id = newId();
  const now = new Date().toISOString();
  const summary = cleanLine(body.summary, 300) || makeSummary(content);
  let publishedAt = prev && prev.publishedAt || "";
  if (status === "published" && !(prev && prev.status === "published" && prev.publishedAt)) publishedAt = now;
  const post = {
    id, title, category: body.category, summary, content, cover, status, publishedAt,
    updatedAt: now,
    views: prev ? prev.views || 0 : 0,
    likes: prev ? prev.likes || 0 : 0
  };
  await kvStore(env).put("post:" + id, JSON.stringify(post));
  const idx = await getIndex(env);
  const item = indexItem(post);
  const at = idx.findIndex((x) => x.id === id);
  if (at >= 0) idx[at] = item; else idx.push(item);
  await kvStore(env).put("idx", JSON.stringify(idx));
  return post;
}

function imagePublicUrl(origin, key) {
  return origin + "/image/" + key.split("/").map(encodeURIComponent).join("/");
}

async function handleImage(request, env, key, url) {
  if (!validBlogKey(key)) return fail(404, "图片不存在");
  const head = await bucket(env).head(key);
  if (!head) return fail(404, "图片不存在");
  const etag = head.httpEtag || '"' + key + '"';
  const headers = baseHeaders();
  headers.set("Cache-Control", "public, max-age=31536000, immutable");
  headers.set("ETag", etag);
  headers.set("Accept-Ranges", "bytes");
  const ct = (head.httpMetadata && head.httpMetadata.contentType) || "application/octet-stream";
  headers.set("Content-Type", ct);
  headers.set("Content-Security-Policy", "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  const download = url.searchParams.get("download") === "1";
  headers.set("Content-Disposition", contentDisposition(key.split("/").pop() || "image", !download));
  if (request.method === "HEAD") {
    headers.set("Content-Length", String(head.size || 0));
    return new Response(null, { status: 200, headers });
  }
  if (etagHit(request.headers.get("If-None-Match"), etag)) return new Response(null, { status: 304, headers });
  const size = head.size || 0;
  const range = parseRange(request.headers.get("Range"), size);
  if (range && range.invalid) {
    headers.set("Content-Range", "bytes */" + size);
    return new Response(null, { status: 416, headers });
  }
  const obj = await bucket(env).get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!obj) return fail(404, "图片不存在");
  if (range) {
    headers.set("Content-Range", "bytes " + range.start + "-" + range.end + "/" + size);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(obj.body, { status: 200, headers });
}

async function handleMusicAsset(request, env, key) {
  if (!validMusicKey(key)) return fail(404, "音频不存在");
  const head = await bucket(env).head(key);
  if (!head) return fail(404, "音频不存在");
  const etag = head.httpEtag || '"' + key + '"';
  const headers = baseHeaders();
  headers.set("Cache-Control", "public, max-age=86400");
  headers.set("ETag", etag);
  headers.set("Accept-Ranges", "bytes");
  const ct = (head.httpMetadata && head.httpMetadata.contentType) || "audio/mpeg";
  headers.set("Content-Type", ct);
  headers.set("Content-Security-Policy", "default-src 'none'");
  headers.set("Cross-Origin-Resource-Policy", "cross-origin");
  headers.set("Content-Disposition", contentDisposition(key.split("/").pop() || "audio", true));
  if (request.method === "HEAD") {
    headers.set("Content-Length", String(head.size || 0));
    return new Response(null, { status: 200, headers });
  }
  if (etagHit(request.headers.get("If-None-Match"), etag)) return new Response(null, { status: 304, headers });
  const size = head.size || 0;
  const range = parseRange(request.headers.get("Range"), size);
  if (range && range.invalid) {
    headers.set("Content-Range", "bytes */" + size);
    return new Response(null, { status: 416, headers });
  }
  const obj = await bucket(env).get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!obj) return fail(404, "音频不存在");
  if (range) {
    headers.set("Content-Range", "bytes " + range.start + "-" + range.end + "/" + size);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(obj.body, { status: 200, headers });
}
async function handleMusicUpload(request, env, url) {
  await requireUser(request, env);
  requireOrigin(request);
  const len = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (len > MUSIC_MAX) return fail(413, "音频不能超过 15MB");
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength > MUSIC_MAX) return fail(413, "音频不能超过 15MB");
  if (!buf.byteLength) return fail(400, "没有收到文件");
  const name = url.searchParams.get("name") || "track.mp3";
  const type = sniffAudio(buf, name);
  if (!type) return fail(400, "仅支持 mp3、m4a、ogg、wav");
  const ext = /\.ogg$/i.test(name) ? ".ogg" : /\.wav$/i.test(name) ? ".wav" : /\.(m4a|aac)$/i.test(name) ? ".m4a" : ".mp3";
  const base = safeSegment(name).replace(/\.[a-z0-9]+$/i, "");
  const key = "music/" + newId() + "-" + base + ext;
  await bucket(env).put(key, buf, { httpMetadata: { contentType: type } });
  const origin = new URL(request.url).origin;
  const cfg = await getMusicCfg(env);
  if (!cfg.current) {
    cfg.current = key;
    cfg.enabled = true;
    cfg.v = 1;
    await kvStore(env).put("cfg:music", JSON.stringify({
      enabled: cfg.enabled,
      autoplay: cfg.autoplay,
      loop: cfg.loop,
      volume: cfg.volume,
      current: cfg.current,
      v: 1
    }));
  }
  return json({ ok: true, key, url: musicPublicUrl(origin, key), name: key.split("/").pop(), size: buf.byteLength, type, config: cfg });
}
async function handleMusicList(env, request) {
  const objects = await listAll(env, "music/");
  const origin = new URL(request.url).origin;
  const cfg = await getMusicCfg(env);
  return json({
    ok: true,
    config: cfg,
    tracks: objects.filter((o) => validMusicKey(o.key)).map((o) => ({
      key: o.key,
      name: o.key.split("/").pop(),
      size: o.size || 0,
      uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : "",
      url: musicPublicUrl(origin, o.key),
      current: cfg.current === o.key
    }))
  });
}
async function handleVisitor(request) {
  const cf = request.cf || {};
  return json({
    ok: true,
    ip: clientIp(request),
    city: cf.city || "未知",
    region: cf.region || cf.regionCode || "未知",
    country: cf.country || "未知"
  });
}

async function handlePosts(url, env) {
  let posts = publishedSorted(await getIndex(env));
  const cat = url.searchParams.get("cat") || "";
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (cat) posts = posts.filter((p) => p.category === cat);
  if (q) posts = posts.filter((p) => (p.title + " " + p.summary + " " + p.category).toLowerCase().includes(q));
  return json({ ok: true, posts, categories: CATEGORIES });
}

async function handlePost(request, env, ctx, id) {
  const post = await getPost(env, id);
  if (!post) return fail(404, "文章不存在");
  if (post.status !== "published") {
    const me = await readSession(request, env);
    if (!me) return fail(404, "文章不存在");
  } else {
    await recordView(env, ctx, clientIp(request), id);
  }
  const list = publishedSorted(await getIndex(env));
  const at = list.findIndex((p) => p.id === id);
  const prev = at > 0 ? { id: list[at - 1].id, title: list[at - 1].title } : null;
  const next = at >= 0 && at < list.length - 1 ? { id: list[at + 1].id, title: list[at + 1].title } : null;
  const fresh = post.status === "published" ? (await getPost(env, id)) || post : post;
  return json({ ok: true, post: fresh, prev, next });
}

async function handleLike(request, env, id) {
  requireOrigin(request);
  if (await tooMany("like/" + await shortHash(clientIp(request)), 30, 600)) return fail(429, "操作过于频繁，请稍后再试");
  const post = await getPost(env, id);
  if (!post || post.status !== "published") return fail(404, "文章不存在");
  const mark = cacheReq("like/" + await shortHash(clientIp(request) + ":" + id));
  if (await cacheMatch(mark)) return json({ ok: true, likes: post.likes || 0, liked: true, duplicate: true });
  await cachePut(mark, new Response("1", { headers: { "Cache-Control": "public, max-age=2592000" } }));
  try {
    post.likes = (post.likes || 0) + 1;
    await kvStore(env).put("post:" + id, JSON.stringify(post));
    const idx = await getIndex(env);
    const it = idx.find((x) => x.id === id);
    if (it) {
      it.likes = post.likes;
      await kvStore(env).put("idx", JSON.stringify(idx));
    }
  } catch (e) {
    await cacheDel("https://internal.hongui/like/" + await shortHash(clientIp(request) + ":" + id));
    throw e;
  }
  return json({ ok: true, likes: post.likes, liked: true, duplicate: false });
}

async function handleLogin(request, env) {
  assertConfigured(env);
  requireOrigin(request);
  const ip = clientIp(request);
  const ipKey = await shortHash(ip);
  if (memCount("login/" + ipKey, 900, false) >= 5 || await cacheMatch(cacheReq("lock/" + ipKey))) return fail(429, "尝试过多，请 15 分钟后再试");
  const body = await readJson(request, 8000);
  const ok = await credsOk(env, typeof body.user === "string" ? body.user : "", typeof body.pass === "string" ? body.pass : "");
  if (!ok) {
    memCount("login/" + ipKey, 900, true);
    const req = cacheReq("fail/" + ipKey);
    const prev = await cacheMatch(req);
    const n = (prev ? parseInt(await prev.text(), 10) || 0 : 0) + 1;
    const headers = { "Cache-Control": "public, max-age=900" };
    await cachePut(req, new Response(String(n), { headers }));
    if (n >= 5) await cachePut(cacheReq("lock/" + ipKey), new Response("1", { headers }));
    return fail(401, "账号或密码不正确");
  }
  MEM.delete("login/" + ipKey);
  await cacheDel("https://internal.hongui/fail/" + ipKey);
  await cacheDel("https://internal.hongui/lock/" + ipKey);
  const token = await makeToken(env, env.ADMIN_USER);
  return json({ ok: true, user: env.ADMIN_USER }, 200, { "Set-Cookie": sessionCookie(token, request, 604800) });
}
function handleLogout(request) {
  requireOrigin(request);
  return json({ ok: true }, 200, { "Set-Cookie": sessionCookie("", request, 0) });
}

async function handleAdminUpload(request, env, url) {
  await requireUser(request, env);
  requireOrigin(request);
  const len = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (len > IMAGE_MAX) return fail(413, "图片不能超过 5MB");
  const buf = new Uint8Array(await request.arrayBuffer());
  if (buf.byteLength > IMAGE_MAX) return fail(413, "图片不能超过 5MB");
  if (!buf.byteLength) return fail(400, "没有收到文件");
  const type = sniffImage(buf);
  if (!type) return fail(400, "仅支持 jpg、png、webp、gif");
  const ext = type === "image/png" ? ".png" : type === "image/jpeg" ? ".jpg" : type === "image/gif" ? ".gif" : ".webp";
  const base = safeSegment(url.searchParams.get("name") || "image").replace(/\.[a-z0-9]+$/i, "");
  const pair = url.searchParams.get("pair") || "";
  const pw = url.searchParams.get("w") || "";
  let key = "blog/" + newId() + "-" + base + ext;
  if (pair) {
    if (!/^[a-f0-9]{16}$/.test(pair) || (pw !== "1600" && pw !== "800") || type !== "image/webp") return fail(400, "封面参数不正确");
    key = "blog/covers/" + pair + "-" + pw + ".webp";
  }
  await bucket(env).put(key, buf, { httpMetadata: { contentType: type, cacheControl: "public, max-age=31536000, immutable" } });
  const origin = new URL(request.url).origin;
  return json({ ok: true, key, url: imagePublicUrl(origin, key) });
}
async function handleAdminImages(env) {
  const objects = await listAll(env, "blog/");
  const originHint = "";
  return json({
    ok: true,
    images: objects.map((o) => ({
      key: o.key,
      size: o.size || 0,
      uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : "",
      urlPath: "/image/" + o.key.split("/").map(encodeURIComponent).join("/")
    })).filter((x) => validBlogKey(x.key)),
    originHint
  });
}
async function listAll(env, prefix) {
  const out = [];
  let cursor;
  do {
    const page = await bucket(env).list({ prefix, cursor, limit: 1000 });
    out.push(...(page.objects || []));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor && out.length < 5000);
  return out;
}

const DC_WORDS = /amazon|\baws\b|google cloud|\bgcp\b|azure|microsoft|digitalocean|linode|akamai|vultr|choopa|\bovh|hetzner|alibaba|aliyun|tencent|huawei cloud|oracle|cloudflare|contabo|leaseweb|m247|datacamp|hostinger|hosting|server|\bvps\b|\bcloud\b|data ?cent(er|re)|\bcolo|ipxo|zenlayer|psychz|quadranet|frantech|buyvm|\bdmit\b|gcore|g-core|ucloud|volcengine|byteplus|kaopu|scaleway|ionos|godaddy|namecheap|upcloud|equinix|fastly|limestone|serverion|hostwinds|racknerd|colocrossing|cogent|incapsula|zscaler|nordvpn|expressvpn|mullvad|surfshark|private internet access|proxy|vpn/;
const MOBILE_WORDS = /\bmobile\b|cellular|wireless|\blte\b|\b5g\b|t-mobile|vodafone|docomo|softbank|\bkddi|airtel|reliance jio|telkomsel|\bais\b|dtac|globe telecom|smart communications|three\b|\bee\b|orange mobile|mobility/;
const ISP_WORDS = /telecom|unicom|chinanet|china mobile|cmnet|broadband|\bcable|comcast|charter|spectrum|\bcox\b|verizon|at&t|\bbt\b|sky\b|virgin|telefonica|deutsche telekom|\bntt\b|chunghwa|hinet|pccw|hkbn|singtel|starhub|telstra|optus|rogers|\bbell\b|shaw|free sas|orange|\bsfr\b|bouygues|telia|kpn|swisscom|fib(er|re)|\bdsl\b|cernet|education|university/;
function classifyNet(asn, org) {
  const o = String(org || "").toLowerCase();
  const reasons = [];
  const cloud = CLOUD_ASNS[Number(asn)];
  if (cloud) { reasons.push("ASN " + asn + " 属于 " + cloud); return { type: "dc", label: "数据中心/代理", confidence: "高", reasons }; }
  if (DC_WORDS.test(o)) { reasons.push("运营商名称包含云服务、托管或代理关键字"); return { type: "dc", label: "数据中心/代理", confidence: "中", reasons }; }
  if (/china mobile|cmnet|中国移动/.test(o)) { reasons.push("中国移动同时提供手机网络与家庭宽带，仅凭 ASN 无法区分"); return { type: "isp", label: "家庭宽带 / 移动网络", confidence: "中", reasons }; }
  if (MOBILE_WORDS.test(o)) { reasons.push("运营商名称更像移动蜂窝网络"); return { type: "mobile", label: "移动网络", confidence: "中", reasons }; }
  if (ISP_WORDS.test(o)) { reasons.push("运营商名称属于常见的宽带 / 电信运营商"); return { type: "isp", label: "家庭宽带", confidence: "中", reasons }; }
  reasons.push(o ? "没有明显的机房或代理特征" : "没有拿到运营商名称");
  return { type: "isp", label: "家庭宽带（推测）", confidence: "低", reasons };
}
async function handleIpInfo(request) {
  if (await tooMany("ipinfo/" + await shortHash(clientIp(request)), 60, 600)) return fail(429, "请求过于频繁，请稍后再试");
  const cf = request.cf || {};
  const ip = clientIp(request);
  const asn = Number(cf.asn || 0) || 0;
  const org = String(cf.asOrganization || "");
  const bm = cf.botManagement && typeof cf.botManagement === "object" ? cf.botManagement : null;
  const out = {
    ok: true,
    ip,
    ipVersion: ip === "未知" ? "未知" : ip.includes(":") ? "IPv6" : "IPv4",
    country: cf.country || "",
    continent: cf.continent || "",
    region: cf.region || "",
    regionCode: cf.regionCode || "",
    city: cf.city || "",
    timezone: cf.timezone || "",
    asn: asn || null,
    asOrganization: org,
    colo: cf.colo || "",
    httpProtocol: cf.httpProtocol || "",
    tlsVersion: cf.tlsVersion || "",
    tlsCipher: cf.tlsCipher || "",
    clientTcpRtt: typeof cf.clientTcpRtt === "number" ? cf.clientTcpRtt : null,
    botScore: bm && typeof bm.score === "number" ? bm.score : null,
    verifiedBot: bm && typeof bm.verifiedBot === "boolean" ? bm.verifiedBot : null,
    threatScore: typeof cf.threatScore === "number" ? cf.threatScore : null,
    net: classifyNet(asn, org),
    source: "Cloudflare 边缘节点（request.cf），未调用第三方接口"
  };
  return json(out);
}

let RAND_BLOCK = null;
function randBlock() {
  if (!RAND_BLOCK) { RAND_BLOCK = new Uint8Array(65536); crypto.getRandomValues(RAND_BLOCK); }
  return RAND_BLOCK;
}
function downStream(total) {
  const block = randBlock();
  let sent = 0;
  return new ReadableStream({
    pull(controller) {
      if (sent >= total) { controller.close(); return; }
      const n = Math.min(block.length, total - sent);
      controller.enqueue(n === block.length ? block.slice() : block.slice(0, n));
      sent += n;
    }
  }, { highWaterMark: 4 });
}
async function handleDown(request, url) {
  const h = baseHeaders();
  h.set("Cache-Control", "no-store, no-transform");
  h.set("Content-Type", "application/octet-stream");
  h.set("Pragma", "no-cache");
  h.set("Server-Timing", "edge;desc=\"" + String((request.cf && request.cf.colo) || "").replace(/[^A-Z0-9]/g, "") + "\"");
  if (await tooMany("down/" + await shortHash(clientIp(request)), 400, 600)) return fail(429, "测速过于频繁，请稍后再试");
  let n = parseInt(url.searchParams.get("bytes") || "1048576", 10);
  if (!Number.isFinite(n) || n < 1) n = 1024;
  n = Math.min(n, 32 * 1024 * 1024);
  h.set("Content-Length", String(n));
  if (request.method === "HEAD") return new Response(null, { status: 200, headers: h });
  return new Response(downStream(n), { status: 200, headers: h });
}
async function handleUp(request) {
  if (await tooMany("up/" + await shortHash(clientIp(request)), 400, 600)) return fail(429, "测速过于频繁，请稍后再试");
  const declared = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (declared > 16 * 1024 * 1024) return fail(413, "上传块过大");
  const reader = request.body && request.body.getReader ? request.body.getReader() : null;
  if (!reader) return json({ ok: true, bytes: 0 });
  let total = 0;
  while (true) {
    const step = await reader.read();
    if (step.done) break;
    total += step.value.byteLength;
    if (total > 16 * 1024 * 1024) return fail(413, "上传块过大");
  }
  return json({ ok: true, bytes: total });
}

async function driveUsage(env) {
  const req = cacheReq("drive-usage");
  const hit = await cacheMatch(req);
  if (hit) {
    try { return await hit.json(); } catch { /* recompute */ }
  }
  const objects = await listAll(env, "drive/");
  let bytes = 0;
  for (const o of objects) bytes += o.size || 0;
  const data = { bytes, count: objects.length, limit: R2_FREE, warn: bytes >= R2_WARN };
  await cachePut(req, new Response(JSON.stringify(data), { headers: { "Cache-Control": "public, max-age=60" } }));
  return data;
}
async function handleDriveList(env, url) {
  const rel = normalizeRel(url.searchParams.get("prefix") || "");
  if (rel == null) return fail(400, "路径不合法");
  const prefix = "drive/" + (rel ? rel + "/" : "");
  let cursor;
  const objects = [];
  const folders = [];
  do {
    const page = await bucket(env).list({ prefix, delimiter: "/", cursor, limit: 1000 });
    objects.push(...(page.objects || []));
    folders.push(...(page.delimitedPrefixes || []));
    cursor = page.truncated ? page.cursor : undefined;
  } while (cursor);
  const usage = await driveUsage(env);
  return json({
    ok: true,
    prefix: rel,
    folders: folders.map((p) => ({ key: p, name: p.replace(/\/$/, "").split("/").pop() })),
    files: objects.filter((o) => !o.key.endsWith("/.keep")).map((o) => ({
      key: o.key,
      name: o.key.split("/").pop(),
      size: o.size || 0,
      uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : "",
      contentType: (o.httpMetadata && o.httpMetadata.contentType) || ""
    })),
    usage
  });
}
async function handleDriveSearch(env, url) {
  const q = (url.searchParams.get("q") || "").trim().toLowerCase();
  if (!q) return fail(400, "请输入搜索词");
  const objects = await listAll(env, "drive/");
  const files = objects.filter((o) => !o.key.endsWith("/.keep") && o.key.toLowerCase().includes(q)).slice(0, 200).map((o) => ({
    key: o.key,
    name: o.key.split("/").pop(),
    size: o.size || 0,
    uploaded: o.uploaded ? new Date(o.uploaded).toISOString() : "",
    contentType: (o.httpMetadata && o.httpMetadata.contentType) || ""
  }));
  return json({ ok: true, files, usage: await driveUsage(env) });
}
async function handleMkdir(request, env) {
  const body = await readJson(request, 4000);
  const parent = normalizeRel(body.prefix || "");
  if (parent == null) return fail(400, "路径不合法");
  const name = safeSegment(body.name || "");
  if (!name || name === ".keep") return fail(400, "文件夹名称不合法");
  const rel = parent ? parent + "/" + name : name;
  const key = "drive/" + rel + "/.keep";
  if (await bucket(env).head(key)) return fail(409, "文件夹已存在");
  await bucket(env).put(key, new Uint8Array(), { httpMetadata: { contentType: "application/octet-stream" } });
  await cacheDel("https://internal.hongui/drive-usage");
  return json({ ok: true, key: "drive/" + rel + "/" });
}
function cleanType(t) {
  const s = String(t || "").split(";")[0].trim().toLowerCase();
  if (!/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(s)) return "application/octet-stream";
  return s;
}
async function handleSimpleUpload(request, env, url) {
  const dir = normalizeRel(url.searchParams.get("dir") || "");
  if (dir == null) return fail(400, "路径不合法");
  const name = safeSegment(url.searchParams.get("name") || "file");
  const rel = dir ? dir + "/" + name : name;
  const key = "drive/" + rel;
  const len = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (len > SIMPLE_UPLOAD) return fail(413, "大于 95MB 的文件请使用分片上传");
  if (await bucket(env).head(key) && url.searchParams.get("overwrite") !== "1") return fail(409, "文件已存在");
  const type = cleanType(request.headers.get("Content-Type"));
  let payload = request.body;
  if (payload && !request.headers.get("Content-Length")) {
    const buf = await request.arrayBuffer();
    if (buf.byteLength > SIMPLE_UPLOAD) return fail(413, "大于 95MB 的文件请使用分片上传");
    payload = buf;
  }
  await bucket(env).put(key, payload, { httpMetadata: { contentType: type } });
  await cacheDel("https://internal.hongui/drive-usage");
  return json({ ok: true, key, name });
}
async function handleMpuCreate(request, env) {
  const body = await readJson(request, 8000);
  const dir = normalizeRel(body.dir || "");
  if (dir == null) return fail(400, "路径不合法");
  const name = safeSegment(body.name || "file");
  const size = Number(body.size || 0);
  if (!Number.isFinite(size) || size < 0) return fail(400, "文件大小不正确");
  if (size > MAX_DRIVE) return fail(413, "单文件上限 2GB");
  const key = "drive/" + (dir ? dir + "/" : "") + name;
  if (await bucket(env).head(key) && !body.overwrite) return fail(409, "文件已存在");
  const mp = await bucket(env).createMultipartUpload(key, { httpMetadata: { contentType: cleanType(body.type) } });
  return json({ ok: true, key: mp.key || key, uploadId: mp.uploadId });
}
async function handleMpuPart(request, env, url) {
  const key = url.searchParams.get("key") || "";
  const uploadId = url.searchParams.get("uploadId") || "";
  const partNumber = parseInt(url.searchParams.get("partNumber") || "0", 10);
  if (!validDriveKey(key) || !uploadId || partNumber < 1 || partNumber > 10000) return fail(400, "分片参数不正确");
  if (!request.body) return fail(400, "缺少分片内容");
  const isLast = url.searchParams.get("last") === "1";
  const len = parseInt(request.headers.get("Content-Length") || "0", 10);
  if (len > 12 * 1024 * 1024) return fail(413, "分片过大");
  if (!isLast && len && len < 5 * 1024 * 1024) return fail(400, "除最后一片外，每片至少 5MB");
  const mp = bucket(env).resumeMultipartUpload(key, uploadId);
  try {
    const uploaded = await mp.uploadPart(partNumber, request.body);
    return json({ ok: true, partNumber: uploaded.partNumber || partNumber, etag: uploaded.etag });
  } catch {
    return fail(400, "分片上传失败，请重试这一片");
  }
}
async function handleMpuComplete(request, env) {
  const body = await readJson(request, 200000);
  const key = body.key || "";
  if (!validDriveKey(key) || !body.uploadId || !Array.isArray(body.parts) || !body.parts.length) return fail(400, "合并参数不正确");
  const parts = body.parts.map((p) => ({ partNumber: Number(p.partNumber), etag: String(p.etag || "") })).filter((p) => p.partNumber && p.etag);
  const mp = bucket(env).resumeMultipartUpload(key, body.uploadId);
  try {
    const obj = await mp.complete(parts);
    const size = obj && obj.size != null ? obj.size : (await bucket(env).head(key) || {}).size || 0;
    if (size > MAX_DRIVE) {
      await bucket(env).delete(key);
      return fail(413, "文件超过 2GB");
    }
    await cacheDel("https://internal.hongui/drive-usage");
    return json({ ok: true, key, size });
  } catch {
    return fail(400, "合并分片失败，请重试");
  }
}
async function handleMpuAbort(request, env) {
  const body = await readJson(request, 4000);
  if (!validDriveKey(body.key || "") || !body.uploadId) return fail(400, "参数不正确");
  const mp = bucket(env).resumeMultipartUpload(body.key, body.uploadId);
  try { await mp.abort(); } catch { /* already gone */ }
  return json({ ok: true });
}
async function copyR2(env, from, to) {
  const obj = await bucket(env).get(from);
  if (!obj) return false;
  await bucket(env).put(to, obj.body, { httpMetadata: obj.httpMetadata, customMetadata: obj.customMetadata });
  return true;
}
async function keysUnder(env, prefix) {
  const all = await listAll(env, prefix);
  return all.map((o) => o.key);
}
async function handleDriveDelete(request, env) {
  const body = await readJson(request, 100000);
  const keys = (Array.isArray(body.keys) ? body.keys : []).filter((k) => typeof k === "string").slice(0, 200);
  if (!keys.length) return fail(400, "没有选择文件");
  for (const key of keys) {
    if (key.endsWith("/")) {
      if (!validDriveKey(key, true)) return fail(400, "路径不合法");
      if (key === "drive/") return fail(400, "不能删除网盘根目录");
      const all = await keysUnder(env, key);
      for (const k of all) await bucket(env).delete(k);
    } else {
      if (!validDriveKey(key)) return fail(400, "路径不合法");
      await bucket(env).delete(key);
    }
  }
  await cacheDel("https://internal.hongui/drive-usage");
  return json({ ok: true });
}
async function handleDriveRename(request, env) {
  const body = await readJson(request, 8000);
  const key = String(body.key || "");
  const name = safeSegment(body.name || "");
  if (!name) return fail(400, "名称不合法");
  if (key.endsWith("/")) {
    if (!validDriveKey(key, true) || key === "drive/") return fail(400, "路径不合法");
    const parent = key.slice(0, -1).split("/").slice(0, -1).join("/");
    const dest = (parent ? parent : "drive") + "/" + name + "/";
    if (!dest.startsWith("drive/") || dest.includes("..")) return fail(400, "路径不合法");
    if (dest === key) return json({ ok: true, key });
    const all = await keysUnder(env, key);
    for (const old of all) {
      const next = dest + old.slice(key.length);
      if (!await copyR2(env, old, next)) return fail(500, "重命名中断，请重试");
    }
    for (const old of all) await bucket(env).delete(old);
    await cacheDel("https://internal.hongui/drive-usage");
    return json({ ok: true, key: dest });
  }
  if (!validDriveKey(key)) return fail(400, "路径不合法");
  const parent = key.split("/").slice(0, -1).join("/");
  const dest = parent + "/" + name;
  if (!validDriveKey(dest)) return fail(400, "路径不合法");
  if (dest === key) return json({ ok: true, key });
  if (await bucket(env).head(dest)) return fail(409, "目标名称已存在");
  if (!await copyR2(env, key, dest)) return fail(404, "文件不存在");
  await bucket(env).delete(key);
  await cacheDel("https://internal.hongui/drive-usage");
  return json({ ok: true, key: dest });
}
async function handleDriveMove(request, env) {
  const body = await readJson(request, 100000);
  let dest = String(body.dest || "drive/");
  if (dest === "drive") dest = "drive/";
  if (!dest.endsWith("/")) dest += "/";
  if (!(dest === "drive/" || (dest.startsWith("drive/") && !dest.includes("..") && !dest.includes("//")))) return fail(400, "目标路径不合法");
  const keys = (Array.isArray(body.keys) ? body.keys : []).filter((k) => typeof k === "string").slice(0, 100);
  if (!keys.length) return fail(400, "没有选择文件");
  for (const key of keys) {
    if (key.endsWith("/")) {
      if (!validDriveKey(key, true) || key === "drive/") return fail(400, "路径不合法");
      if (dest.startsWith(key)) return fail(400, "不能移动到自身内部");
      const base = key.replace(/\/$/, "").split("/").pop();
      const nextPrefix = dest + base + "/";
      const all = await keysUnder(env, key);
      for (const old of all) {
        if (!await copyR2(env, old, nextPrefix + old.slice(key.length))) return fail(500, "移动中断，请重试");
      }
      for (const old of all) await bucket(env).delete(old);
    } else {
      if (!validDriveKey(key)) return fail(400, "路径不合法");
      const name = key.split("/").pop();
      const next = dest + name;
      if (next === key) continue;
      if (await bucket(env).head(next)) return fail(409, "目标处已有同名文件：" + name);
      if (!await copyR2(env, key, next)) return fail(404, "文件不存在");
      await bucket(env).delete(key);
    }
  }
  await cacheDel("https://internal.hongui/drive-usage");
  return json({ ok: true });
}
async function handleDriveFile(request, env, url, keyOverride, shared) {
  const key = keyOverride || url.searchParams.get("key") || "";
  if (!validDriveKey(key)) return fail(400, "路径不合法");
  const head = await bucket(env).head(key);
  if (!head) return fail(404, "文件不存在");
  const etag = head.httpEtag || '"' + key.length + '"';
  const rawType = (head.httpMetadata && head.httpMetadata.contentType) || "application/octet-stream";
  const force = dangerousFile(key, rawType);
  const headers = baseHeaders();
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", etag);
  headers.set("Cache-Control", "private, no-store");
  if (shared) headers.set("X-Robots-Tag", "noindex");
  headers.set("Content-Type", force ? "application/octet-stream" : rawType);
  headers.set("Content-Security-Policy", /^application\/pdf/i.test(rawType) && !force ? "default-src 'none'; style-src 'unsafe-inline'" : "default-src 'none'; style-src 'unsafe-inline'; sandbox");
  const download = url.searchParams.get("download") === "1" || force;
  headers.set("Content-Disposition", contentDisposition(key.split("/").pop() || "file", !download));
  const size = head.size || 0;
  if (request.method === "HEAD") {
    headers.set("Content-Length", String(size));
    return new Response(null, { status: 200, headers });
  }
  if (etagHit(request.headers.get("If-None-Match"), etag)) return new Response(null, { status: 304, headers });
  const range = parseRange(request.headers.get("Range"), size);
  if (range && range.invalid) {
    headers.set("Content-Range", "bytes */" + size);
    return new Response(null, { status: 416, headers });
  }
  const obj = await bucket(env).get(key, range ? { range: { offset: range.start, length: range.end - range.start + 1 } } : undefined);
  if (!obj) return fail(404, "文件不存在");
  if (range) {
    headers.set("Content-Range", "bytes " + range.start + "-" + range.end + "/" + size);
    headers.set("Content-Length", String(range.end - range.start + 1));
    return new Response(obj.body, { status: 206, headers });
  }
  headers.set("Content-Length", String(size));
  return new Response(obj.body, { status: 200, headers });
}

const VISION_HINT = "当前档位不支持图片或视频关键帧理解，请切换到「通用」档，或移除图片后再发送";
function normalizeChatMessages(list, allowImages, maxImages, maxImageLen) {
  if (!Array.isArray(list)) return [];
  const out = [];
  let imageTotal = 0;
  for (const m of list.slice(-30)) {
    if (!m || (m.role !== "user" && m.role !== "assistant")) continue;
    if (typeof m.content === "string") {
      if (m.content) out.push({ role: m.role, content: m.content.slice(0, 40000) });
      continue;
    }
    if (!Array.isArray(m.content) || m.role !== "user") continue;
    const parts = [];
    for (const p of m.content) {
      if (!p || typeof p !== "object") continue;
      if (p.type === "text" && typeof p.text === "string") parts.push({ type: "text", text: p.text.slice(0, 40000) });
      else if (p.type === "image_url" && p.image_url && typeof p.image_url.url === "string") {
        const url = p.image_url.url;
        if (!/^data:image\/(?:jpeg|png|webp|gif);base64,/.test(url)) continue;
        if (!allowImages) throw HttpError(400, VISION_HINT);
        if (url.length > maxImageLen) throw HttpError(400, "单张图片过大，请压缩后再试");
        imageTotal += 1;
        if (imageTotal > maxImages) throw HttpError(400, "单次最多 " + maxImages + " 张图片");
        parts.push({ type: "image_url", image_url: { url } });
      }
    }
    if (parts.length) out.push({ role: m.role, content: parts });
  }
  return out;
}
function messageTextLen(messages) {
  let n = 0;
  for (const m of messages) {
    if (typeof m.content === "string") n += m.content.length;
    else if (Array.isArray(m.content)) for (const p of m.content) if (p.type === "text") n += p.text.length;
  }
  return n;
}
async function postChat(tier, payload, signal) {
  return fetch(apiRoot(tier.baseUrl) + "/chat/completions", {
    method: "POST",
    headers: { Authorization: "Bearer " + tier.apiKey, "Content-Type": "application/json", Accept: payload.stream ? "text/event-stream" : "application/json" },
    body: JSON.stringify(payload),
    signal
  });
}
async function callChat(tier, payload, signal) {
  let res = await postChat(tier, payload, signal);
  if ((res.status === 400 || res.status === 422) && payload.stream_options) {
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    const retry = Object.assign({}, payload);
    delete retry.stream_options;
    res = await postChat(tier, retry, signal);
  }
  return res;
}
function sseLine(obj) {
  return "data: " + JSON.stringify(obj) + "\n\n";
}
function stripThinkText(s) {
  let t = String(s || "");
  t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
  t = t.replace(/<think>[\s\S]*$/i, "");
  const close = t.toLowerCase().lastIndexOf("</think>");
  if (close >= 0) t = t.slice(close + 8);
  return t;
}
function chatJsonToSse(data) {
  const choice = data && data.choices && data.choices[0] || {};
  const msg = choice.message || {};
  const raw = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((p) => p && p.text || "").join("") : "";
  const content = stripThinkText(raw).replace(/^\s+/, "");
  if (!content) return "";
  let out = sseLine({ choices: [{ delta: { content }, finish_reason: choice.finish_reason || null }] });
  if (data.usage) out += sseLine({ choices: [], usage: data.usage });
  return out + "data: [DONE]\n\n";
}
function limitedStream(body, ac, ms) {
  const { readable, writable } = new TransformStream();
  const timer = setTimeout(() => ac.abort(), ms);
  body.pipeTo(writable).catch(() => {}).finally(() => clearTimeout(timer));
  return readable;
}
// 流式 <think>…</think> 过滤器：跨分片安全，思考内容整段丢弃
function thinkFilter() {
  const OPEN = "<think>", CLOSE = "</think>";
  let inThink = false, pend = "", started = false;
  const tailKeep = (s, tag) => {
    const low = s.toLowerCase();
    for (let k = Math.min(tag.length - 1, s.length); k > 0; k--) if (tag.startsWith(low.slice(-k))) return k;
    return 0;
  };
  return {
    get thinking() { return inThink; },
    feed(text) {
      let s = pend + String(text || "");
      pend = "";
      let out = "";
      let sawThink = false;
      while (s) {
        const low = s.toLowerCase();
        if (inThink) {
          sawThink = true;
          const i = low.indexOf(CLOSE);
          if (i < 0) { const k = tailKeep(s, CLOSE); pend = k ? s.slice(-k) : ""; s = ""; break; }
          s = s.slice(i + CLOSE.length);
          inThink = false;
          continue;
        }
        const i = low.indexOf(OPEN);
        const j = low.indexOf(CLOSE);
        if (j >= 0 && (i < 0 || j < i)) { out += s.slice(0, j); s = s.slice(j + CLOSE.length); continue; }
        if (i < 0) {
          const k = tailKeep(s, OPEN);
          out += k ? s.slice(0, -k) : s;
          pend = k ? s.slice(-k) : "";
          s = "";
          break;
        }
        out += s.slice(0, i);
        s = s.slice(i + OPEN.length);
        inThink = true;
      }
      if (!started) { out = out.replace(/^\s+/, ""); if (out) started = true; }
      return { text: out, thinking: sawThink || inThink };
    },
    flush() { const r = inThink ? "" : pend; pend = ""; return r; }
  };
}
function stripReasoningSse(body) {
  const dec = new TextDecoder();
  const enc = new TextEncoder();
  const tf = thinkFilter();
  let buf = "";
  let lastMark = 0;
  const mark = (controller) => {
    const now = Date.now();
    if (now - lastMark < 900) return;
    lastMark = now;
    controller.enqueue(enc.encode(sseLine({ hongui: "thinking" })));
  };
  const handle = (line, controller) => {
    const t = line.trim();
    if (!t) return;
    if (t.startsWith(":")) { controller.enqueue(enc.encode(": ping\n\n")); return; }
    if (!t.startsWith("data:")) return;
    const data = t.slice(5).trim();
    if (!data) return;
    if (data === "[DONE]") {
      const rest = tf.flush();
      if (rest) controller.enqueue(enc.encode(sseLine({ choices: [{ delta: { content: rest } }] })));
      controller.enqueue(enc.encode("data: [DONE]\n\n"));
      return;
    }
    let j;
    try { j = JSON.parse(data); } catch { return; }
    if (j && j.error) { controller.enqueue(enc.encode(sseLine({ error: sanitizePublicError(typeof j.error === "string" ? j.error : (j.error.message || "模型返回了错误")) || "模型返回了错误" }))); return; }
    const ch = j && j.choices && j.choices[0];
    let reasoning = false;
    let keep = !!(j && j.usage);
    if (ch) {
      const d = ch.delta || ch.message || {};
      if ((typeof d.reasoning_content === "string" && d.reasoning_content) || (typeof d.reasoning === "string" && d.reasoning)) reasoning = true;
      for (const o of [ch.delta, ch.message]) {
        if (!o) continue;
        delete o.reasoning_content;
        delete o.reasoning;
        delete o.reasoning_details;
        if (typeof o.content === "string") {
          const r = tf.feed(o.content);
          if (r.thinking) reasoning = true;
          if (r.text) { o.content = r.text; keep = true; } else delete o.content;
        }
        if (o.tool_calls) keep = true;
      }
      if (ch.finish_reason) keep = true;
    }
    if (reasoning) mark(controller);
    if (keep) controller.enqueue(enc.encode(sseLine(j)));
  };
  return body.pipeThrough(new TransformStream({
    start(controller) { controller.enqueue(enc.encode(": ok\n\n")); },
    transform(chunk, controller) {
      buf += dec.decode(chunk, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop();
      for (const line of lines) handle(line, controller);
    },
    flush(controller) {
      if (buf) handle(buf, controller);
      const rest = tf.flush();
      if (rest) controller.enqueue(enc.encode(sseLine({ choices: [{ delta: { content: rest } }] })));
    }
  }));
}
function aiAbort(request, ms) {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), ms);
  if (request && request.signal) {
    if (request.signal.aborted) ac.abort();
    else request.signal.addEventListener("abort", () => ac.abort());
  }
  return { ac, timer };
}
function aiConnectError(e) {
  if (e && (e.name === "TimeoutError" || e.name === "AbortError")) return fail(504, "模型响应超时，请重试");
  return fail(502, "无法连接模型服务，请检查该档位的 API 地址是否可用");
}
function upstreamFail(status, raw) {
  const msg = friendlyAiError(status, raw);
  return fail(status === 429 ? 429 : status === 408 || status === 504 ? 504 : status >= 500 || status === 401 || status === 403 || status === 404 ? 502 : 400, msg);
}
function tierMissingKey(tier) {
  return fail(400, "「" + AI_TIER_LABEL[tier.id] + "」档未配置密钥，请管理员在 Cloudflare 中设置加密 Secret " + tier.secretName);
}
async function consumeGuestQuota(request, cfg) {
  const ip = clientIp(request);
  const day = new Date().toISOString().slice(0, 10);
  const req = cacheReq("aiguest/" + await shortHash(ip + ":" + day));
  const hit = await cacheMatch(req);
  const used = hit ? parseInt(await hit.text(), 10) || 0 : 0;
  const g = GATE_OF.get(request);
  if (used >= guestLimitFor(request, cfg)) return fail(429, g && g.mode === "soft" ? "受限模式下今日体验次数已用完（完成人机验证后可恢复正常额度）" : "今日体验次数已用完");
  if (g && g.mode === "soft" && await tooMany("aisoft/" + await shortHash(ip), 1, 20)) return fail(429, "受限模式下请稍等 20 秒再发送");
  await cachePut(req, new Response(String(used + 1), { headers: { "Cache-Control": "public, max-age=86400" } }));
  return null;
}
function lastUserText(list) {
  if (!Array.isArray(list)) return "";
  for (let i = list.length - 1; i >= 0; i--) {
    const m = list[i];
    if (!m || m.role !== "user") continue;
    if (typeof m.content === "string") return m.content;
    if (Array.isArray(m.content)) return m.content.filter((p) => p && p.type === "text" && typeof p.text === "string").map((p) => p.text).join("\n");
    return "";
  }
  return "";
}
async function handleAiChat(request, env, ctx) {
  const me = await readSession(request, env);
  const cfg = mergeAi(await getAiSaved(env), env);
  if (!me && !cfg.allowGuest) return fail(401, "AI 对话目前仅管理员可用，请先登录");
  const body = await readJson(request, me ? 16 * 1024 * 1024 : 3 * 1024 * 1024);
  const tierId = pickTier(body.tier, cfg.defaultTier);
  const tier = cfg.tiers[tierId];
  if (!tier.apiKey) return tierMissingKey(tier);
  if (tier.kind === "image") return handleAiImage(request, env, cfg, tier, me, body);
  const mode = AI_MODES.includes(body.mode) ? body.mode : "general";
  const messages = normalizeChatMessages(body.messages, !!tier.supportsImages && (!!me || !!cfg.guestImages), me ? 8 : 2, me ? 3000000 : 1200000);
  if (!messages.length) return fail(400, "请输入内容");
  const limit = me ? 60000 : 4000;
  if (messageTextLen(messages) > limit) return fail(400, me ? "输入过长，请精简后再发送" : "游客单次输入过长，请缩短到 4000 字以内");
  if (!me) {
    const q = await consumeGuestQuota(request, cfg);
    if (q) return q;
  }
  const cap = me ? tier.maxTokens : guestMaxTokens(tier);
  const payload = {
    model: tier.model,
    messages: [{ role: "system", content: [HARD_AI_FALLBACK, (cfg.systemPrompt && String(cfg.systemPrompt).trim()) || DEFAULT_SYSTEM_PROMPT, cfg.modePrompts[mode] || cfg.modePrompts.general].filter(Boolean).join("\n\n") }, ...messages],
    temperature: clampNum(body.temperature, 0, 2, tier.temperature),
    max_tokens: clampInt(body.maxTokens, 64, cap, Math.min(tier.maxTokens, cap)),
    stream: !!tier.stream
  };
  if (tier.topP > 0) payload.top_p = tier.topP;
  if (tier.thinking) payload.chat_template_kwargs = { enable_thinking: true };
  if (payload.stream) payload.stream_options = { include_usage: true };
  const { ac, timer } = aiAbort(request, payload.stream ? (tier.thinking ? 180000 : 90000) : (tier.thinking ? 280000 : 150000));
  let res;
  try {
    res = await callChat(tier, payload, ac.signal);
  } catch (e) {
    clearTimeout(timer);
    return aiConnectError(e);
  }
  const h = baseHeaders();
  h.set("Content-Type", "text/event-stream; charset=utf-8");
  h.set("Cache-Control", "no-store");
  h.set("X-Accel-Buffering", "no");
  if (!res.ok) {
    clearTimeout(timer);
    let raw = "";
    try { raw = await res.text(); } catch { /* ignore */ }
    return upstreamFail(res.status, raw);
  }
  const ct = (res.headers.get("content-type") || "").toLowerCase();
  if (payload.stream && ct.includes("text/event-stream") && res.body) {
    clearTimeout(timer);
    return new Response(limitedStream(stripReasoningSse(res.body), ac, (tier.thinking ? 15 : 6) * 60 * 1000), { status: 200, headers: h });
  }
  let data;
  try {
    data = JSON.parse(await res.text());
  } catch (e) {
    clearTimeout(timer);
    if (e && (e.name === "AbortError" || e.name === "TimeoutError")) return fail(504, "模型响应超时，请重试");
    return fail(502, "模型返回的内容无法解析");
  }
  clearTimeout(timer);
  const sse = chatJsonToSse(data);
  if (!sse) {
    const msg = data && data.error && (data.error.message || data.error);
    return fail(502, msg ? friendlyAiError(400, String(msg)) : "模型没有返回内容，请重试");
  }
  return new Response(sse, { status: 200, headers: h });
}
function b64FromBuffer(buf) {
  const bytes = new Uint8Array(buf);
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(s);
}
function imageMimeOf(b64) {
  if (b64.startsWith("/9j/")) return "image/jpeg";
  if (b64.startsWith("iVBOR")) return "image/png";
  if (b64.startsWith("UklG")) return "image/webp";
  if (b64.startsWith("R0lG")) return "image/gif";
  return "image/png";
}
// 兼容 NVIDIA genai 常见返回：artifacts[0].base64 / image / images[0] / data[0].b64_json / output[0] / url
function pickGenaiImage(data) {
  if (!data || typeof data !== "object") return {};
  let filtered = false;
  const reasons = [];
  const cands = [];
  const push = (v) => {
    if (v == null) return;
    if (typeof v === "string") { cands.push(v); return; }
    if (Array.isArray(v)) { v.forEach(push); return; }
    if (typeof v === "object") {
      const fr = v.finishReason || v.finish_reason;
      if (fr) reasons.push(String(fr));
      push(v.base64 || v.b64_json || v.b64 || v.image || v.image_base64 || v.data || v.url || v.image_url);
    }
  };
  push(data.artifacts);
  push(data.images);
  push(data.image);
  push(data.data);
  push(data.output);
  push(data.b64_json || data.base64 || data.url);
  if (data.finishReason || data.finish_reason) reasons.push(String(data.finishReason || data.finish_reason));
  if (reasons.some((r) => /filter|nsfw|safety|blocked|moderat/i.test(r))) filtered = true;
  for (const c of cands) {
    const s = String(c).trim();
    if (/^data:image\/(?:png|jpeg|jpg|webp|gif);base64,/i.test(s)) return { dataUrl: s.replace(/^data:image\/jpg/i, "data:image/jpeg"), filtered };
    if (/^https:\/\//i.test(s)) return { url: s, filtered };
    const b = s.replace(/\s+/g, "");
    if (b.length > 200 && /^[A-Za-z0-9+/_-]+=*$/.test(b)) {
      const std = b.replace(/-/g, "+").replace(/_/g, "/");
      return { dataUrl: "data:" + imageMimeOf(std) + ";base64," + std, filtered };
    }
  }
  return { filtered, reasons };
}
async function genaiPost(tier, payload, signal) {
  const res = await fetch(apiRoot(tier.baseUrl) + "/" + String(tier.model).replace(/^\/+/, ""), {
    method: "POST",
    headers: { Authorization: "Bearer " + tier.apiKey, Accept: "application/json", "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    signal
  });
  if (res.status !== 202) return res;
  // NVCF 异步：带 NVCF-REQID 轮询结果
  const reqId = res.headers.get("nvcf-reqid") || res.headers.get("NVCF-REQID");
  try { await res.arrayBuffer(); } catch { /* ignore */ }
  if (!reqId || !/^[A-Za-z0-9-]{8,80}$/.test(reqId)) return res;
  for (let i = 0; i < 80; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const p = await fetch("https://api.nvcf.nvidia.com/v2/nvcf/pexec/status/" + reqId, {
      headers: { Authorization: "Bearer " + tier.apiKey, Accept: "application/json" },
      signal
    });
    if (p.status !== 202) return p;
    try { await p.arrayBuffer(); } catch { /* ignore */ }
  }
  return new Response(JSON.stringify({ error: "timeout" }), { status: 504 });
}
async function generateImage(tier, prompt, size, seed, steps, signal) {
  const dims = AI_IMAGE_SIZES[size] || AI_IMAGE_SIZES["1:1"];
  const payload = { prompt, width: dims[0], height: dims[1], seed, steps };
  let res = await genaiPost(tier, payload, signal);
  let used = dims;
  if ((res.status === 400 || res.status === 422) && dims[0] !== dims[1]) {
    try { await res.arrayBuffer(); } catch { /* ignore */ }
    used = AI_IMAGE_SIZES["1:1"];
    res = await genaiPost(tier, Object.assign({}, payload, { width: used[0], height: used[1] }), signal);
  }
  const raw = await res.text();
  if (!res.ok) return { error: upstreamFail(res.status, raw) };
  let data;
  try { data = JSON.parse(raw); } catch { return { error: fail(502, "画图服务返回的内容无法解析") }; }
  const pick = pickGenaiImage(data);
  let dataUrl = pick.dataUrl || "";
  if (!dataUrl && pick.url) {
    try {
      const u = new URL(pick.url);
      if (u.protocol !== "https:") throw new Error("bad");
      let r = await fetch(u.toString(), { signal });
      if ((r.status === 401 || r.status === 403) && /(^|\.)nvidia\.com$/i.test(u.hostname)) r = await fetch(u.toString(), { headers: { Authorization: "Bearer " + tier.apiKey }, signal });
      const ct = (r.headers.get("content-type") || "").toLowerCase();
      const buf = await r.arrayBuffer();
      if (r.ok && buf.byteLength > 0 && buf.byteLength < 15 * 1024 * 1024) {
        const b64 = b64FromBuffer(buf);
        dataUrl = "data:" + (/^image\/(png|jpeg|webp|gif)/.test(ct) ? ct.split(";")[0] : imageMimeOf(b64)) + ";base64," + b64;
      }
    } catch (e) {
      if (e && e.name === "AbortError") throw e;
    }
  }
  if (!dataUrl) {
    if (pick.filtered) return { error: fail(400, "这段描述被画图服务的内容安全策略拦截了，请换一种描述再试") };
    return { error: fail(502, "画图服务没有返回图片，请重试") };
  }
  return { dataUrl, width: used[0], height: used[1], filtered: pick.filtered };
}
async function handleAiImage(request, env, cfg, tier, me, body) {
  const prompt = String(body.prompt != null ? body.prompt : lastUserText(body.messages)).replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, "").trim();
  if (!prompt) return fail(400, "请用文字描述想生成的画面");
  if (prompt.length > (me ? 4000 : 1500)) return fail(400, "画面描述过长，请缩短到 " + (me ? 4000 : 1500) + " 字以内");
  const size = Object.prototype.hasOwnProperty.call(AI_IMAGE_SIZES, body.size) ? body.size : "1:1";
  const seedIn = Number(body.seed);
  const seed = Number.isInteger(seedIn) && seedIn >= 0 && seedIn <= 4294967295 ? seedIn : Math.floor(Math.random() * 2147483647);
  if (!me) {
    const q = await consumeGuestQuota(request, cfg);
    if (q) return q;
  }
  const { ac, timer } = aiAbort(request, 150000);
  try {
    const r = await generateImage(tier, prompt, size, seed, tier.steps || 50, ac.signal);
    if (r.error) return r.error;
    const h = baseHeaders();
    h.set("Content-Type", "application/json; charset=utf-8");
    h.set("Cache-Control", "no-store");
    return new Response(JSON.stringify({ ok: true, kind: "image", image: r.dataUrl, width: r.width, height: r.height, seed, size }), { status: 200, headers: h });
  } catch (e) {
    return aiConnectError(e);
  } finally {
    clearTimeout(timer);
  }
}
async function oneShotChat(tier, messages, maxTokens, temperature, timeoutMs) {
  const payload = { model: tier.model, messages, temperature, max_tokens: maxTokens, stream: false };
  if (tier.topP > 0) payload.top_p = tier.topP;
  if (tier.thinking) payload.chat_template_kwargs = { enable_thinking: false };
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), timeoutMs);
  try {
    const res = await callChat(tier, payload, ac.signal);
    const raw = await res.text();
    if (!res.ok) return { error: upstreamFail(res.status, raw) };
    let data;
    try { data = JSON.parse(raw); } catch { return { error: fail(502, "模型返回的内容无法解析") }; }
    const msg = data && data.choices && data.choices[0] && data.choices[0].message || {};
    const content = typeof msg.content === "string" ? msg.content : Array.isArray(msg.content) ? msg.content.map((p) => p && p.text || "").join("") : "";
    const reasoning = typeof msg.reasoning_content === "string" ? msg.reasoning_content : typeof msg.reasoning === "string" ? msg.reasoning : "";
    return { content: stripThinkText(content).trim(), hasReasoning: !!reasoning, data };
  } catch (e) {
    return { error: aiConnectError(e) };
  } finally {
    clearTimeout(timer);
  }
}
async function handleAdminAiCall(request, env) {
  const body = await readJson(request, 200000);
  const cfg = mergeAi(await getAiSaved(env), env);
  const tier = cfg.tiers[pickChatTier(body.tier, cfg.adminTier)];
  if (!tier.apiKey) return tierMissingKey(tier);
  const action = body.action === "polish" ? "polish" : "summary";
  const content = String(body.content || "").slice(0, 8000);
  const title = cleanLine(body.title, 100);
  if (!content.trim()) return fail(400, "没有可供处理的正文");
  const prompt = action === "summary"
    ? "请用简体中文为下面的文章写一段 80 到 140 字的摘要，只输出摘要本身。\n标题：" + title + "\n正文：\n" + content
    : "请用简体中文润色下面的 Markdown 正文，保留结构与原意，只输出润色后的全文。\n" + content;
  const r = await oneShotChat(tier, [
    { role: "system", content: cfg.modePrompts[action === "summary" ? "general" : "polish"] || cfg.systemPrompt },
    { role: "user", content: prompt }
  ], Math.min(tier.maxTokens, action === "summary" ? 1024 : 4096), 0.4, 120000);
  if (r.error) return r.error;
  if (!r.content) return fail(502, "模型没有返回内容");
  return json({ ok: true, text: r.content, tier: tier.id });
}
function checkBaseUrl(raw) {
  const base = apiRoot(raw);
  if (!base) return "";
  let u;
  try { u = new URL(base); } catch { throw HttpError(400, "API 地址不正确"); }
  if (u.protocol !== "https:" && u.protocol !== "http:") throw HttpError(400, "API 地址不正确");
  if (u.username || u.password) throw HttpError(400, "API 地址里不要带账号密码");
  return base;
}
function cleanKey(raw) {
  let k = String(raw || "").trim().replace(/^bearer\s+/i, "").replace(/^["'`]+|["'`]+$/g, "").trim();
  if (!k) return "";
  if (k.length > 400 || /[\s\u0000-\u001f]/.test(k)) throw HttpError(400, "API 密钥格式不正确（不能含空格或换行）");
  return k;
}
async function handleAiTest(request, env) {
  const body = await readJson(request, 20000);
  const cfg = mergeAi(await getAiSaved(env), env);
  const id = pickTier(body.tier, "general");
  const tier = Object.assign({}, cfg.tiers[id]);
  const o = body.override && typeof body.override === "object" ? body.override : {};
  if (o.model) tier.model = cleanLine(o.model, 160) || tier.model;
  if (o.baseUrl) tier.baseUrl = checkBaseUrl(o.baseUrl) || tier.baseUrl;
  if (!tier.apiKey) return tierMissingKey(tier);
  if (tier.kind === "image") {
    const ac = new AbortController();
    const timer = setTimeout(() => ac.abort(), 120000);
    try {
      const r = await generateImage(tier, "a small red apple on a white table, studio light", "1:1", 0, 4, ac.signal);
      if (r.error) return r.error;
      return json({ ok: true, message: "连接成功（已生成一张测试图）", tier: id, model: tier.model, reply: Math.round(r.dataUrl.length * 0.75 / 1024) + " KB" });
    } catch (e) {
      return aiConnectError(e);
    } finally {
      clearTimeout(timer);
    }
  }
  const r = await oneShotChat(tier, [{ role: "user", content: "请只回复：pong" }], 64, 0, 30000);
  if (r.error) return r.error;
  return json({
    ok: true,
    message: "连接成功",
    tier: id,
    model: tier.model,
    reply: sanitizePublicError(r.content).slice(0, 80),
    reasoning: r.hasReasoning
  });
}
async function handleAiSave(request, env) {
  const body = await readJson(request, 200000);
  const prev = (await getAiSaved(env)) || {};
  const prevTiers = prev.v >= 5 && prev.tiers && typeof prev.tiers === "object" ? prev.tiers : {};
  const bt = body.tiers && typeof body.tiers === "object" ? body.tiers : {};
  const tiers = {};
  for (const id of AI_TIERS) {
    const p = prevTiers[id] && typeof prevTiers[id] === "object" ? prevTiers[id] : {};
    const b = bt[id] && typeof bt[id] === "object" ? bt[id] : {};
    const dt = defaultTier(id);
    const next = {};
    const take = (k, fn) => { if (b[k] !== undefined) next[k] = fn(b[k]); else if (p[k] !== undefined) next[k] = p[k]; };
    take("model", (v) => cleanLine(v, 160));
    take("baseUrl", (v) => checkBaseUrl(v));
    if (dt.kind === "chat") {
      take("temperature", (v) => clampNum(v, 0, 2, dt.temperature));
      take("topP", (v) => clampNum(v, 0, 1, dt.topP));
      take("maxTokens", (v) => clampInt(v, 64, 32768, dt.maxTokens));
      take("supportsImages", (v) => !!v);
      take("stream", (v) => !!v);
    } else {
      take("steps", (v) => clampInt(v, 1, 100, dt.steps));
    }
    tiers[id] = next;
  }
  const prevModes = prev.modePrompts || {};
  const modes = body.modePrompts && typeof body.modePrompts === "object" ? body.modePrompts : {};
  const pickMode = (name) => String(modes[name] != null ? modes[name] : (prevModes[name] || "")).slice(0, 4000);
  const next = {
    v: 5,
    tiers,
    defaultTier: pickTier(body.defaultTier, pickTier(prev.defaultTier, "general")),
    guestTier: pickTier(body.guestTier, pickTier(prev.guestTier, "general")),
    adminTier: pickChatTier(body.adminTier, pickChatTier(prev.adminTier, "general")),
    allowGuest: body.allowGuest != null ? !!body.allowGuest : (prev.allowGuest != null ? !!prev.allowGuest : true),
    guestImages: body.guestImages != null ? !!body.guestImages : (prev.guestImages != null ? !!prev.guestImages : true),
    guestDailyLimit: body.guestDailyLimit != null ? clampInt(body.guestDailyLimit, 1, 200, 20) : clampInt(prev.guestDailyLimit, 1, 200, 20),
    systemPrompt: body.systemPrompt != null ? String(body.systemPrompt).slice(0, 4000) : String(prev.systemPrompt != null ? prev.systemPrompt : defaultAi().systemPrompt),
    modePrompts: {
      general: pickMode("general"),
      polish: pickMode("polish"),
      code: pickMode("code"),
      translate: pickMode("translate"),
      study: pickMode("study")
    }
  };
  await kvStore(env).put("cfg:ai", JSON.stringify(next));
  return json({ ok: true, config: publicAi(mergeAi(next, env)) });
}

async function handleExport(env) {
  const idx = await getIndex(env);
  const posts = [];
  for (const item of idx) {
    const post = await getPost(env, item.id);
    if (post) posts.push(post);
  }
  return json({
    ok: true,
    backup: {
      version: 1,
      exportedAt: new Date().toISOString(),
      about: await getAbout(env),
      values: await getValues(env),
      posts
    }
  });
}
async function handleImport(request, env) {
  const body = await readJson(request, 2 * 1024 * 1024);
  const backup = body.backup || body;
  const posts = (Array.isArray(backup.posts) ? backup.posts : []).slice(0, 200);
  const idx = body.replace ? [] : await getIndex(env);
  const keep = new Set();
  let imported = 0;
  let skipped = 0;
  for (const p of posts) {
    const title = cleanLine(p && p.title, 100);
    if (!title || !CATEGORIES.includes(p.category)) { skipped++; continue; }
    let id = String(p.id || "");
    if (!/^[a-zA-Z0-9_-]{4,40}$/.test(id)) id = newId();
    const post = {
      id,
      title,
      category: p.category,
      summary: cleanLine(p.summary, 300) || makeSummary(p.content || ""),
      content: String(p.content || "").slice(0, 200000),
      cover: validBlogKey(p.cover) ? p.cover : "",
      status: p.status === "draft" ? "draft" : "published",
      publishedAt: p.publishedAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
      views: Math.max(0, parseInt(p.views, 10) || 0),
      likes: Math.max(0, parseInt(p.likes, 10) || 0)
    };
    await kvStore(env).put("post:" + id, JSON.stringify(post));
    const item = indexItem(post);
    const at = idx.findIndex((x) => x.id === id);
    if (at >= 0) idx[at] = item; else idx.push(item);
    keep.add(id);
    imported++;
  }
  if (body.replace) {
    const old = await getIndex(env);
    for (const it of old) if (!keep.has(it.id)) await kvStore(env).delete("post:" + it.id);
    const rebuilt = [];
    for (const id of keep) {
      const post = await getPost(env, id);
      if (post) rebuilt.push(indexItem(post));
    }
    await kvStore(env).put("idx", JSON.stringify(rebuilt));
  } else {
    await kvStore(env).put("idx", JSON.stringify(idx));
  }
  if (typeof backup.about === "string") await kvStore(env).put("cfg:about", backup.about.slice(0, 8000));
  if (Array.isArray(backup.values)) {
    const values = backup.values.slice(0, 12).map((item, i) => ({
      title: cleanLine(item.title, 40) || "第 " + (i + 1) + " 则",
      text: cleanLine(item.text, 800)
    })).filter((item) => item.text);
    if (values.length) await kvStore(env).put("cfg:values", JSON.stringify(values));
  }
  return json({ ok: true, imported, skipped });
}
async function handleStats(env) {
  const idx = await getIndex(env);
  const published = idx.filter((p) => p.status === "published");
  const visits = parseInt(await kvStore(env).get("stats:visits") || "0", 10) || 0;
  const pending = await pendingOf("visitpend");
  const top = published.slice().sort((a, b) => (b.views || 0) - (a.views || 0)).slice(0, 8).map((p) => ({
    id: p.id, title: p.title, views: p.views || 0, likes: p.likes || 0
  }));
  return json({
    ok: true,
    visits: visits + pending,
    posts: idx.length,
    published: published.length,
    views: published.reduce((s, p) => s + (p.views || 0), 0),
    likes: published.reduce((s, p) => s + (p.likes || 0), 0),
    top,
    note: "阅读量与总访问量按访客去重，并大约每 10 分钟合并写入一次，以节省 KV 写入额度。"
  });
}

async function handleSitemap(request, env) {
  const origin = new URL(request.url).origin;
  const posts = publishedSorted(await getIndex(env));
  const urls = ["/", "/about", "/values", "/speed"].map((p) => "<url><loc>" + origin + p + "</loc></url>").join("") +
    posts.map((p) => "<url><loc>" + origin + "/post/" + p.id + "</loc><lastmod>" + escapeHtml((p.updatedAt || p.publishedAt || "").slice(0, 10)) + "</lastmod></url>").join("");
  const xml = '<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls + "</urlset>";
  return textResponse(xml, "application/xml; charset=utf-8", 200, { "Cache-Control": "public, max-age=300" });
}
function handleRobots(request) {
  const origin = new URL(request.url).origin;
  const body = "User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /drive\nDisallow: /api/\nDisallow: /s/\nSitemap: " + origin + "/sitemap.xml\n";
  return textResponse(body, "text/plain; charset=utf-8", 200, { "Cache-Control": "public, max-age=3600" });
}
/* ---------- human verification gate (Cloudflare Turnstile) ---------- */
const TURNSTILE_SITEKEY = "1x00000000000000000000AA"; // Turnstile test key; set env var TURNSTILE_SITEKEY in wrangler.toml [vars]
const GATE_COOKIE = "hongui_gate";
const GATE_TTL = 12 * 3600 * 1000;
const GATE_SOFT_TTL = 30 * 60 * 1000;
const GATE_OF = new WeakMap();
function gateEnabled(env) { return !!(env && env.TURNSTILE_SECRET && env.SESSION_SECRET); }
function signKey(env, purpose) { return "hongui-" + purpose + "-v1\u0000" + String(env.SESSION_SECRET || ""); }
async function signObj(env, purpose, obj) {
  const p = b64urlEncode(new TextEncoder().encode(JSON.stringify(obj)));
  return p + "." + b64urlEncode(await hmacBytes(signKey(env, purpose), p));
}
async function verifyObj(env, purpose, tok) {
  try {
    const s = String(tok || "");
    if (s.length > 2000 || !env.SESSION_SECRET) return null;
    const i = s.indexOf(".");
    if (i < 1) return null;
    const p = s.slice(0, i), sig = s.slice(i + 1);
    const expect = await hmacBytes(signKey(env, purpose), p);
    if (!bytesEq(expect, b64urlDecode(sig))) return null;
    return JSON.parse(new TextDecoder().decode(b64urlDecode(p)));
  } catch { return null; }
}
async function readGate(request, env) {
  const v = await verifyObj(env, "gate", getCookie(request, GATE_COOKIE));
  if (!v || typeof v.exp !== "number" || v.exp < Date.now()) return null;
  if (v.h !== new URL(request.url).hostname) return null;
  return { mode: v.m === "f" ? "soft" : "full", exp: v.exp };
}
function gateCookie(request, value) {
  const local = isLocalHostName(new URL(request.url).hostname);
  const bits = [GATE_COOKIE + "=" + value, "HttpOnly", "Path=/", "SameSite=Lax"];
  if (!local) bits.push("Secure");
  return bits.join("; ");
}
function gateExempt(path) {
  return path === "/favicon.svg" || path === "/favicon.ico" || path === "/robots.txt" || path === "/sitemap.xml" ||
    path === "/manifest.webmanifest" || path === "/site.webmanifest" ||
    /^\/(apple-touch-icon(-precomposed)?|icon-192|icon-512|icon-maskable-512)\.png$/.test(path) ||
    path.startsWith("/image/") || path.startsWith("/music/") || path.startsWith("/bg/") ||
    path === "/api/gate/verify" || path === "/api/gate/fallback" ||
    path === "/rss.xml" || path === "/feed" || path === "/rss";
}
function safeNextPath(n) {
  const s = String(n || "/");
  if (s.length > 1500 || !s.startsWith("/") || s.startsWith("//") || s.startsWith("/\\") || /[\u0000-\u001f\\]/.test(s)) return "/";
  try { const u = new URL(s, "https://x.invalid"); if (u.origin !== "https://x.invalid") return "/"; return u.pathname + u.search; } catch { return "/"; }
}
async function handleGateVerify(request, env, url) {
  if (!gateEnabled(env)) return json({ ok: true, next: "/" });
  requireOrigin(request);
  if (await tooMany("gatev/" + await shortHash(clientIp(request)), 30, 600)) return fail(429, "尝试过于频繁，请稍后再试");
  const body = await readJson(request, 6000);
  const token = typeof body.token === "string" ? body.token : "";
  if (!token || token.length > 4096) return fail(400, "缺少验证结果");
  const fd = new FormData();
  fd.append("secret", env.TURNSTILE_SECRET);
  fd.append("response", token);
  const ip = clientIp(request);
  if (ip && ip !== "未知") fd.append("remoteip", ip);
  let out = null;
  try {
    const r = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", { method: "POST", body: fd, signal: AbortSignal.timeout(8000) });
    out = await r.json();
  } catch { return fail(502, "验证服务暂时不可用，请重试"); }
  if (!out || out.success !== true) return fail(403, "验证未通过，请重试");
  const host = url.hostname;
  if (!isLocalHostName(host) && out.hostname !== host) return fail(403, "验证域名不匹配");
  const value = await signObj(env, "gate", { h: host, m: "v", exp: Date.now() + GATE_TTL });
  return json({ ok: true, next: safeNextPath(body.next), mode: "full" }, 200, { "Set-Cookie": gateCookie(request, value) });
}
async function handleGateFallback(request, env, url) {
  if (!gateEnabled(env)) return json({ ok: true, next: "/" });
  requireOrigin(request);
  if (await tooMany("gatef/" + await shortHash(clientIp(request)), 8, 600)) return fail(429, "尝试过于频繁，请稍后再试");
  const body = await readJson(request, 4000);
  const tk = await verifyObj(env, "gatetk", body.ticket);
  const now = Date.now();
  if (!tk || tk.h !== url.hostname || typeof tk.iat !== "number") return fail(400, "验证页已失效，请刷新");
  if (now - tk.iat < 8000) return fail(425, "请稍候再试");
  if (now - tk.iat > 20 * 60 * 1000) return fail(400, "验证页已过期，请刷新");
  const value = await signObj(env, "gate", { h: url.hostname, m: "f", exp: now + GATE_SOFT_TTL });
  return json({ ok: true, next: safeNextPath(body.next), mode: "soft" }, 200, { "Set-Cookie": gateCookie(request, value) });
}
async function renderGate(request, env, url) {
  const nonce = newNonce();
  const next = safeNextPath(url.pathname + url.search);
  const ticket = await signObj(env, "gatetk", { h: url.hostname, iat: Date.now() });
  const sitekey = String(env.TURNSTILE_SITEKEY || TURNSTILE_SITEKEY).replace(/[^A-Za-z0-9_-]/g, "");
  const ai = isAiHost(url);
  const cfgJson = JSON.stringify({ sk: sitekey, next, tk: ticket }).replace(/</g, "\\u003c");
  const mark = LOGO_MARK_SVG.replace("<svg ", '<svg class="g-mark" aria-hidden="true" focusable="false" ');
  const css = ":root{color-scheme:light dark;--ink:#0b0c10;--muted:#5b616e;--card:rgba(255,255,255,.8);--line:rgba(255,255,255,.7);--hair:rgba(12,14,24,.1);--scrim:linear-gradient(180deg,rgba(242,244,248,.35),rgba(242,244,248,.7))}" +
    "@media (prefers-color-scheme:dark){:root{--ink:#f2f3f6;--muted:#9aa1ae;--card:rgba(18,20,27,.78);--line:rgba(255,255,255,.1);--hair:rgba(255,255,255,.1);--scrim:linear-gradient(180deg,rgba(6,8,12,.5),rgba(6,8,12,.78))}.g-mark .la{stop-color:#B6B6BC}.g-mark .lb{stop-color:#94949B}}" +
    "*{box-sizing:border-box}html,body{margin:0;height:100%}body{font:15px/1.65 -apple-system,BlinkMacSystemFont,\"SF Pro Text\",\"PingFang SC\",\"HarmonyOS Sans SC\",\"MiSans\",\"Noto Sans SC\",\"Microsoft YaHei\",system-ui,sans-serif;color:var(--ink);-webkit-font-smoothing:antialiased;display:grid;place-items:center;min-height:100dvh;padding:max(20px,env(safe-area-inset-top)) 20px max(20px,env(safe-area-inset-bottom));background:#dfe5ec}" +
    "body::before{content:\"\";position:fixed;inset:0;z-index:-1;background:var(--scrim),url(/bg/default-d.webp) center/cover no-repeat}@media (max-aspect-ratio:1/1){body::before{background:var(--scrim),url(/bg/default-m.webp) center/cover no-repeat}}" +
    ".card{width:min(420px,100%);padding:36px 28px 22px;border-radius:28px;background:var(--card);border:1px solid var(--line);box-shadow:inset 0 1px 0 rgba(255,255,255,.35),0 30px 70px -28px rgba(10,14,30,.45);-webkit-backdrop-filter:blur(22px) saturate(160%);backdrop-filter:blur(22px) saturate(160%);text-align:center;animation:in .7s cubic-bezier(.16,1,.3,1) both}" +
    "@keyframes in{from{opacity:0;transform:translateY(14px) scale(.98)}}.brand{display:inline-flex;align-items:center;gap:10px;font-weight:750;letter-spacing:.06em;font-size:15px;margin-bottom:22px}.g-mark{width:30px;height:30px;filter:drop-shadow(0 1px 1.5px rgba(0,0,0,.18))}" +
    "h1{margin:0;font-size:24px;letter-spacing:-.02em;line-height:1.25;font-weight:720}p{margin:8px 0 0;color:var(--muted);font-size:14px}#ts{min-height:72px;margin:22px auto 6px;display:flex;justify-content:center}" +
    ".st{min-height:22px;font-size:13px;color:var(--muted)}.st.err{color:#d93a3a}.row{display:flex;gap:8px;justify-content:center;margin-top:10px}button{font:inherit;font-size:14px;font-weight:600;min-height:44px;padding:0 18px;border-radius:14px;border:1px solid var(--hair);background:transparent;color:var(--ink);cursor:pointer;transition:transform .35s cubic-bezier(.2,.9,.25,1.08),background-color .2s}button:hover{background:rgba(127,127,127,.1)}button:active{transform:scale(.95)}" +
    ".foot{margin-top:18px;padding-top:14px;border-top:1px solid var(--hair);font-size:12px;color:var(--muted)}.spin{display:inline-block;width:14px;height:14px;border-radius:50%;border:2px solid currentColor;border-right-color:transparent;vertical-align:-2px;margin-right:6px;animation:sp 1s linear infinite}@keyframes sp{to{transform:rotate(360deg)}}@media (prefers-reduced-motion:reduce){.card{animation:none}.spin{animation:none}}";
  const js = "(function(){var C=" + cfgJson + ",done=false,got=false,fails=0,wid=null,t0=Date.now(),inter=false,st=document.getElementById('st'),rb=document.getElementById('retry');" +
    "function say(m,e,s){st.className='st'+(e?' err':'');st.innerHTML=(s?'<span class=\"spin\" aria-hidden=\"true\"></span>':'');st.appendChild(document.createTextNode(m));}" +
    "function post(u,b){return fetch(u,{method:'POST',credentials:'same-origin',headers:{'Content-Type':'application/json','Accept':'application/json'},body:JSON.stringify(b)}).then(function(r){return r.json().catch(function(){return{}}).then(function(j){if(!r.ok||!j.ok){var e=new Error(j.error||('请求失败 '+r.status));e.status=r.status;throw e;}return j;});});}" +
    "function go(n){location.replace(n||C.next);}" +
    "function ok(token){if(done)return;done=true;got=true;say('正在确认…',false,true);post('/api/gate/verify',{token:token,next:C.next}).then(function(j){say('验证通过，正在进入…',false,true);go(j.next);}).catch(function(e){fails++;if(fails<2&&e.status!==429){done=false;say('正在重新验证…',false,true);try{if(window.turnstile&&wid!=null)turnstile.reset(wid);}catch(_){}}else{say(e.message||'验证未通过，请刷新页面重试',true);rb.hidden=false;}});}" +
    "function soft(){if(done||got)return;done=true;var w=Math.max(0,8600-(Date.now()-t0));say('验证服务在当前网络不可用，将以受限模式进入…',false,true);setTimeout(function(){post('/api/gate/fallback',{ticket:C.tk,next:C.next}).then(function(j){go(j.next);}).catch(function(e){done=false;say(e.message||'进入失败，请刷新重试',true);rb.hidden=false;});},w);}" +
    "window.__hgTs=function(){try{wid=turnstile.render('#ts',{sitekey:C.sk,theme:'auto',language:'zh-cn',appearance:'always',callback:ok,'error-callback':function(){setTimeout(soft,1500);return true;},'expired-callback':function(){try{turnstile.reset(wid);}catch(_){}},'timeout-callback':function(){try{turnstile.reset(wid);}catch(_){}},'before-interactive-callback':function(){inter=true;}});say('请完成上方验证');}catch(e){soft();}};" +
    "rb.onclick=function(){location.reload();};" +
    "var s=document.createElement('script');s.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__hgTs';s.async=true;s.onerror=function(){soft();};document.head.appendChild(s);" +
    "setTimeout(function(){if(!done&&!inter)soft();},10000);setTimeout(function(){if(!done)soft();},45000);" +
    "})();";
  const html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>安全验证 · ' + (ai ? "HONGUI AI" : "HONGUI") + '</title><meta name="robots" content="noindex"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><meta name="theme-color" content="#8E8E93"><style>' + css + '</style></head><body>' +
    '<main class="card" role="main"><div class="brand">' + mark + '<span>' + (ai ? "HONGUI AI" : "HONGUI") + '</span></div><h1>安全验证</h1><p>确认你是真人后即可继续访问。本次浏览期间只需一次。</p>' +
    '<div id="ts" aria-live="polite"></div><div class="st" id="st" role="status"><span class="spin" aria-hidden="true"></span>正在加载验证组件…</div><div class="row"><button type="button" id="retry" hidden>重新验证</button></div>' +
    '<div class="foot">由 Cloudflare Turnstile 提供保护 · 仅使用必要的会话 Cookie<br>开发者：项宏</div></main>' +
    '<noscript><p style="text-align:center">请启用 JavaScript 以完成验证。</p></noscript><script nonce="' + nonce + '">' + js + '</script></body></html>';
  const h = baseHeaders();
  h.set("Content-Type", "text/html; charset=utf-8");
  h.set("Cache-Control", "no-store");
  h.set("X-Robots-Tag", "noindex");
  h.set("Content-Security-Policy", "default-src 'self'; script-src 'nonce-" + nonce + "' https://challenges.cloudflare.com; frame-src https://challenges.cloudflare.com; connect-src 'self' https://challenges.cloudflare.com; img-src 'self' data:; style-src 'self' 'unsafe-inline'; object-src 'none'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'");
  return new Response(request.method === "HEAD" ? null : html, { status: 200, headers: h });
}

/* ---------- signed, expiring drive share links ---------- */
async function shareEpoch(env) {
  try { return parseInt(await kvStore(env).get("cfg:share-epoch") || "0", 10) || 0; } catch { return 0; }
}
async function handleDriveShare(request, env, url) {
  const body = await readJson(request, 4000);
  const key = String(body.key || "");
  if (!validDriveKey(key)) return fail(400, "路径不合法");
  if (!env.SESSION_SECRET || String(env.SESSION_SECRET).length < 16) return fail(503, "未配置 SESSION_SECRET，无法生成分享链接");
  const hours = [1, 24, 72, 168].includes(Number(body.hours)) ? Number(body.hours) : 24;
  const head = await bucket(env).head(key);
  if (!head) return fail(404, "文件不存在");
  const exp = Date.now() + hours * 3600 * 1000;
  const tok = await signObj(env, "share", { k: key, exp, ep: await shareEpoch(env) });
  return json({ ok: true, url: url.origin + "/s/" + tok, expires: new Date(exp).toISOString(), hours });
}
async function handleShareRevokeAll(env) {
  const ep = (await shareEpoch(env)) + 1;
  await kvStore(env).put("cfg:share-epoch", String(ep));
  return json({ ok: true, epoch: ep });
}
async function handleShareGet(request, env, url, tok) {
  if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "方法不被允许");
  if (await tooMany("share/" + await shortHash(clientIp(request)), 120, 600)) return fail(429, "请求过于频繁，请稍后再试");
  const v = await verifyObj(env, "share", tok);
  if (!v || typeof v.exp !== "number" || typeof v.k !== "string" || !validDriveKey(v.k)) return fail(404, "分享链接无效");
  if (v.exp < Date.now()) return fail(410, "分享链接已过期");
  if ((v.ep || 0) !== await shareEpoch(env)) return fail(410, "分享链接已被撤销");
  return handleDriveFile(request, env, url, v.k, true);
}

/* ---------- background photos (R2 site-bg/, same origin, immutable) ---------- */
const BG_PHOTO_IDS = ["default", "jiuzhai", "lijiang", "mogan", "coast", "huangshan"];
const BG_FILE_OF = { default: "qiandao", jiuzhai: "jiuzhai", lijiang: "lijiang", mogan: "mogan", coast: "coast", huangshan: "huangshan" };
async function handleBgAsset(request, env, name) {
  if (request.method !== "GET" && request.method !== "HEAD") return fail(405, "方法不被允许");
  const m = /^([a-z]+)-(d|m|t)\.webp$/.exec(name || "");
  if (!m || !BG_FILE_OF[m[1]]) return fail(404, "背景不存在");
  const key = "site-bg/" + BG_FILE_OF[m[1]] + "-" + m[2] + ".webp";
  const etagIn = request.headers.get("If-None-Match");
  const obj = request.method === "HEAD" ? await bucket(env).head(key) : await bucket(env).get(key, etagIn ? { onlyIf: { etagDoesNotMatch: etagIn.replace(/^W\//, "").replace(/"/g, "") } } : undefined);
  if (!obj) return fail(404, "背景不存在");
  const h = baseHeaders();
  h.set("Content-Type", "image/webp");
  h.set("Cache-Control", "public, max-age=31536000, immutable");
  h.set("ETag", obj.httpEtag || '"' + key + '"');
  h.set("Content-Security-Policy", "default-src 'none'; sandbox");
  if (request.method === "HEAD" || !("body" in obj) || !obj.body) {
    if (request.method !== "HEAD") return new Response(null, { status: 304, headers: h });
    h.set("Content-Length", String(obj.size || 0));
    return new Response(null, { status: 200, headers: h });
  }
  h.set("Content-Length", String(obj.size || 0));
  return new Response(obj.body, { status: 200, headers: h });
}

const LOGO_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><style>@media (prefers-color-scheme:dark){.la{stop-color:#B6B6BC}.lb{stop-color:#94949B}}</style><defs><linearGradient id=\"hgF\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop class=\"la\" offset=\"0\" stop-color=\"#9A9AA0\"/><stop class=\"lb\" offset=\"1\" stop-color=\"#7D7D84\"/></linearGradient><linearGradient id=\"hgH\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".62\"/><stop offset=\".45\" stop-color=\"#fff\" stop-opacity=\".06\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\".16\"/></linearGradient><radialGradient id=\"hgS\" cx=\".3\" cy=\"0\" r=\".9\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".16\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></radialGradient><clipPath id=\"hgC\"><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\"/></clipPath></defs><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"url(#hgF)\"/><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"url(#hgS)\"/><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"none\" stroke=\"url(#hgH)\" stroke-width=\"9\" clip-path=\"url(#hgC)\"/><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"none\" stroke=\"#1d1d22\" stroke-opacity=\".14\" stroke-width=\"2\"/></svg>";
const LOGO_MARK_SVG = "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><defs><linearGradient id=\"hgF\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop class=\"la\" offset=\"0\" stop-color=\"#9A9AA0\"/><stop class=\"lb\" offset=\"1\" stop-color=\"#7D7D84\"/></linearGradient><linearGradient id=\"hgH\" x1=\"0\" y1=\"0\" x2=\"0\" y2=\"1\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".62\"/><stop offset=\".45\" stop-color=\"#fff\" stop-opacity=\".06\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\".16\"/></linearGradient><radialGradient id=\"hgS\" cx=\".3\" cy=\"0\" r=\".9\"><stop offset=\"0\" stop-color=\"#fff\" stop-opacity=\".16\"/><stop offset=\"1\" stop-color=\"#fff\" stop-opacity=\"0\"/></radialGradient><clipPath id=\"hgC\"><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\"/></clipPath></defs><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"url(#hgF)\"/><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"url(#hgS)\"/><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"none\" stroke=\"url(#hgH)\" stroke-width=\"9\" clip-path=\"url(#hgC)\"/><path d=\"M500.0 256.0L499.9 331.0L499.5 354.9L498.8 372.2L497.9 386.2L496.6 398.1L495.2 408.5L493.4 417.9L491.3 426.3L489.0 433.9L486.4 440.9L483.4 447.4L480.2 453.3L476.6 458.7L472.7 463.8L468.4 468.4L463.8 472.7L458.7 476.6L453.3 480.2L447.4 483.4L440.9 486.4L433.9 489.0L426.3 491.3L417.9 493.4L408.5 495.2L398.1 496.6L386.2 497.9L372.2 498.8L354.9 499.5L331.0 499.9L256.0 500.0L181.0 499.9L157.1 499.5L139.8 498.8L125.8 497.9L113.9 496.6L103.5 495.2L94.1 493.4L85.7 491.3L78.1 489.0L71.1 486.4L64.6 483.4L58.7 480.2L53.3 476.6L48.2 472.7L43.6 468.4L39.3 463.8L35.4 458.7L31.8 453.3L28.6 447.4L25.6 440.9L23.0 433.9L20.7 426.3L18.6 417.9L16.8 408.5L15.4 398.1L14.1 386.2L13.2 372.2L12.5 354.9L12.1 331.0L12.0 256.0L12.1 181.0L12.5 157.1L13.2 139.8L14.1 125.8L15.4 113.9L16.8 103.5L18.6 94.1L20.7 85.7L23.0 78.1L25.6 71.1L28.6 64.6L31.8 58.7L35.4 53.3L39.3 48.2L43.6 43.6L48.2 39.3L53.3 35.4L58.7 31.8L64.6 28.6L71.1 25.6L78.1 23.0L85.7 20.7L94.1 18.6L103.5 16.8L113.9 15.4L125.8 14.1L139.8 13.2L157.1 12.5L181.0 12.1L256.0 12.0L331.0 12.1L354.9 12.5L372.2 13.2L386.2 14.1L398.1 15.4L408.5 16.8L417.9 18.6L426.3 20.7L433.9 23.0L440.9 25.6L447.4 28.6L453.3 31.8L458.7 35.4L463.8 39.3L468.4 43.6L472.7 48.2L476.6 53.3L480.2 58.7L483.4 64.6L486.4 71.1L489.0 78.1L491.3 85.7L493.4 94.1L495.2 103.5L496.6 113.9L497.9 125.8L498.8 139.8L499.5 157.1L499.9 181.0Z\" fill=\"none\" stroke=\"#1d1d22\" stroke-opacity=\".14\" stroke-width=\"2\"/></svg>";
const ICON_B64 = { apple: "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", i192: "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", i512: "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cKgbTvYcjtnJAVRzx2lfu3sZ8DV5a+OaP3nqV+qpfsz356xbv9JmjnezAzbf8+oucbl2U3DdHeywuc/Hwx22eWdtOb1TcSe19/b2p7G2hxKEO2A2D4bh7pQgGHt1O8P1KTn4zLQDOe0g3PnUrVtv/PZrr13/jf9pKv/j//i/vDCN1ds7O8Pt6TrD7RdeeMEkBXfgpBxpOUkA1l82L19++vTW1ri7uXlru+t2d7/t2/7Eu5566okvnk72n3fq1M60ot99eFqln5226g9X7tOJ/+BEP6/m7eRiSnjShuCGq5p2c4I1A9+cmOb/H1aTwLztOP8zk4Pddpy/t3/4/8722zFeiC+17co1vIGrbdLjn0T99nExPL+d3havxeP9WgY3j4ftcQEdU/516jiy/sjxKHxnm/+fx3q/Sg7MsWd7HvezvXnw//M/2zb/pl+1m/+3xzG2K7qdh1Gxk2J8m3YIVj6Z8W3+TZcUVjsId+6Yf3evv/HGrefu3Ln14c985tUP/MZvfOx//ft//+//m3G8dWtvb/fO3bvdrZdf/shNOLmUsNZykgAsX/ppdX96GpCnuu7U6a/5mmcef+97/61vvHTp4num7bGnpq37q9MJfcuc1Kf/X53czQre/MsXf2WUyvinrHs1IE09ZegwZegHJ+89mLf/9laD15zM8UncP46/YppXqn693IolxtOs4EpXSHhlvgQedY2cxyvHTeHQOw5L4XEr8zLcFM668ejfpfCkOw91ePaS37xw6A4XEKY23zE7iebftMO4+mx3d+egrd14svOOucxgEoX5csNw59atGy/cvHn7N1955dVfmPYJ/n//9J/+3G+P4xs3p9/dfP7559+AeSvopCxUThKABcp07f7UFMCnAU6deuc733blG77hfb//oYce+sozZ868a1rhPzDt9HdmsJkTPt6u1xV38r979850Qr+9OqmHJ/m9vburut1gnldMLSeHmpOns5fdto7x7GS7DB6wfyJo6rbb9PzJZBk/14mnvzwARf7Y7XLdjYPlyVWdLjJcMzfNi5KtVXJgkwSzM3nq1KmVXXOvg0k+TSJg5iczf03z1jjVL7z22uv/erpE8D/8w3/4X/+jD33oAy9NX31j4nPz2WeffQNOStNykgC0KRtXrlw53XVnz+zsbJz9wR/8/mceffTa154/f+537u6eenR3d3tjum6/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", m512: "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" };
const ICON_BYTES = {};
function iconBytes(k) {
  if (!ICON_BYTES[k]) { const bin = atob(ICON_B64[k]); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); ICON_BYTES[k] = u; }
  return ICON_BYTES[k];
}
const MANIFEST_JSON = JSON.stringify({
  name: "项宏 · HONGUI",
  short_name: "HONGUI",
  description: "项宏的个人网站：博客、网盘、AI 对话与测速。",
  id: "/",
  start_url: "/",
  scope: "/",
  display: "standalone",
  orientation: "portrait",
  background_color: "#F2F2F4",
  theme_color: "#8E8E93",
  lang: "zh-CN",
  icons: [
    { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
    { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    { src: "/favicon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }
  ]
});
function handleFavicon() {
  return textResponse(LOGO_SVG, "image/svg+xml; charset=utf-8", 200, { "Cache-Control": "public, max-age=86400", "Cross-Origin-Resource-Policy": "cross-origin" });
}
function handleIconAsset(path) {
  const map = { "/apple-touch-icon.png": "apple", "/apple-touch-icon-precomposed.png": "apple", "/favicon.ico": "i192", "/icon-192.png": "i192", "/icon-512.png": "i512", "/icon-maskable-512.png": "m512" };
  if (path === "/manifest.webmanifest" || path === "/site.webmanifest") return textResponse(MANIFEST_JSON, "application/manifest+json; charset=utf-8", 200, { "Cache-Control": "public, max-age=3600" });
  const k = map[path];
  if (!k) return null;
  const h = baseHeaders();
  h.set("Content-Type", "image/png");
  h.set("Cache-Control", "public, max-age=86400");
  return new Response(iconBytes(k), { status: 200, headers: h });
}

const BG_CORE = String.raw`(function () {
  var KEY = "hongui_bg", IDB = "hongui_bg", root = document.documentElement;
  var P = {
    "default": { n: "千岛湖", ph: 1, lum: 0.51, a: ["#adaebf", "#485159"], pos: "center" },
    jiuzhai: { n: "九寨长海", ph: 1, lum: 0.54, a: ["#9ba0a3", "#6e8081"], pos: "center" },
    lijiang: { n: "漓江", ph: 1, lum: 0.56, a: ["#b0bed1", "#6c6c56"], pos: "center" },
    mogan: { n: "莫干山竹林", ph: 1, lum: 0.28, a: ["#656660", "#2b2c26"], pos: "center" },
    coast: { n: "海岸公路", ph: 1, lum: 0.44, a: ["#6b808a", "#3c3b2d"], pos: "38% center" },
    huangshan: { n: "黄山", ph: 1, lum: 0.43, a: ["#999999", "#2a2a2a"], pos: "30% center" },
    white: { n: "纯净白", t: "light", a: ["#f4f5f7", "#ffffff"], b: ["rgba(150,160,175,.10)", "rgba(180,186,196,.10)", "rgba(210,214,222,.24)"] },
    night: { n: "深夜黑", t: "dark", a: ["#0a0c10", "#13161c"], b: ["rgba(90,100,120,.16)", "rgba(80,86,100,.14)", "rgba(60,70,80,.14)"] }
  };
  var ORDER = ["default", "jiuzhai", "lijiang", "mogan", "coast", "huangshan", "white", "night"];
  var VARS = ["--bg0", "--bg1", "--b1", "--b2", "--b3", "--o1", "--o2", "--o3", "--bgimg", "--glass", "--glass-strong"];
  var siteDef = null, objUrl = "", lastSnap = "", fadeT = 0, autoT = 0, curCfg = null;

  function rd() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function wr(c) { try { if (c) localStorage.setItem(KEY, JSON.stringify(c)); else localStorage.removeItem(KEY); return true; } catch (e) { return false; } }
  function reduced() { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch (e) { return false; } }
  function hex2rgb(h) { h = String(h || "").replace("#", ""); if (h.length === 3) h = h.replace(/(.)/g, "$1$1"); var n = parseInt(h, 16); if (isNaN(n) || h.length !== 6) return [128, 128, 128]; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; }
  function lumRgb(c) { return (0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]) / 255; }
  function mix(c, k, t) { return [Math.round(c[0] * (1 - t) + k * t), Math.round(c[1] * (1 - t) + k * t), Math.round(c[2] * (1 - t) + k * t)]; }
  function css(c) { return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")"; }
  function hue(c) {
    var r = c[0] / 255, g = c[1] / 255, b = c[2] / 255, mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn, h = 0;
    if (d) { if (mx === r) h = ((g - b) / d) % 6; else if (mx === g) h = (b - r) / d + 2; else h = (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
    var l = (mx + mn) / 2, s = d ? d / (1 - Math.abs(2 * l - 1)) : 0;
    return [h, s];
  }
  function safeImg(u) { u = String(u || ""); return /^\/image\/[A-Za-z0-9_\-.\/%]{1,200}$/.test(u) && u.indexOf("..") < 0 ? u : ""; }

  function look(cfg) {
    var v = {}, lum = null, tone = "light", img = false, photo = false, anim = "", i, p;
    if (!cfg) cfg = { k: "preset", id: "default" };
    if (cfg.k === "color") {
      var c = hex2rgb(cfg.c), hs = hue(c), s = Math.min(1, Math.max(0.5, hs[1]));
      tone = lumRgb(c) < 0.4 ? "dark" : "light";
      var a0 = tone === "dark" ? mix(c, 0, 0.6) : mix(c, 255, 0.8), a1 = tone === "dark" ? mix(c, 0, 0.78) : mix(c, 255, 0.9);
      var l = tone === "dark" ? 45 : 58, hh = hs[0];
      v["--bg0"] = css(a0); v["--bg1"] = css(a1);
      v["--b1"] = "hsla(" + Math.round(hh) + "," + Math.round(s * 100) + "%," + l + "%,.32)";
      v["--b2"] = "hsla(" + Math.round((hh + 35) % 360) + "," + Math.round(s * 100) + "%," + l + "%,.26)";
      v["--b3"] = "hsla(" + Math.round((hh + 325) % 360) + "," + Math.round(s * 100) + "%," + (l + 10) + "%,.38)";
      lum = lumRgb(a0);
    } else if (cfg.k === "img") {
      img = true; tone = cfg.tone === "dark" ? "dark" : "light"; lum = typeof cfg.lum === "number" ? cfg.lum : (tone === "dark" ? 0.2 : 0.8);
      var src = cfg.src === "local" ? (objUrl || cfg.thumb || "") : safeImg(cfg.url);
      if (!src) { return look({ k: "preset", id: "default" }); }
      var scrim = tone === "dark" ? "rgba(8,12,16,.30)" : "rgba(255,255,255,.18)";
      v["--bgimg"] = "linear-gradient(" + scrim + "," + scrim + "),url(\"" + src + "\") center/cover no-repeat";
      v["--bg0"] = tone === "dark" ? "#0B1220" : "#F4F6FB"; v["--bg1"] = tone === "dark" ? "#151C2C" : "#EEF2FF";
      v["--b1"] = v["--b2"] = v["--b3"] = "transparent";
    } else {
      p = P[cfg.id] || P["default"];
      if (p.ph) {
        var pid = P[cfg.id] ? cfg.id : "default", port = false;
        try { port = matchMedia("(max-aspect-ratio: 1/1)").matches; } catch (e) {}
        img = true; photo = true; lum = p.lum; tone = root.getAttribute("data-theme") === "dark" ? "dark" : "light";
        v["--bgimg"] = 'url("/bg/' + pid + "-" + (port ? "m" : "d") + '.webp") ' + (port ? "center" : p.pos) + "/cover no-repeat";
        v["--bg0"] = p.a[0]; v["--bg1"] = p.a[1]; v["--b1"] = v["--b2"] = v["--b3"] = "transparent";
      } else {
        tone = p.t;
        v["--bg0"] = p.a[0]; v["--bg1"] = p.a[1]; v["--b1"] = p.b[0]; v["--b2"] = p.b[1]; v["--b3"] = p.b[2]; lum = lumRgb(hex2rgb(p.a[0]));
      }
    }
    if (img) { v["--o1"] = v["--o2"] = v["--o3"] = "transparent"; }
    else if (v["--b1"]) { v["--o1"] = v["--b1"]; v["--o2"] = v["--b2"]; v["--o3"] = v["--b3"]; }
    return { v: v, lum: lum, tone: tone, img: img, photo: photo, anim: anim };
  }

  function snap(lk) {
    var dark = root.getAttribute("data-theme") === "dark", v = lk.v;
    var b1 = v["--b1"] || "rgba(79,140,255,.32)", b2 = v["--b2"] || "rgba(139,124,255,.28)", b3 = v["--b3"] || "rgba(52,211,181,.30)";
    var g0 = v["--bg0"] || (dark ? "#0B1220" : "#F4F6FB"), g1 = v["--bg1"] || (dark ? "#151C2C" : "#EEF2FF");
    var base = "radial-gradient(ellipse 42% 32% at 12% 18%," + b1 + ",transparent 70%),radial-gradient(ellipse 36% 28% at 88% 12%," + b2 + ",transparent 70%),radial-gradient(ellipse 40% 36% at 70% 86%," + b3 + ",transparent 72%),linear-gradient(165deg," + g0 + "," + g1 + " 55%," + g0 + ")";
    return v["--bgimg"] ? v["--bgimg"] + "," + base : base;
  }

  function glass(lk) {
    var dark = root.getAttribute("data-theme") === "dark", a = 0;
    root.style.removeProperty("--glass"); root.style.removeProperty("--glass-strong");
    if (lk.lum == null) return;
    if (!dark) { if (lk.img) a = lk.lum < 0.35 ? 0.74 : 0.6; else if (lk.lum < 0.35) a = 0.72; if (a) { root.style.setProperty("--glass", "rgba(255,255,255," + a + ")"); root.style.setProperty("--glass-strong", "rgba(255,255,255,.9)"); } }
    else { if (lk.img) a = lk.lum > 0.55 ? 0.78 : 0.62; else if (lk.lum > 0.6) a = 0.74; if (a) { root.style.setProperty("--glass", "rgba(14,22,26," + a + ")"); root.style.setProperty("--glass-strong", "rgba(12,18,22,.9)"); } }
  }

  function setTheme(t) {
    root.setAttribute("data-theme", t);
    try { localStorage.setItem("hongui_theme", t); } catch (e) {}
    var b = document.getElementById("themeBtn"); if (b) b.setAttribute("aria-pressed", t === "dark" ? "true" : "false");
  }

  function apply(cfg, o) {
    o = o || {};
    var lk = look(cfg), old = lastSnap, i;
    var fade = o.fade && old && document.body && !reduced();
    var ov = null;
    if (fade) {
      ov = document.getElementById("bgfade");
      if (!ov) { ov = document.createElement("div"); ov.id = "bgfade"; ov.setAttribute("aria-hidden", "true"); document.body.insertBefore(ov, document.body.firstChild); }
      clearTimeout(fadeT); ov.style.transition = "none"; ov.style.opacity = "1"; ov.style.background = old; ov.style.display = "block";
    }
    for (i = 0; i < VARS.length; i++) root.style.removeProperty(VARS[i]);
    for (var k in lk.v) root.style.setProperty(k, lk.v[k]);
    if (o.setTheme && !lk.photo) setTheme(lk.tone);
    if (lk.anim) root.setAttribute("data-bg", lk.anim); else root.removeAttribute("data-bg");
    if (lk.photo) root.setAttribute("data-photo", ""); else root.removeAttribute("data-photo");
    glass(lk);
    lastSnap = snap(lk); curCfg = cfg; lastLook = lk;
    if (ov) {
      void ov.offsetWidth;
      requestAnimationFrame(function () { ov.style.transition = "opacity 1.2s ease"; ov.style.opacity = "0"; });
      fadeT = setTimeout(function () { ov.style.display = "none"; }, 1400);
    }
    return lk;
  }
  var lastLook = null;

  function current() { return rd() || siteDef || { k: "preset", id: "default" }; }

  function nextAuto() {
    var cfg = rd(); if (!cfg || !cfg.auto) return;
    var dark = root.getAttribute("data-theme") === "dark", list = [], i, idx;
    for (i = 0; i < ORDER.length; i++) if (P[ORDER[i]].ph) list.push(ORDER[i]);
    if (!list.length) return;
    idx = list.indexOf(cfg.id); var id = list[(idx + 1) % list.length];
    var nc = { k: "preset", id: id, auto: 1 }; wr(nc); apply(nc, { fade: true });
  }
  function syncAuto() {
    clearInterval(autoT); autoT = 0;
    var cfg = rd();
    if (cfg && cfg.auto && !reduced()) autoT = setInterval(function () { if (!document.hidden) nextAuto(); }, 30000);
  }

  function idb(fn) {
    return new Promise(function (res, rej) {
      var q = indexedDB.open(IDB, 1);
      q.onupgradeneeded = function () { q.result.createObjectStore("k"); };
      q.onerror = function () { rej(q.error); };
      q.onsuccess = function () { var db = q.result; try { fn(db, res, rej); } catch (e) { rej(e); } };
    });
  }
  function idbPut(blob) { return idb(function (db, res, rej) { var t = db.transaction("k", "readwrite"); t.objectStore("k").put(blob, "img"); t.oncomplete = function () { res(true); }; t.onerror = function () { rej(t.error); }; }); }
  function idbGet() { return idb(function (db, res, rej) { var r = db.transaction("k").objectStore("k").get("img"); r.onsuccess = function () { res(r.result || null); }; r.onerror = function () { rej(r.error); }; }); }

  function loadImage(file) {
    return new Promise(function (res, rej) {
      var u = URL.createObjectURL(file), im = new Image();
      im.onload = function () { URL.revokeObjectURL(u); res(im); };
      im.onerror = function () { URL.revokeObjectURL(u); rej(new Error("图片无法读取")); };
      im.src = u;
    });
  }
  function toBlob(cv, q) { return new Promise(function (res) { cv.toBlob(res, "image/jpeg", q); }); }

  var HBG = {
    presets: P, order: ORDER,
    boot: function (def) {
      siteDef = def && typeof def === "object" ? def : null;
      var cfg = current(), lk = apply(cfg, {});
      var stored = null; try { stored = localStorage.getItem("hongui_theme"); } catch (e) {}
      if (!stored && !(cfg.k === "preset" && P[cfg.id] && P[cfg.id].ph) && lk.tone === "dark" && root.getAttribute("data-theme") !== "dark") { root.setAttribute("data-theme", "dark"); glass(lk); lastSnap = snap(lk); }
    },
    init: function () {
      var cfg = rd();
      if (cfg && cfg.k === "img" && cfg.src === "local" && window.indexedDB) {
        idbGet().then(function (b) { if (b) { objUrl = URL.createObjectURL(b); apply(rd() || cfg, {}); } }).catch(function () {});
      }
      syncAuto();
      document.addEventListener("visibilitychange", function () { if (!document.hidden) syncAuto(); });
      try { matchMedia("(max-aspect-ratio: 1/1)").addEventListener("change", function () { if (lastLook && lastLook.photo) apply(current(), {}); }); } catch (e) {}
    },
    cfg: function () { return rd(); },
    site: function () { return siteDef; },
    effective: current,
    refresh: function () { if (lastLook) { glass(lastLook); lastSnap = snap(lastLook); } },
    reduced: reduced,
    reset: function () { wr(null); apply(current(), { fade: true, setTheme: true }); syncAuto(); },
    preset: function (id) { if (!P[id]) return; var c = { k: "preset", id: id }; wr(c); apply(c, { fade: true, setTheme: true }); syncAuto(); },
    color: function (hex) { if (!/^#[0-9a-fA-F]{6}$/.test(hex)) return; var c = { k: "color", c: hex.toLowerCase() }; wr(c); apply(c, { fade: true, setTheme: true }); syncAuto(); },
    url: function (u) {
      var s = safeImg(u); if (!s) return false;
      var c = { k: "img", src: "url", url: s, tone: "dark", lum: 0.3 };
      var im = new Image();
      im.onload = function () {
        try { var cv = document.createElement("canvas"); cv.width = cv.height = 12; var x = cv.getContext("2d"); x.drawImage(im, 0, 0, 12, 12); var d = x.getImageData(0, 0, 12, 12).data, t = 0, n = 0, j; for (j = 0; j < d.length; j += 4) { t += lumRgb([d[j], d[j + 1], d[j + 2]]); n++; } c.lum = t / n; c.tone = c.lum < 0.5 ? "dark" : "light"; } catch (e) { c.lum = 0.5; c.tone = "light"; }
        wr(c); apply(c, { fade: true, setTheme: true }); syncAuto();
      };
      im.onerror = function () { if (window.HBG_onerr) window.HBG_onerr("图片加载失败，请检查路径"); };
      im.src = s; return true;
    },
    file: function (file) {
      if (!file || !/^image\//.test(file.type)) return Promise.reject(new Error("请选择图片文件"));
      if (file.size > 25 * 1024 * 1024) return Promise.reject(new Error("图片太大（上限 25MB）"));
      return loadImage(file).then(function (im) {
        var sc = Math.min(1, 1920 / Math.max(im.naturalWidth, im.naturalHeight)), w = Math.max(1, Math.round(im.naturalWidth * sc)), h = Math.max(1, Math.round(im.naturalHeight * sc));
        var cv = document.createElement("canvas"); cv.width = w; cv.height = h; cv.getContext("2d").drawImage(im, 0, 0, w, h);
        var tv = document.createElement("canvas"); tv.width = 24; tv.height = Math.max(1, Math.round(24 * h / w)); var tx = tv.getContext("2d"); tx.drawImage(im, 0, 0, tv.width, tv.height);
        var d = tx.getImageData(0, 0, tv.width, tv.height).data, t = 0, n = 0, j;
        for (j = 0; j < d.length; j += 4) { t += lumRgb([d[j], d[j + 1], d[j + 2]]); n++; }
        var lum = t / n, thumb = tv.toDataURL("image/jpeg", 0.6);
        return toBlob(cv, 0.82).then(function (blob) {
          if (!blob) throw new Error("图片处理失败");
          return idbPut(blob).then(function () {
            if (objUrl) URL.revokeObjectURL(objUrl);
            objUrl = URL.createObjectURL(blob);
            var c = { k: "img", src: "local", thumb: thumb, lum: lum, tone: lum < 0.5 ? "dark" : "light" };
            wr(c); apply(c, { fade: true, setTheme: true }); syncAuto();
          });
        });
      });
    },
    auto: function (on) {
      var c = rd() || ((curCfg && curCfg.k === "preset") ? { k: "preset", id: curCfg.id } : { k: "preset", id: "default" });
      if (on) { if (c.k !== "preset") c = { k: "preset", id: "default" }; c.auto = 1; } else { delete c.auto; }
      wr(c); apply(c, {}); syncAuto();
    }
  };
  window.HBG = HBG;
})();
`;
const CSS = `
:root {
  --font: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "PingFang SC", "HarmonyOS Sans SC", "MiSans", "Hiragino Sans GB", "Noto Sans SC", "Segoe UI", "Microsoft YaHei", system-ui, sans-serif;
  --sans: var(--font); --serif: var(--font);
  --mono: ui-monospace, "SF Mono", "JetBrains Mono", Menlo, Consolas, monospace;
  --ink: #0A0B10; --ink-2: #262B36; --muted: #5A6272; --faint: #868E9C;
  --accent: #4F5BFF; --accent-2: #8B5CF6; --accent-3: #FF7A59; --link: #3B48F0; --mint: #10B981;
  --accent-soft: rgba(79,91,255,.10); --accent-line: rgba(79,91,255,.24);
  --grad: linear-gradient(118deg, #4F5BFF 0%, #8B5CF6 48%, #FF7A59 100%);
  --glass: rgba(255,255,255,.60); --glass-strong: rgba(255,255,255,.80);
  --surface: var(--glass-strong); --surface-solid: #FFFFFF; --field: rgba(255,255,255,.72);
  --hair: rgba(12,14,24,.08); --hair-2: rgba(12,14,24,.14); --line: rgba(255,255,255,.66); --line-dim: var(--hair);
  --hi: inset 0 1px 0 rgba(255,255,255,.8);
  --sh-1: 0 1px 2px rgba(16,20,40,.05), 0 4px 12px -4px rgba(16,20,40,.08);
  --sh-2: 0 1px 2px rgba(16,20,40,.05), 0 14px 34px -14px rgba(16,20,40,.24);
  --sh-3: 0 2px 6px rgba(16,20,40,.06), 0 34px 70px -24px rgba(16,20,40,.36);
  --shadow: var(--hi), var(--sh-2);
  --scrim-a: rgba(246,247,251,.10); --scrim-b: rgba(246,247,251,.58);
  --r-card: 24px; --r-ctl: 14px; --radius: 24px;
  --ease-out: cubic-bezier(.16,1,.3,1); --ease-in: cubic-bezier(.5,0,.75,0); --ease-io: cubic-bezier(.65,0,.35,1);
  --spring: cubic-bezier(.2,.9,.25,1.08);
  --blur: 20px; --page: 1200px; --topH: 56px; --gap: 16px; --pad: 24px;
  color-scheme: light;
}
@supports (transition-timing-function: linear(0, 1)) {
  :root { --spring: linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001 85.9%, 1); }
}
html[data-theme="dark"] {
  --ink: #F3F4F8; --ink-2: #D5D9E2; --muted: #9AA2B2; --faint: #6C7484;
  --accent: #8189FF; --accent-2: #A78BFA; --accent-3: #FF967A; --link: #A3AAFF; --mint: #34D399;
  --accent-soft: rgba(129,137,255,.14); --accent-line: rgba(129,137,255,.32);
  --glass: rgba(16,18,26,.56); --glass-strong: rgba(18,20,28,.80);
  --surface-solid: #12141B; --field: rgba(255,255,255,.05);
  --hair: rgba(255,255,255,.08); --hair-2: rgba(255,255,255,.14); --line: rgba(255,255,255,.10);
  --hi: inset 0 1px 0 rgba(255,255,255,.06);
  --sh-1: 0 1px 2px rgba(0,0,0,.3), 0 4px 12px -4px rgba(0,0,0,.4);
  --sh-2: 0 1px 2px rgba(0,0,0,.3), 0 18px 40px -16px rgba(0,0,0,.6);
  --sh-3: 0 2px 6px rgba(0,0,0,.3), 0 40px 80px -24px rgba(0,0,0,.7);
  --scrim-a: rgba(6,7,11,.30); --scrim-b: rgba(6,7,11,.70);
  color-scheme: dark;
}
*, *::before, *::after { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
html { overflow-x: clip; -webkit-text-size-adjust: 100%; text-size-adjust: 100%; scroll-padding-top: 88px; }
body {
  min-height: 100vh; color: var(--ink); font-family: var(--font); font-size: 16px; line-height: 1.7;
  letter-spacing: -.003em; -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;
  background: #EEF1F6; overflow-x: clip; text-rendering: optimizeLegibility;
}
html[data-theme="dark"] body { background: #07080C; }
body::before {
  content: ""; position: fixed; inset: 0; pointer-events: none; z-index: -2;
  background:
    linear-gradient(180deg, var(--scrim-a), var(--scrim-b) 70%),
    var(--bgimg, linear-gradient(transparent, transparent)),
    radial-gradient(ellipse 42% 32% at 12% 18%, var(--b1, rgba(120,170,210,.34)), transparent 70%),
    radial-gradient(ellipse 36% 28% at 88% 12%, var(--b2, rgba(140,185,140,.28)), transparent 70%),
    radial-gradient(ellipse 40% 36% at 70% 86%, var(--b3, rgba(210,180,120,.28)), transparent 72%),
    linear-gradient(165deg, var(--bg0, #E6EEF6), var(--bg1, #EEF3EA) 55%, var(--bg0, #E6EEF6));
}
#bgfade { position: fixed; inset: 0; z-index: -1; pointer-events: none; display: none; }
html[data-bg="aurora"] body::after {
  content: ""; position: fixed; inset: -25% -10%; z-index: -2; pointer-events: none; opacity: .7;
  background: linear-gradient(115deg, transparent 18%, rgba(60,230,170,.38) 36%, rgba(80,140,255,.32) 52%, rgba(175,95,245,.32) 68%, transparent 82%);
  filter: blur(46px); will-change: transform; animation: aurora 18s ease-in-out infinite alternate;
}
@keyframes aurora { from { transform: translate3d(-6%, -2%, 0) rotate(-3deg); } to { transform: translate3d(6%, 3%, 0) rotate(3deg); } }
@keyframes float { 50% { transform: translate3d(24px, -28px, 0); } }
::selection { background: rgba(79,91,255,.22); }
.skip { position: absolute; left: 12px; top: -120px; background: var(--surface-solid); color: var(--ink); padding: 10px 14px; border-radius: 12px; z-index: 100; box-shadow: var(--sh-2); }
.skip:focus { top: 10px; }
.sr-only { position: absolute !important; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); white-space: nowrap; border: 0; }
a { color: var(--link); text-underline-offset: 3px; text-decoration-thickness: 1px; }
img, video, canvas, table, pre { max-width: 100%; }
h1, h2, h3, h4 { color: var(--ink); text-wrap: balance; }
p { text-wrap: pretty; }
button, input, select, textarea { font: inherit; color: inherit; letter-spacing: inherit; }
button, [role="button"], summary, label.filebtn { cursor: pointer; }
:focus { outline: none; }
:focus-visible { outline: 2px solid var(--accent); outline-offset: 3px; border-radius: 10px; }
button:focus-visible, .btn:focus-visible { border-radius: 999px; }

/* ---------- icons ---------- */
.ic { display: inline-block; width: 18px; height: 18px; flex: 0 0 auto; background: currentColor; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; vertical-align: -3px; }

/* ---------- buttons & fields ---------- */
button, .btn {
  -webkit-tap-highlight-color: transparent; touch-action: manipulation;
  display: inline-flex; align-items: center; justify-content: center; gap: 8px;
  min-height: 44px; padding: 0 18px; border-radius: 999px; border: 1px solid var(--hair-2);
  background: var(--surface); color: var(--ink); font-size: 14px; font-weight: 550; line-height: 1.2; text-decoration: none; white-space: nowrap;
  box-shadow: var(--hi), var(--sh-1);
  transition: transform .45s var(--spring), background-color .2s ease, border-color .2s ease, box-shadow .25s ease, color .2s ease, opacity .2s ease;
}
button:hover, .btn:hover { border-color: var(--accent-line); box-shadow: var(--hi), var(--sh-2); }
button:active, .btn:active { transform: scale(.95); transition-duration: .12s, .2s, .2s, .25s, .2s, .2s; }
button.primary, .btn.primary {
  background: var(--ink); color: #fff; border-color: transparent;
  box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 8px 22px -8px rgba(10,11,16,.55);
}
html[data-theme="dark"] button.primary, html[data-theme="dark"] .btn.primary { background: #F3F4F8; color: #0A0B10; box-shadow: 0 8px 24px -10px rgba(129,137,255,.55); }
button.primary:hover, .btn.primary:hover { box-shadow: 0 1px 0 rgba(255,255,255,.18) inset, 0 12px 30px -10px rgba(79,91,255,.6); }
.btn.lg, button.lg { min-height: 52px; padding: 0 24px; font-size: 15px; }
.btn.ghost { background: transparent; box-shadow: none; border-color: var(--hair-2); }
.btn.ghost:hover { background: var(--glass); }
button.danger { color: #E5484D; background: transparent; box-shadow: none; }
button.danger:hover { background: rgba(229,72,77,.08); border-color: rgba(229,72,77,.3); }
button.mini { min-height: 36px; padding: 0 12px; font-size: 13px; }
button:disabled { opacity: .5; cursor: not-allowed; transform: none !important; }
.icon-btn { width: 40px; min-height: 40px; height: 40px; padding: 0; border-radius: 12px; box-shadow: none; background: transparent; border-color: transparent; position: relative; }
.icon-btn:hover { background: var(--accent-soft); border-color: transparent; box-shadow: none; }
.icon-btn .ic { width: 19px; height: 19px; }
input, select, textarea {
  width: 100%; min-height: 44px; border-radius: var(--r-ctl); border: 1px solid var(--hair-2); padding: 10px 14px;
  background: var(--field); color: var(--ink); font-size: 15px; transition: border-color .2s ease, box-shadow .2s ease, background-color .2s ease;
}
input:focus, select:focus, textarea:focus { border-color: var(--accent); box-shadow: 0 0 0 4px var(--accent-soft); outline: none; background: var(--surface-solid); }
input[type="checkbox"], input[type="radio"] { width: 18px; height: 18px; min-height: 0; accent-color: var(--accent); padding: 0; }
input[type="color"] { padding: 4px; }
input[type="file"] { padding: 8px; }
textarea { min-height: 120px; resize: vertical; line-height: 1.6; }
select { appearance: none; -webkit-appearance: none; padding-right: 34px; background-image: linear-gradient(45deg, transparent 50%, currentColor 50%), linear-gradient(135deg, currentColor 50%, transparent 50%); background-position: calc(100% - 18px) 52%, calc(100% - 13px) 52%; background-size: 5px 5px; background-repeat: no-repeat; }
label { display: grid; gap: 6px; font-size: 14px; color: var(--ink-2); font-weight: 500; }
::placeholder { color: var(--faint); }

/* ---------- surfaces ---------- */
.glass, .top, .strong { background: var(--glass); border: 1px solid var(--line); box-shadow: var(--shadow); }
.strong { background: var(--surface); }
.pad { padding: 28px; border-radius: var(--r-card); }
.md, pre.code, .drop, .modal .panel { background: var(--surface); }
.wrap { width: min(var(--page), calc(100% - 48px)); margin: 0 auto; }
.row { display: flex; gap: 10px; flex-wrap: wrap; align-items: center; }
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
.muted, .meta, .brand small { color: var(--muted); }
.meta { font-size: 13px; }
.warn { color: #E5484D; }
.kicker, .eyebrow, .brandline { font-size: 12px; font-weight: 650; letter-spacing: .14em; text-transform: uppercase; color: var(--muted); margin: 0 0 10px; }
.grad-text { background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; }
#app { padding: 24px 0 64px; display: grid; gap: 20px; min-height: 60vh; }
#app > * { min-width: 0; }
.pg-in { animation: pgIn .55s var(--ease-out) both; }
@keyframes pgIn { from { opacity: 0; transform: translate3d(0, 18px, 0); } }
.reveal { animation: rise .7s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 55ms); }
@keyframes rise { from { opacity: 0; transform: translate3d(0, 22px, 0) scale(.985); } }

/* ---------- header ---------- */
.topslot { position: relative; height: 80px; max-height: 92px; flex: 0 0 auto; overflow: visible; z-index: 20; }
.top {
  position: fixed; top: 12px; left: 50%; transform: translateX(-50%); z-index: 30;
  width: min(var(--page), calc(100% - 24px)); height: 56px; max-height: 72px; overflow: hidden;
  border-radius: 20px; background: var(--glass); view-transition-name: site-top;
  -webkit-backdrop-filter: blur(var(--blur)) saturate(180%); backdrop-filter: blur(var(--blur)) saturate(180%);
  transition: width .5s var(--ease-out), box-shadow .3s ease, background-color .3s ease, top .4s var(--ease-out);
}
.top .wrap {
  position: relative; display: grid; grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); align-items: center;
  column-gap: 12px; width: 100%; height: 100%; min-height: 0; max-height: 72px; padding: 0 8px 0 14px; margin: 0;
}
.top.slim { width: min(1040px, calc(100% - 24px)); background: var(--surface); box-shadow: var(--hi), var(--sh-3); }
.top-left { grid-column: 1; grid-row: 1; display: flex; align-items: center; gap: 10px; min-width: 0; overflow: hidden; }
.top-mid { grid-column: 2; grid-row: 1; display: flex; align-items: center; justify-content: center; min-width: 0; justify-self: center; }
.actions { grid-column: 3; grid-row: 1; display: flex; align-items: center; justify-content: flex-end; gap: 2px; min-width: 0; justify-self: stretch; }
.brand { display: flex; align-items: center; gap: 10px; text-decoration: none; color: var(--ink); flex: 0 0 auto; min-width: max-content; border-radius: 12px; }
.mark { width: 32px; height: 32px; display: block; flex: 0 0 auto; overflow: visible; filter: drop-shadow(0 4px 10px rgba(79,91,255,.28)); transition: transform .5s var(--spring); }
.brand:hover .mark { transform: rotate(-8deg) scale(1.06); }
.brand .btxt { display: grid; min-width: max-content; }
.brand b { font-size: 15px; font-weight: 750; letter-spacing: .06em; line-height: 1.1; white-space: nowrap; }
.brand small { font-size: 11px; line-height: 1.2; white-space: nowrap; letter-spacing: .02em; }
.nav { position: relative; display: flex; align-items: center; gap: 2px; margin-left: 10px; min-width: 0; padding: 4px; border-radius: 999px; }
.nav a { position: relative; z-index: 1; text-decoration: none; color: var(--muted); padding: 7px 13px; border-radius: 999px; white-space: nowrap; font-size: 13.5px; font-weight: 550; transition: color .2s ease, transform .45s var(--spring); }
.nav a:hover { color: var(--ink); }
.nav a[aria-current="page"] { color: var(--ink); }
.nav a:active { transform: scale(.94); }
.ind { position: absolute; left: 0; top: 0; z-index: 0; border-radius: 999px; pointer-events: none; background: var(--surface-solid); box-shadow: var(--sh-1), var(--hi); transition: transform .55s var(--spring), width .55s var(--spring), height .3s ease, opacity .2s ease; opacity: 0; }
html[data-theme="dark"] .ind { background: rgba(255,255,255,.10); }
.adminbtn { min-height: 38px; padding: 0 16px; margin-left: 6px; font-size: 13px; }
.adminbtn .short { display: none; }
#themeBtn .ic-sun { display: none; }
html[data-theme="dark"] #themeBtn .ic-sun { display: inline-block; }
html[data-theme="dark"] #themeBtn .ic-moon { display: none; }
#themeBtn .ic, #bgBtn .ic { transition: transform .6s var(--spring); }
#themeBtn:active .ic { transform: rotate(-40deg) scale(.85); }
#bgBtn .lbl, #themeBtn .lbl { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0,0,0,0); }

/* music */
#musicCtl { display: flex; align-items: center; gap: 2px; padding: 3px; border-radius: 999px; background: var(--field); border: 1px solid var(--hair); }
#musicCtl[hidden] { display: none !important; }
.top #musicCtl button { width: 34px; height: 34px; min-height: 34px; padding: 0; border-radius: 50%; background: transparent; border: 0; box-shadow: none; color: var(--ink); font-size: 0; position: relative; }
.top #musicCtl button::before { content: ""; width: 15px; height: 15px; background: currentColor; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.top #musicCtl button:hover { background: var(--accent-soft); }
.top #musicCtl button::after, .adminbtn::after { content: ""; position: absolute; inset: -5px; }
.adminbtn { position: relative; }
.top #musicCtl #musicPlay { background: var(--ink); color: var(--surface-solid); }
html[data-theme="dark"] .top #musicCtl #musicPlay { background: #F3F4F8; color: #0A0B10; }
#musicCtl.need-tap { box-shadow: 0 0 0 4px var(--accent-soft); border-color: var(--accent-line); }
#musicCtl.need-tap #musicPlay { animation: musicPulse 1.4s ease-in-out infinite; }
@keyframes musicPulse { 50% { transform: scale(1.1); } }
#musicCtl .mlbl { display: none; font-size: 12px; color: var(--muted); max-width: 96px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; padding: 0 8px 0 4px; }


/* bg popover */
#bgpop { position: fixed; right: 16px; top: 76px; z-index: 45; width: min(380px, calc(100vw - 24px)); max-height: min(78vh, 640px); overflow: auto; padding: 18px; border-radius: 24px; display: grid; gap: 12px; background: var(--surface); -webkit-backdrop-filter: blur(24px) saturate(180%); backdrop-filter: blur(24px) saturate(180%); box-shadow: var(--hi), var(--sh-3); transform-origin: top right; animation: popIn .4s var(--spring) both; }
#bgpop[hidden] { display: none; }
@keyframes popIn { from { opacity: 0; transform: translateY(-8px) scale(.94); } }
#bgpop .bgh { display: flex; justify-content: space-between; align-items: center; }
#bgpop .bggrid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
#bgpop .bgsw { display: grid; gap: 6px; justify-items: stretch; padding: 6px; min-height: 0; border-radius: 16px; box-shadow: none; font-size: 12px; font-weight: 500; background: transparent; border: 1px solid transparent; color: var(--ink-2); }
#bgpop .bgsw i { display: block; width: 100%; height: 44px; border-radius: 12px; border: 1px solid var(--hair); }
#bgpop .bgsw[aria-pressed="true"] { border-color: var(--accent); background: var(--accent-soft); }
#bgpop .bgrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; }
#bgpop .bgrow input[type="color"] { width: 56px; min-height: 36px; }
#bgpop .bgrow2 { display: flex; gap: 8px; align-items: end; flex-wrap: wrap; }
#bgpop .bgrow2 label { flex: 1 1 160px; font-size: 13px; }
#bgpop .filebtn { border: 1px solid var(--hair-2); border-radius: 999px; padding: 10px 16px; background: var(--surface); flex: 0 0 auto; text-align: center; display: inline-flex; }
#bgpop .meta { margin: 0; font-size: 12px; }

/* ---------- hero ---------- */
.hero-x { position: relative; padding: 56px 56px 48px; border-radius: 32px; overflow: hidden; background: var(--glass); border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-2); -webkit-backdrop-filter: blur(var(--blur)) saturate(170%); backdrop-filter: blur(var(--blur)) saturate(170%); isolation: isolate; }
.hero-x::before { content: ""; position: absolute; z-index: -1; right: -10%; top: -40%; width: 60%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle, rgba(139,92,246,.22), rgba(79,91,255,.10) 40%, transparent 68%); pointer-events: none; }
.hx-eyebrow { display: inline-flex; align-items: center; gap: 10px; padding: 6px 14px 6px 10px; border-radius: 999px; background: var(--surface); border: 1px solid var(--hair); font-size: 12.5px; font-weight: 600; color: var(--ink-2); margin-bottom: 24px; box-shadow: var(--sh-1); }
.pulse-dot { width: 8px; height: 8px; border-radius: 50%; background: #10B981; box-shadow: 0 0 0 0 rgba(16,185,129,.6); animation: pulse 1.8s infinite; flex: 0 0 auto; }
@keyframes pulse { 70% { box-shadow: 0 0 0 9px rgba(16,185,129,0); } 100% { box-shadow: 0 0 0 0 rgba(16,185,129,0); } }
.hx-title { margin: 0; font-size: clamp(36px, 6.4vw, 76px); line-height: 1.06; letter-spacing: -.045em; font-weight: 750; }
.hx-title .grad-text { display: inline-block; padding-bottom: .06em; }
.hero-x .bio { margin: 22px 0 0; max-width: 40em; font-size: clamp(15px, 1.6vw, 18px); line-height: 1.75; color: var(--muted); }
.hx-cta { display: flex; flex-wrap: wrap; gap: 12px; margin: 30px 0 28px; }
.hx-cta .ic { width: 16px; height: 16px; transition: transform .45s var(--spring); }
.hx-cta .btn:hover .ic { transform: translateX(3px); }
.pills { display: flex; flex-wrap: wrap; gap: 8px; }
.pill { display: inline-flex; align-items: center; gap: 7px; min-height: 34px; padding: 0 13px; border-radius: 999px; font-size: 13px; font-weight: 500; background: var(--field); border: 1px solid var(--hair); color: var(--ink-2); text-decoration: none; line-height: 1; transition: transform .45s var(--spring), border-color .2s ease, background-color .2s ease; }
.pill .ic { width: 15px; height: 15px; color: var(--muted); }
a.pill:hover { border-color: var(--accent-line); background: var(--surface); }
a.pill:active { transform: scale(.95); }

/* ---------- bento ---------- */
.sec-head { display: flex; align-items: end; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin: 28px 4px 4px; }
.sec-title { margin: 0; font-size: clamp(26px, 3.4vw, 40px); line-height: 1.12; letter-spacing: -.035em; font-weight: 720; }
.sec-head .kicker { margin-bottom: 8px; }
.bento { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); grid-auto-rows: 176px; gap: 16px; }
.tile {
  position: relative; display: flex; flex-direction: column; justify-content: flex-end; gap: 4px; min-width: 0; overflow: hidden; isolation: isolate;
  padding: 22px; border-radius: var(--r-card); text-decoration: none; color: var(--ink);
  background: var(--surface); border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-1);
  transition: transform .55s var(--spring), box-shadow .3s ease, border-color .3s ease;
}
.tile:hover { transform: translateY(-4px); box-shadow: var(--hi), var(--sh-3); }
.tile:active { transform: scale(.975); transition-duration: .15s; }
.tile h3 { margin: 0; font-size: 18px; line-height: 1.3; letter-spacing: -.02em; font-weight: 680; }
.tile p { margin: 0; font-size: 13px; color: var(--muted); line-height: 1.5; }
.tile .kicker { margin: 0 0 2px; font-size: 11px; }
.tile-ic { position: absolute; top: 20px; left: 22px; width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; background: var(--tint, var(--accent-soft)); color: var(--tc, var(--accent)); }
.tile-ic .ic { width: 22px; height: 22px; }
.tile .go { position: absolute; top: 20px; right: 20px; width: 32px; height: 32px; border-radius: 50%; display: grid; place-items: center; color: var(--muted); background: var(--field); border: 1px solid var(--hair); transition: transform .5s var(--spring), color .2s ease; }
.tile .go .ic { width: 15px; height: 15px; }
.tile:hover .go { transform: rotate(-45deg); color: var(--ink); }
.t-ride { --tint: rgba(16,185,129,.12); --tc: #0E9F6E; }
.t-pp { --tint: rgba(255,122,89,.14); --tc: #E8603C; }
.t-tech { --tint: rgba(79,91,255,.12); --tc: #4F5BFF; }
.t-hs { --tint: rgba(234,179,8,.14); --tc: #B7791F; }
.t-speed { --tint: rgba(14,165,233,.13); --tc: #0284C7; }
.t-drive { --tint: rgba(139,92,246,.13); --tc: #7C3AED; }
html[data-theme="dark"] .tile { --tc: #C7CBFF; }
.t-latest { grid-column: span 2; grid-row: span 2; padding: 0; justify-content: flex-start; }
.t-latest .cover { position: absolute; inset: 0; z-index: -1; border-radius: 0; }
.t-latest .cover img, .t-latest .cover .ph { width: 100%; height: 100%; object-fit: cover; transition: transform 1.2s var(--ease-out); }
.t-latest:hover .cover img, .t-latest:hover .cover .ph { transform: scale(1.04); }
.t-latest::after { content: ""; position: absolute; inset: 0; z-index: -1; background: linear-gradient(180deg, rgba(8,10,18,0) 30%, rgba(8,10,18,.72) 100%); }
.t-latest .tile-body { margin-top: auto; padding: 28px; color: #fff; display: grid; gap: 8px; }
.t-latest h3 { color: #fff; font-size: clamp(22px, 2.4vw, 30px); letter-spacing: -.03em; line-height: 1.2; }
.t-latest p { color: rgba(255,255,255,.78); font-size: 14px; max-width: 46ch; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; }
.t-latest .kicker { color: rgba(255,255,255,.8); }
.t-latest .go { background: rgba(255,255,255,.18); border-color: rgba(255,255,255,.25); color: #fff; -webkit-backdrop-filter: blur(8px); backdrop-filter: blur(8px); }
.t-ai { grid-column: span 2; background: #0B0C12; color: #fff; border-color: rgba(255,255,255,.08); }
.t-ai::before { content: ""; position: absolute; z-index: -1; width: 70%; aspect-ratio: 1; right: -18%; top: -70%; border-radius: 50%; background: conic-gradient(from 200deg, #4F5BFF, #8B5CF6, #FF7A59, #4F5BFF); filter: blur(42px); opacity: .7; animation: spin 16s linear infinite; }
@keyframes spin { to { transform: rotate(360deg); } }
.t-ai h3 { color: #fff; font-size: 22px; }
.t-ai p, .t-ai .kicker { color: rgba(255,255,255,.66); }
.t-ai .tile-ic { background: rgba(255,255,255,.1); color: #fff; }
.t-ai .go { background: rgba(255,255,255,.1); border-color: rgba(255,255,255,.16); color: #fff; }
.tile .count { font-variant-numeric: tabular-nums; }

/* ---------- posts ---------- */
.home-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
.chips { position: relative; display: flex; gap: 2px; padding: 4px; border-radius: 999px; background: var(--glass); border: 1px solid var(--line); box-shadow: var(--hi); overflow-x: auto; scrollbar-width: none; max-width: 100%; }
.chips::-webkit-scrollbar { display: none; }
.chips button { position: relative; z-index: 1; min-height: 38px; padding: 0 16px; font-size: 13.5px; font-weight: 550; border-radius: 999px; border: 0; background: transparent; box-shadow: none; color: var(--muted); flex: 0 0 auto; }
.chips button:hover { color: var(--ink); background: transparent; box-shadow: none; }
.chips button[aria-pressed="true"] { color: var(--surface-solid); }
.chips .ind { background: var(--ink); box-shadow: 0 6px 16px -6px rgba(10,11,16,.5); }
html[data-theme="dark"] .chips .ind { background: #F3F4F8; }
html[data-theme="dark"] .chips button[aria-pressed="true"] { color: #0A0B10; }
.search { position: relative; flex: 0 1 320px; min-width: 200px; }
.search .ic { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: var(--faint); pointer-events: none; }
.search input { padding-left: 42px; border-radius: 999px; background: var(--glass); border-color: var(--line); box-shadow: var(--hi); }
.masonry { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 20px; align-items: stretch; }
.card { position: relative; margin: 0; border-radius: var(--r-card); overflow: hidden; display: flex; flex-direction: column; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-1); transition: transform .55s var(--spring), box-shadow .3s ease; }
.card:hover { transform: translateY(-5px); box-shadow: var(--hi), var(--sh-3); }
.card:active { transform: scale(.98); transition-duration: .15s; }
.card-a { display: flex; flex-direction: column; height: 100%; color: inherit; text-decoration: none; border-radius: inherit; }
.card-a:focus-visible { outline-offset: -3px; border-radius: var(--r-card); }
.card a { color: inherit; text-decoration: none; }
.cover { position: relative; overflow: hidden; aspect-ratio: 16 / 10; margin: 0; background: var(--field); }
.card .cover { border-radius: 0; }
.cover img, .card img { width: 100%; height: 100%; object-fit: cover; display: block; transition: transform 1s var(--ease-out); }
.card:hover .cover img, .card:hover .cover .ph { transform: scale(1.05); }
.ph { width: 100%; height: 100%; display: grid; place-items: center; font-size: clamp(44px, 6vw, 72px); font-weight: 800; letter-spacing: -.04em; color: rgba(255,255,255,.95); text-shadow: 0 8px 30px rgba(0,0,0,.18); transition: transform 1s var(--ease-out); background: linear-gradient(135deg, #6E7BFF, #A78BFA 55%, #FFB199); }
.ph[data-c="1"] { background: linear-gradient(135deg, #34D399, #10B981 40%, #60A5FA); }
.ph[data-c="2"] { background: linear-gradient(135deg, #FF9A76, #FF7A59 40%, #F472B6); }
.ph[data-c="3"] { background: linear-gradient(135deg, #4F5BFF, #6366F1 40%, #22D3EE); }
.ph[data-c="0"] { background: linear-gradient(135deg, #FBBF24, #F59E0B 35%, #F472B6); }
.card .body { padding: 20px 22px 22px; display: flex; flex-direction: column; flex: 1 1 auto; gap: 8px; }
.meta-row { display: flex; justify-content: space-between; align-items: center; gap: 8px; }
.catchip { display: inline-flex; align-items: center; min-height: 24px; padding: 0 10px; border-radius: 999px; font-size: 11.5px; font-weight: 650; letter-spacing: .02em; background: var(--accent-soft); color: var(--accent); white-space: nowrap; }
.card .body h2 { font-size: 19px; margin: 4px 0 0; line-height: 1.35; letter-spacing: -.02em; font-weight: 680; }
.card .body > p { margin: 0; color: var(--muted); font-size: 14px; line-height: 1.65; display: -webkit-box; -webkit-line-clamp: 3; -webkit-box-orient: vertical; overflow: hidden; }
.card .footrow { display: flex; justify-content: space-between; align-items: center; gap: 10px; margin-top: auto; padding-top: 10px; font-size: 12.5px; color: var(--faint); }
.card .more { color: var(--ink); font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.card .more .ic { width: 15px; height: 15px; transition: transform .45s var(--spring); }
.card:hover .more .ic { transform: translateX(4px); }
.stats-i { display: inline-flex; align-items: center; gap: 4px; font-variant-numeric: tabular-nums; }
.stats-i .ic { width: 14px; height: 14px; }
.empty { grid-column: 1 / -1; text-align: center; padding: 56px 24px; border-radius: var(--r-card); background: var(--glass); border: 1px dashed var(--hair-2); }
.empty .em-ic { width: 56px; height: 56px; margin: 0 auto 14px; border-radius: 18px; display: grid; place-items: center; background: var(--accent-soft); color: var(--accent); }
.empty .em-ic .ic { width: 26px; height: 26px; }
.empty h2 { margin: 0 0 6px; font-size: 20px; letter-spacing: -.02em; }
.empty p { margin: 0 0 16px; color: var(--muted); }

/* skeleton */
.sk { position: relative; overflow: hidden; background: var(--field); border-radius: 14px; }
.sk::after { content: ""; position: absolute; inset: 0; transform: translateX(-100%); background: linear-gradient(90deg, transparent, rgba(255,255,255,.55), transparent); animation: shimmer 1.3s infinite; }
html[data-theme="dark"] .sk::after { background: linear-gradient(90deg, transparent, rgba(255,255,255,.06), transparent); }
@keyframes shimmer { to { transform: translateX(100%); } }
.sk-page { display: grid; gap: 20px; }
.sk-hero { height: 320px; border-radius: 32px; }
.sk-line { height: 16px; }
.sk-title { height: 44px; width: 70%; border-radius: 12px; }
.sk-cover { aspect-ratio: 16 / 9; border-radius: 24px; }
.sk-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; }
.sk-card { height: 340px; border-radius: 24px; }

/* ---------- page hero (inner pages) ---------- */
.page-hero, .hero { padding: 48px 8px 12px; background: transparent; border: 0; box-shadow: none; border-radius: 0; -webkit-backdrop-filter: none; backdrop-filter: none; }
.page-title, .hero h1, .page-hero h1 { margin: 0; font-size: clamp(34px, 5.4vw, 64px); line-height: 1.08; letter-spacing: -.045em; font-weight: 750; }
.lede, .hero p:not(.brandline) { margin: 16px 0 0; font-size: clamp(15px, 1.6vw, 19px); color: var(--muted); line-height: 1.7; max-width: 46em; }
.values-grid { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 16px; }
.vcard { position: relative; padding: 30px 28px 32px; border-radius: var(--r-card); background: var(--surface); border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-1); overflow: hidden; transition: transform .55s var(--spring), box-shadow .3s ease; }
.vcard:hover { transform: translateY(-4px); box-shadow: var(--hi), var(--sh-3); }
.vcard .vnum { display: block; font-size: 56px; line-height: 1; font-weight: 800; letter-spacing: -.06em; background: var(--grad); -webkit-background-clip: text; background-clip: text; -webkit-text-fill-color: transparent; color: transparent; margin-bottom: 26px; font-variant-numeric: tabular-nums; }
.vcard h2 { margin: 0 0 10px; font-size: 21px; letter-spacing: -.02em; line-height: 1.3; }
.vcard p { margin: 0; color: var(--muted); font-size: 15px; line-height: 1.75; }
.vcard .meta { position: absolute; top: 28px; right: 28px; margin: 0; font-size: 12px; letter-spacing: .1em; }

/* ---------- article ---------- */
.article { display: grid; gap: 0; justify-items: center; }
.article > * { width: min(760px, 100%); }
.art-head { padding: 32px 0 28px; }
.back-link { display: inline-flex; align-items: center; gap: 6px; min-height: 40px; padding: 0 14px 0 10px; margin-bottom: 26px; border-radius: 999px; color: var(--ink-2); text-decoration: none; font-size: 14px; font-weight: 550; background: var(--glass); border: 1px solid var(--line); transition: transform .45s var(--spring), background-color .2s ease; }
.back-link:hover { background: var(--surface); }
.back-link:hover .ic { transform: translateX(-3px); }
.back-link .ic { transition: transform .45s var(--spring); width: 16px; height: 16px; }
.back-link:active { transform: scale(.95); }
.art-meta-top { display: flex; align-items: center; gap: 12px; margin-bottom: 16px; }
.art-title { font-size: clamp(32px, 5vw, 56px) !important; }
.art-lede { margin: 18px 0 0; font-size: clamp(16px, 1.9vw, 20px); line-height: 1.7; color: var(--muted); }
.art-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 8px 18px; margin-top: 24px; color: var(--muted); font-size: 14px; }
.art-meta > span { display: inline-flex; align-items: center; gap: 6px; }
.art-meta .ic { width: 16px; height: 16px; }
.heart { min-height: 40px; padding: 0 16px; gap: 7px; font-size: 14px; }
.heart .ic { width: 17px; height: 17px; transition: transform .5s var(--spring); }
.heart:hover .ic { color: #F43F5E; }
.heart.pop { color: #F43F5E; border-color: rgba(244,63,94,.35); background: rgba(244,63,94,.08); }
.heart.pop .ic { animation: pop .6s var(--spring); background: #F43F5E; }
@keyframes pop { 30% { transform: scale(1.45) rotate(-8deg); } 60% { transform: scale(.9); } }
.art-cover { width: min(1040px, 100%) !important; aspect-ratio: 21 / 10; border-radius: 28px; box-shadow: var(--sh-3); margin: 0 0 8px; }
.art-cover .ph { font-size: clamp(64px, 12vw, 140px); }
.art-body { padding: 40px 0 12px; background: transparent !important; border: 0 !important; box-shadow: none !important; }
.md { border-radius: var(--r-card); font-size: 17px; line-height: 1.9; color: var(--ink-2); overflow-wrap: anywhere; }
.art-body.md { font-size: 17.5px; }
.md > :first-child { margin-top: 0; }
.md h1, .md h2, .md h3 { margin: 1.8em 0 .6em; line-height: 1.3; letter-spacing: -.025em; font-weight: 700; color: var(--ink); }
.md h1 { font-size: 1.75em; } .md h2 { font-size: 1.45em; } .md h3 { font-size: 1.2em; }
.md p { margin: 0 0 1.2em; }
.md img { border-radius: 18px; display: block; margin: 1.4em auto; box-shadow: var(--sh-2); height: auto; }
.md a { color: var(--link); }
.md ul, .md ol { padding-left: 1.4em; margin: 0 0 1.2em; }
.md li { margin: .3em 0; }
.md hr { border: 0; height: 1px; background: var(--hair-2); margin: 2.4em 0; }
.md blockquote { margin: 1.6em 0; padding: 4px 0 4px 22px; border-left: 3px solid; border-image: var(--grad) 1; color: var(--ink); font-size: 1.06em; background: none; border-radius: 0; }
.md code { font-family: var(--mono); font-size: .88em; padding: .15em .45em; border-radius: 6px; background: var(--accent-soft); color: var(--ink); }
.md pre code { padding: 0; background: none; }
.md table { border-collapse: collapse; width: 100%; font-size: .92em; }
.md th, .md td { border-bottom: 1px solid var(--hair-2); padding: 10px 12px; text-align: left; }
.md th { font-weight: 650; color: var(--ink); }
.tablewrap { overflow-x: auto; }
.codewrap { margin: 1.4em 0; border-radius: 16px; overflow: hidden; border: 1px solid var(--hair-2); background: #0D0F16; }
.codebar { display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; font-size: 12px; color: #9AA2B2; background: rgba(255,255,255,.04); border-bottom: 1px solid rgba(255,255,255,.06); font-family: var(--mono); }
.codebar button { min-height: 28px; padding: 0 10px; font-size: 12px; background: rgba(255,255,255,.08); color: #E6E8EE; border-color: rgba(255,255,255,.1); box-shadow: none; }
pre.code { margin: 0; padding: 16px 18px; overflow: auto; font-family: var(--mono); font-size: 13.5px; line-height: 1.65; background: #0D0F16 !important; color: #E6E8EE; }
.kw { color: #A5B4FC; } .num { color: #FDBA74; } .str { color: #86EFAC; } .cm { color: #6B7280; font-style: italic; }
.math.block { display: block; text-align: center; margin: 12px 0; }
.frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; padding: 0 4px; font-size: .92em; }
.frac .fn { border-bottom: 1px solid currentColor; }
.poster-form, .stats { display: grid; gap: 12px; }
.poster-form textarea { min-height: 96px; }
.pn { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin: 24px 0 8px; }
.pn a { display: grid; gap: 6px; padding: 20px 22px; border-radius: 20px; text-decoration: none; color: var(--ink); background: var(--glass); border: 1px solid var(--line); transition: transform .55s var(--spring), background-color .2s ease, box-shadow .3s ease; min-width: 0; }
.pn a:hover { background: var(--surface); box-shadow: var(--sh-2); transform: translateY(-3px); }
.pn a:active { transform: scale(.97); }
.pn small { color: var(--muted); font-size: 12px; letter-spacing: .1em; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; }
.pn small .ic { width: 14px; height: 14px; }
.pn b { font-size: 16px; font-weight: 650; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.pn .next { text-align: right; justify-items: end; }
#progress { position: fixed; left: 0; top: 0; height: 3px; width: 0; background: var(--grad); z-index: 60; border-radius: 0 3px 3px 0; box-shadow: 0 0 12px rgba(139,92,246,.5); transition: width .1s linear; }

/* ---------- about ---------- */
.about { display: grid; gap: 20px; justify-items: center; }
.about > * { width: min(820px, 100%); }
.about-hero { display: flex; align-items: center; gap: 24px; padding: 40px 0 8px; }
.avatar { width: 96px; height: 96px; flex: 0 0 auto; border-radius: 30px; display: grid; place-items: center; font-size: 40px; font-weight: 800; color: #fff; background: linear-gradient(160deg, #9A9AA0, #6E6E75); box-shadow: 0 20px 40px -18px rgba(16,18,24,.45), inset 0 1px 0 rgba(255,255,255,.4); }
.about-md { padding: 36px 40px; border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-1); }
.contact { display: flex; flex-wrap: wrap; gap: 8px; }

/* ---------- generic panels (speed / drive / admin) ---------- */
.speed, .drive, .admin, .ai { display: grid; gap: 16px; }
.glass.strong.pad, .glass.pad { -webkit-backdrop-filter: none; backdrop-filter: none; }
.glass.strong.pad h1 { font-size: clamp(28px, 4vw, 40px); letter-spacing: -.035em; line-height: 1.15; margin: 0 0 10px; }
.glass.strong.pad h2 { font-size: 20px; letter-spacing: -.02em; margin: 0 0 12px; }
.admin > .row:first-child { position: sticky; top: 84px; z-index: 5; padding: 6px; border-radius: 999px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-2); flex-wrap: nowrap; overflow-x: auto; scrollbar-width: none; gap: 2px; }
.admin > .row:first-child > * { flex: 0 0 auto; min-height: 38px; box-shadow: none; border-color: transparent; background: transparent; }
.admin > .row:first-child [aria-pressed="true"] { background: var(--ink); color: var(--surface-solid); }
html[data-theme="dark"] .admin > .row:first-child [aria-pressed="true"] { background: #F3F4F8; color: #0A0B10; }
[data-tab][aria-pressed="true"], [data-mode][aria-pressed="true"], [data-t][aria-pressed="true"] { background: var(--ink); color: var(--surface-solid); border-color: transparent; }
html[data-theme="dark"] [data-tab][aria-pressed="true"], html[data-theme="dark"] [data-mode][aria-pressed="true"], html[data-theme="dark"] [data-t][aria-pressed="true"] { background: #F3F4F8; color: #0A0B10; }
section.glass.strong.pad:has(#loginForm) { width: min(440px, 100%); justify-self: center; margin-top: 40px; padding: 40px 32px; border-radius: 28px; box-shadow: var(--hi), var(--sh-3); }
section.glass.strong.pad:has(#loginForm) .brandline { display: inline-flex; padding: 6px 12px; border-radius: 999px; background: var(--accent-soft); color: var(--accent); letter-spacing: .08em; }
#loginForm button[type="submit"] { width: 100%; min-height: 50px; margin-top: 6px; }
.table { width: 100%; border-collapse: separate; border-spacing: 0; font-size: 14px; }
.table th { font-size: 12px; text-transform: uppercase; letter-spacing: .08em; color: var(--muted); font-weight: 600; }
.table th, .table td { padding: 12px 10px; border-bottom: 1px solid var(--hair); text-align: left; vertical-align: middle; }
.table tbody tr { transition: background-color .15s ease; }
.table tbody tr:hover { background: var(--accent-soft); }
.toolbar { margin: 12px 0; }
.toolbar input { flex: 1 1 200px; width: auto; }
.toolbar select { width: auto; flex: 0 0 auto; }
.drop { border-radius: 20px; padding: 28px 16px; border: 1.5px dashed var(--hair-2); text-align: center; color: var(--muted); background: var(--field); transition: border-color .2s ease, background-color .2s ease; }
.drop:hover { border-color: var(--accent); background: var(--accent-soft); }
.score { width: 104px; height: 104px; border-radius: 50%; display: grid; place-items: center; background: conic-gradient(var(--accent) calc(var(--p) * 1%), var(--hair) 0); }
.score span { width: 82px; height: 82px; border-radius: 50%; display: grid; place-items: center; background: var(--surface-solid); font-size: 24px; font-weight: 700; }
.gauge { width: min(420px, 100%); height: auto; aspect-ratio: 420 / 160; display: block; margin: 12px auto; }
.chart { width: 100%; height: auto; aspect-ratio: 640 / 180; display: block; margin-top: 10px; border-radius: 14px; }
.speed #startSpeed { min-width: 140px; }
.netcard { text-align: left; display: grid; grid-template-columns: 84px 1fr; gap: 8px 12px; margin: 14px 0; padding: 14px; border-radius: 16px; font-size: 13px; }
.side, .thread, .panel { border-radius: var(--r-card); padding: 14px; }
.msgs { display: grid; gap: 10px; max-height: 62vh; overflow: auto; }
.composer { border-radius: 20px; padding: 10px; display: grid; gap: 8px; background: var(--surface); }
.previews { display: flex; gap: 8px; flex-wrap: wrap; }
.previews img { width: 72px; height: 72px; object-fit: cover; border-radius: 14px; display: block; }
.previews button.mini { padding: 2px; border-radius: 14px; min-height: 0; }
.think { display: none !important; }

/* ---------- modal & toast ---------- */
.modal { position: fixed; inset: 0; z-index: 70; display: grid; place-items: center; padding: 16px; background: rgba(8,10,16,.36); -webkit-backdrop-filter: blur(6px); backdrop-filter: blur(6px); animation: fadeIn .25s ease both; }
.modal .panel { width: min(960px, 100%); max-height: min(86vh, 900px); overflow: auto; border-radius: 28px; padding: 24px; background: var(--surface-solid); box-shadow: var(--sh-3); animation: sheetIn .5s var(--spring) both; }
@keyframes fadeIn { from { opacity: 0; } }
@keyframes sheetIn { from { opacity: 0; transform: translateY(24px) scale(.96); } }
#toast { position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%); z-index: 90; padding: 12px 20px; border-radius: 999px; font-size: 14px; font-weight: 550; background: var(--ink); color: var(--surface-solid); border: 0; box-shadow: var(--sh-3); animation: toastIn .5s var(--spring) both; max-width: calc(100vw - 32px); }
html[data-theme="dark"] #toast { background: #F3F4F8; color: #0A0B10; }
@keyframes toastIn { from { opacity: 0; transform: translate(-50%, 16px) scale(.9); } }
#toast[hidden], #splash[hidden], [hidden] { display: none !important; }

/* ---------- footer ---------- */
.foot { margin-top: 40px; background: transparent; border: 0; box-shadow: none; }
.foot .wrap { display: grid; grid-template-columns: 1.6fr 1fr 1fr 1fr; gap: 32px; padding: 40px 0 48px; border-top: 1px solid var(--hair-2); }
.f-brand { display: flex; gap: 14px; align-items: flex-start; }
.f-brand .mark { width: 40px; height: 40px; }
.foot strong { display: block; font-size: 15px; font-weight: 700; letter-spacing: -.01em; margin-bottom: 4px; }
.foot small { display: block; font-size: 13px; line-height: 1.7; color: var(--muted); }
.f-col { display: grid; gap: 10px; align-content: start; font-size: 14px; }
.f-h { font-size: 12px; font-weight: 650; letter-spacing: .12em; text-transform: uppercase; color: var(--faint); margin-bottom: 2px; }
.f-col a, .f-col span:not(.f-h) { color: var(--ink-2); text-decoration: none; transition: color .2s ease; }
.f-col a:hover { color: var(--accent); }

/* ---------- splash ---------- */
html:not(.splash-done), html:not(.splash-done) body { height: 100%; height: 100dvh; max-height: 100dvh; overflow: hidden; overscroll-behavior: none; }
html:not(.splash-done) body { min-height: 0; }
html:not(.splash-done) .topslot { height: 80px !important; max-height: 92px !important; min-height: 0 !important; flex: 0 0 auto !important; }
html:not(.splash-done) .top { height: 56px !important; max-height: 72px !important; overflow: hidden !important; }
html:not(.splash-done) .top .wrap { max-height: 72px !important; overflow: hidden !important; }
#splash {
  position: fixed; inset: 0; width: 100%; height: 100%; height: 100dvh; max-height: 100dvh; z-index: 80;
  display: grid; place-items: center; padding: max(16px, env(safe-area-inset-top, 0px)) 16px max(16px, env(safe-area-inset-bottom, 0px));
  overflow: auto; overscroll-behavior: none;
  background: radial-gradient(120% 80% at 50% 0%, rgba(255,255,255,.55), rgba(240,243,250,.78));
  -webkit-backdrop-filter: blur(18px) saturate(160%); backdrop-filter: blur(18px) saturate(160%);
  transition: opacity .7s var(--ease-out), -webkit-backdrop-filter .7s ease, backdrop-filter .7s ease;
}
html[data-theme="dark"] #splash { background: radial-gradient(120% 80% at 50% 0%, rgba(20,22,32,.6), rgba(6,7,11,.82)); }
html.splash-done #splash:not(.out) { display: none !important; }
#splash.out { opacity: 0; pointer-events: none; -webkit-backdrop-filter: blur(0); backdrop-filter: blur(0); }
#splash.out .panel { transform: translateY(-16px) scale(1.04); opacity: 0; transition: transform .7s var(--ease-out), opacity .45s ease; }
#splash .panel { position: relative; width: min(420px, 100%); max-height: min(92dvh, 760px); overflow: auto; text-align: center; padding: 40px 28px 24px; border-radius: 32px; background: var(--surface); border: 1px solid var(--line); box-shadow: var(--hi), var(--sh-3); }
#splash .panel > * { animation: rise .8s var(--ease-out) both; }
#splash .panel > :nth-child(2) { animation-delay: .06s; } #splash .panel > :nth-child(3) { animation-delay: .12s; } #splash .panel > :nth-child(4) { animation-delay: .18s; } #splash .panel > :nth-child(5) { animation-delay: .24s; } #splash .panel > :nth-child(6) { animation-delay: .3s; } #splash .panel > :nth-child(7) { animation-delay: .36s; }
.sp-mark { width: 72px; height: 72px; margin: 0 auto 20px; filter: drop-shadow(0 16px 30px rgba(79,91,255,.4)); }
.sp-mark svg { width: 100%; height: 100%; display: block; animation: markIn 1.1s var(--spring) both; }
@keyframes markIn { from { transform: scale(.6) rotate(-20deg); opacity: 0; } }
#splash h1 { margin: 0; white-space: nowrap; font-size: clamp(26px, 8.2vw, 34px); line-height: 1.1; letter-spacing: -.04em; font-weight: 800; }
#splash .splash-sub { margin: 10px 0 0; font-size: 15px; color: var(--muted); }
#splash .netcard { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin: 26px 0 22px; padding: 0; background: none; border: 0; box-shadow: none; }
#splash .nc { display: grid; gap: 2px; text-align: left; padding: 12px 14px; border-radius: 16px; background: var(--field); border: 1px solid var(--hair); min-width: 0; }
#splash .nc span { font-size: 11px; font-weight: 600; letter-spacing: .1em; color: var(--faint); text-transform: uppercase; }
#splash .nc b { font-size: 15px; font-weight: 650; color: var(--ink); overflow-wrap: anywhere; line-height: 1.35; font-variant-numeric: tabular-nums; }
#splash .nc.wide { grid-column: 1 / -1; }
#splash .enter { width: 100%; min-height: 54px; font-size: 16px; font-weight: 650; border-radius: 18px; }
#splash .enter .ic { transition: transform .45s var(--spring); }
#splash .enter:hover .ic { transform: translateX(4px); }
#splash .skip-link { background: transparent; border: 0; box-shadow: none; color: var(--muted); min-height: 44px; margin-top: 6px; font-weight: 500; }
#splash .skip-link:hover { color: var(--ink); }


/* ---------- view transitions ---------- */
::view-transition-old(root), ::view-transition-new(root) { animation-duration: .45s; animation-timing-function: var(--ease-out); }
html[data-vt="forward"]::view-transition-old(root) { animation: vtOut .3s var(--ease-in) both; }
html[data-vt="forward"]::view-transition-new(root) { animation: vtIn .6s var(--ease-out) both; }
html[data-vt="back"]::view-transition-old(root) { animation: vtOutBack .3s var(--ease-in) both; }
html[data-vt="back"]::view-transition-new(root) { animation: vtInBack .6s var(--ease-out) both; }
html[data-vt="expand"]::view-transition-old(root) { animation: vtFade .25s ease both; }
html[data-vt="expand"]::view-transition-new(root) { animation: vtIn .6s var(--ease-out) .08s both; }
::view-transition-group(post-cover), ::view-transition-group(post-title) { animation-duration: .7s; animation-timing-function: var(--spring); }
::view-transition-old(post-cover), ::view-transition-new(post-cover) { height: 100%; object-fit: cover; animation-duration: .45s; }
::view-transition-group(site-top) { animation-duration: .5s; }
@keyframes vtOut { to { opacity: 0; transform: scale(.975) translateY(-10px); } }
@keyframes vtIn { from { opacity: 0; transform: translateY(32px) scale(1.01); } }
@keyframes vtOutBack { to { opacity: 0; transform: translateY(24px) scale(.99); } }
@keyframes vtInBack { from { opacity: 0; transform: translateY(-24px) scale(.985); } }
@keyframes vtFade { to { opacity: 0; } }
html[data-vt="theme"] .top { view-transition-name: none !important; }
html[data-vt="theme"]::view-transition-old(root) { animation: none; }
html[data-vt="theme"]::view-transition-new(root) { animation: vtReveal .7s var(--ease-io) both; }
@keyframes vtReveal { from { clip-path: circle(0 at var(--vx, 90%) var(--vy, 4%)); } to { clip-path: circle(150vmax at var(--vx, 90%) var(--vy, 4%)); } }

/* ---------- responsive ---------- */
@media (max-width: 1279px) { .adminbtn .long { display: none; } .adminbtn .short { display: inline; } }
@media (max-width: 1279px) { .brand small { display: none; } .nav a { padding: 7px 9px; font-size: 13px; } .nav { margin-left: 6px; } }
@media (max-width: 1099px) {
  .top .nav { display: none; }
  #toast { bottom: calc(24px + env(safe-area-inset-bottom, 0px)); }
  .masonry { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .values-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sk-grid { grid-template-columns: repeat(2, 1fr); }
  .foot .wrap { grid-template-columns: 1fr 1fr; }
  .f-brand { grid-column: 1 / -1; }
}
@media (max-width: 760px) {
  :root { --blur: 14px; --pad: 20px; }
  .wrap { width: calc(100% - 32px); }
  .topslot { height: 70px; max-height: 84px; }
  html:not(.splash-done) .topslot { height: 70px !important; }
  .top { top: 8px; width: calc(100% - 16px); height: 54px; border-radius: 18px; }
  html:not(.splash-done) .top { height: 54px !important; }
  .top.slim { width: calc(100% - 28px); }
  .top .wrap { grid-template-columns: minmax(0, 1fr) auto minmax(0, 1fr); column-gap: 6px; padding: 0 6px 0 10px; }
  .top-mid { justify-self: center; }
  .mark { width: 30px; height: 30px; }
  .brand { gap: 8px; }
  .brand b { font-size: 14px; letter-spacing: .05em; }
  .icon-btn { width: 38px; height: 38px; min-height: 38px; }
  .icon-btn::after { content: ""; position: absolute; inset: -3px; }
  .adminbtn { min-height: 36px; padding: 0 13px; margin-left: 2px; }
  .top #musicCtl button { width: 34px; height: 34px; min-height: 34px; }
  #bgpop { right: 8px; left: 8px; width: auto; }
  #app { padding-top: 12px; gap: 16px; }
  .hero-x { padding: 32px 22px 26px; border-radius: 28px; -webkit-backdrop-filter: none; backdrop-filter: none; background: var(--surface); }
  .hx-eyebrow { margin-bottom: 18px; font-size: 12px; }
  .hx-title { font-size: clamp(30px, 8.6vw, 44px); }
  .hx-cta { margin: 24px 0 22px; }
  .hx-cta .btn { flex: 1 1 auto; }
  .bento { grid-template-columns: repeat(2, minmax(0, 1fr)); grid-auto-rows: 148px; gap: 12px; }
  .t-latest { grid-column: span 2; grid-row: span 2; }
  .t-ai { grid-column: span 2; }
  .tile { padding: 16px; border-radius: 22px; }
  .tile-ic { top: 16px; left: 16px; width: 40px; height: 40px; border-radius: 13px; }
  .tile .go { top: 16px; right: 16px; }
  .tile h3 { font-size: 16px; }
  .tile p { font-size: 12px; }
  .t-latest .tile-body { padding: 20px; }
  .sec-head { margin-top: 20px; }
  .home-tools { flex-direction: column; align-items: stretch; }
  .search { flex: 1 1 auto; min-width: 0; }
  .masonry { grid-template-columns: 1fr; gap: 16px; }
  .values-grid { grid-template-columns: 1fr; gap: 12px; }
  .vcard { padding: 24px 22px 26px; }
  .vcard .vnum { font-size: 44px; margin-bottom: 18px; }
  .page-hero, .hero { padding: 28px 4px 4px; }
  .art-head { padding: 16px 0 20px; }
  .back-link { margin-bottom: 18px; }
  .art-cover { border-radius: 22px; aspect-ratio: 16 / 10; }
  .art-body { padding-top: 28px; }
  .art-body.md { font-size: 17px; line-height: 1.85; }
  .pn { grid-template-columns: 1fr; }
  .pn .next { text-align: left; justify-items: start; }
  .about-hero { flex-direction: column; align-items: flex-start; gap: 18px; padding-top: 24px; }
  .avatar { width: 76px; height: 76px; border-radius: 24px; font-size: 32px; }
  .about-md { padding: 24px 22px; }
  .grid-2 { grid-template-columns: 1fr; }
  .pad { padding: 22px; }
  .sk-grid { grid-template-columns: 1fr; }
  .sk-hero { height: 260px; }
  .foot .wrap { gap: 24px; padding-top: 28px; }
  #splash .panel { padding: 32px 20px 18px; border-radius: 28px; }
  .admin > .row:first-child { top: 74px; }
}
@media (max-width: 380px) {
  .top .wrap { padding: 0 4px 0 8px; column-gap: 4px; }
  .brand { gap: 6px; }
  .mark { width: 28px; height: 28px; }
  .brand b { font-size: 13px; letter-spacing: .03em; }
  .icon-btn { width: 34px; height: 34px; min-height: 34px; border-radius: 10px; }
  .adminbtn { padding: 0 11px; font-size: 12.5px; }
  .top #musicCtl button { width: 32px; height: 32px; min-height: 32px; }
  #musicCtl { padding: 2px; gap: 0; }
}
@media (hover: none) {
  .card:hover, .tile:hover, .vcard:hover, .pn a:hover { transform: none; }
}
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { animation: none !important; transition: none !important; }
  ::view-transition-group(*), ::view-transition-old(*), ::view-transition-new(*) { animation: none !important; }
}
@media (prefers-reduced-transparency: reduce) {
  .glass, .top, .strong, .md, .tile, .card, #splash .panel, .hero-x { background: var(--surface-solid) !important; -webkit-backdrop-filter: none !important; backdrop-filter: none !important; }
  #bgfade { display: none; }
  html[data-bg="aurora"] body::after { display: none; }
}
@supports not ((backdrop-filter: blur(4px)) or (-webkit-backdrop-filter: blur(4px))) {
  .glass, .top, .hero-x { background: var(--surface-solid); }
}

/* ---------- AI app (standalone ai.hongspaces.com) ---------- */
html.ai-route, html.ai-route body { height: 100%; height: 100dvh; max-height: 100dvh; overflow: hidden; overscroll-behavior: none; }
html.ai-route body { display: flex; flex-direction: column; background: #F7F7FA; }
html.ai-route[data-theme="dark"] body { background: #08090D; }
html.ai-route body::before { background: radial-gradient(60% 50% at 70% -10%, rgba(139,92,246,.16), transparent 70%), radial-gradient(50% 40% at 0% 100%, rgba(79,91,255,.10), transparent 70%); }
html.ai-route[data-theme="dark"] body::before { background: radial-gradient(60% 50% at 70% -10%, rgba(139,92,246,.20), transparent 70%), radial-gradient(50% 40% at 0% 100%, rgba(79,91,255,.14), transparent 70%); }
html.ai-route body::after { display: none !important; }
html.ai-route .topslot, html.ai-route .top, html.ai-route #musicCtl, html.ai-route .foot { display: none !important; }
html.ai-route #app { flex: 1 1 auto; min-height: 0; width: 100%; max-width: none; margin: 0; padding: 0 !important; display: flex; flex-direction: column; height: var(--aiShellH, 100dvh); max-height: var(--aiShellH, 100dvh); gap: 0; }
html.ai-route #app > section.glass { margin: auto; width: min(480px, calc(100% - 32px)); text-align: center; }
.ai-shell { flex: 1 1 auto; min-height: 0; height: 100%; display: grid; grid-template-columns: 288px minmax(0, 1fr); overflow: hidden; position: relative; }
.ai-side { display: flex; flex-direction: column; gap: 12px; padding: 16px 14px 14px; min-height: 0; border-right: 1px solid var(--hair); background: rgba(255,255,255,.55); -webkit-backdrop-filter: blur(20px) saturate(180%); backdrop-filter: blur(20px) saturate(180%); }
html[data-theme="dark"] .ai-side { background: rgba(14,15,21,.7); }
.ai-brand { display: flex; align-items: center; gap: 10px; padding: 4px 6px 6px; }
.ai-logo { width: 30px; height: 30px; display: block; flex: 0 0 auto; }
.ai-logo .mark { width: 100%; height: 100%; }
.ai-brand b { font-size: 15px; letter-spacing: .04em; font-weight: 750; }
.ai-brand small { display: block; font-size: 11px; color: var(--muted); letter-spacing: .02em; line-height: 1.2; }
.ai-side-head { display: flex; gap: 8px; }
.ai-side-head #newChat { flex: 1 1 auto; justify-content: flex-start; border-radius: 14px; min-height: 44px; }
.ai-side-head .danger { flex: 0 0 auto; border-radius: 14px; padding: 0 12px; font-size: 13px; }
.ai-side #findChat { flex: 0 0 auto; min-height: 40px; border-radius: 12px; font-size: 14px; background: var(--field); }
.ai-side .quota { margin: 0; font-size: 12px; color: var(--muted); padding: 0 6px; display: flex; align-items: center; gap: 6px; }
.ai-side .quota::before { content: ""; width: 6px; height: 6px; border-radius: 50%; background: #10B981; }
.ai-sess { display: flex; flex-direction: column; gap: 2px; overflow-y: auto; flex: 1 1 auto; min-height: 0; margin: 0 -4px; padding: 0 4px; }
.ai-sess button { justify-content: flex-start; text-align: left; flex: 0 0 auto; border-radius: 12px; padding: 0 12px; min-height: 42px; background: transparent; border: 0; box-shadow: none; color: var(--ink-2); font-size: 14px; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; display: block; line-height: 42px; }
.ai-sess button:hover { background: rgba(10,12,20,.05); box-shadow: none; }
html[data-theme="dark"] .ai-sess button:hover { background: rgba(255,255,255,.05); }
.ai-sess button[aria-pressed="true"] { background: var(--surface-solid); color: var(--ink); box-shadow: var(--sh-1); }
html[data-theme="dark"] .ai-sess button[aria-pressed="true"] { background: rgba(255,255,255,.08); }
.ai-side-tools { display: flex; flex-wrap: wrap; gap: 4px; padding-top: 10px; border-top: 1px solid var(--hair); }
.ai-side-tools button { min-height: 32px; padding: 0 10px; font-size: 12px; border-radius: 999px; box-shadow: none; background: transparent; }
.ai-acct { display: flex; align-items: center; gap: 6px; padding-top: 10px; border-top: 1px solid var(--hair); }
.ai-acct .grow { flex: 1 1 auto; }
.ai-acct a, .ai-acct button { min-height: 36px; font-size: 12.5px; padding: 0 12px; box-shadow: none; }
.ai-acct .icon-btn { width: 36px; height: 36px; min-height: 36px; padding: 0; }
.ai-main { position: relative; display: flex; flex-direction: column; min-width: 0; min-height: 0; height: 100%; overflow: hidden; }
.ai-top { flex: 0 0 auto; display: flex; align-items: center; gap: 8px; height: 60px; padding: 0 14px; border-bottom: 1px solid transparent; }
.ai-top-title { flex: 1 1 auto; min-width: 0; text-align: center; display: grid; line-height: 1.2; }
.ai-top-title b { font-size: 15px; font-weight: 700; letter-spacing: .02em; }
.ai-top-title span { font-size: 12px; color: var(--muted); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.ai-icon { width: 40px; height: 40px; min-height: 40px; padding: 0; border-radius: 12px; box-shadow: none; background: transparent; border-color: transparent; }
.ai-icon:hover { background: var(--accent-soft); border-color: transparent; box-shadow: none; }
.ai-icon .ic { width: 20px; height: 20px; }
.ai-msgs { flex: 1 1 auto; min-height: 0; overflow-x: hidden; overflow-y: auto; padding: 8px max(16px, calc((100% - 780px) / 2)) 16px; display: flex; flex-direction: column; gap: 18px; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; scroll-behavior: auto; }
.ai-empty { margin: auto; text-align: center; max-width: 560px; padding: 24px 8px; color: var(--muted); animation: rise .8s var(--ease-out) both; }
.ai-orb { width: 64px; height: 64px; margin: 0 auto 24px; position: relative; animation: markIn 1s var(--spring) both; }
.ai-orb .mark { width: 100%; height: 100%; filter: drop-shadow(0 2px 3px rgba(16,18,24,.16)) drop-shadow(0 14px 26px rgba(16,18,24,.14)); }
.ai-empty h2 { margin: 0 0 10px; font-size: clamp(26px, 4.4vw, 36px); letter-spacing: -.04em; line-height: 1.15; color: var(--ink); font-weight: 750; }
.ai-empty p { margin: 0 auto; max-width: 30em; line-height: 1.7; font-size: 14.5px; }
.ai-sugs { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-top: 28px; }
.ai-sugs button { justify-content: flex-start; text-align: left; white-space: normal; min-height: 64px; padding: 12px 16px; border-radius: 18px; font-size: 13.5px; font-weight: 500; color: var(--ink-2); background: var(--surface); line-height: 1.45; }
.ai-sugs button b { display: block; font-weight: 650; color: var(--ink); margin-bottom: 2px; }
.ai-sugs button span { display: block; }
.bubble { max-width: min(760px, 100%); padding: 0; overflow-wrap: anywhere; line-height: 1.8; font-size: 15.5px; }
.ai-msgs > .bubble:last-child { animation: bub .45s var(--ease-out) both; }
@keyframes bub { from { opacity: 0; transform: translateY(10px); } }
.bubble.user { align-self: flex-end; max-width: min(620px, 86%); padding: 11px 16px; border-radius: 22px 22px 6px 22px; background: var(--ink); color: #fff; }
html[data-theme="dark"] .bubble.user { background: #262A36; }
.bubble.user img { border-radius: 12px; max-height: 180px; margin-bottom: 6px; }
.bubble.assistant { align-self: stretch; color: var(--ink-2); }
.bubble.assistant .md { background: transparent; font-size: 15.5px; line-height: 1.8; padding: 0; }
.bubble.assistant > .meta:first-child { display: inline-flex; align-items: center; gap: 6px; margin: 0 0 6px; font-size: 12px; font-weight: 600; color: var(--muted); }
.bubble.assistant > .meta:first-child::before { content: ""; width: 18px; height: 18px; border-radius: 6px; background: var(--grad); }
.bubble .tools { display: flex; gap: 2px; flex-wrap: wrap; margin-top: 6px; opacity: .75; transition: opacity .2s ease; }
.bubble:hover .tools { opacity: 1; }
.bubble .tools button { min-height: 30px; padding: 0 10px; font-size: 12px; border-radius: 8px; background: transparent; border: 0; box-shadow: none; color: var(--muted); }
.bubble .tools button:hover { background: var(--accent-soft); color: var(--ink); }
.bubble.user .tools { justify-content: flex-end; }
.bubble.user .tools button { color: rgba(255,255,255,.7); }
.ai-comp-wrap { flex: 0 0 auto; padding: 0 max(12px, calc((100% - 780px) / 2)) calc(14px + env(safe-area-inset-bottom, 0px)); display: grid; gap: 8px; position: relative; z-index: 2; }
.ai-comp { border-radius: 26px; padding: 10px 10px 10px 14px; display: grid; gap: 6px; border: 1px solid var(--hair-2); background: var(--surface-solid); box-shadow: 0 1px 2px rgba(16,20,40,.04), 0 16px 40px -18px rgba(16,20,40,.25); transition: border-color .2s ease, box-shadow .25s ease; }
.ai-comp:focus-within { border-color: var(--accent-line); box-shadow: 0 0 0 4px var(--accent-soft), 0 16px 40px -18px rgba(16,20,40,.25); }
.ai-comp textarea { width: 100%; min-height: 48px; max-height: 200px; resize: none; border: 0 !important; background: transparent !important; box-shadow: none !important; padding: 8px 4px 4px; font-size: 16px; line-height: 1.55; }
.ai-comp-bar { display: flex; flex-wrap: nowrap; gap: 6px; align-items: center; }
.ai-comp-picks { display: flex; flex: 1 1 auto; gap: 6px; align-items: center; min-width: 0; }
.ai-comp-picks select#tier, .ai-comp-picks select#mode, .ai-comp-picks select#imgSize { flex: 0 1 auto; width: auto; max-width: 46%; min-width: 0; min-height: 36px; border-radius: 999px; padding: 0 30px 0 12px; font-size: 13px; font-weight: 600; background-color: var(--field); border: 1px solid var(--hair); background-position: calc(100% - 15px) 52%, calc(100% - 10px) 52%; }
.ai-comp-picks select#tier { color: var(--accent); background-color: var(--accent-soft); border-color: var(--accent-line); }
.ai-more-wrap { position: relative; flex: 0 0 auto; }
.ai-more-wrap #aiMoreBtn { width: 36px; min-height: 36px; height: 36px; padding: 0; border-radius: 50%; font-size: 0; box-shadow: none; background: var(--field); border-color: var(--hair); }
.ai-more-wrap #aiMoreBtn::before { content: ""; width: 18px; height: 18px; background: currentColor; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.ai-more-menu { position: absolute; bottom: calc(100% + 10px); left: 0; z-index: 12; min-width: 168px; padding: 6px; border-radius: 18px; border: 1px solid var(--hair-2); background: var(--surface-solid); box-shadow: var(--sh-3); display: grid; gap: 2px; transform-origin: bottom left; animation: popIn .35s var(--spring) both; }
.ai-more-menu[hidden] { display: none !important; }
.ai-more-menu button { justify-content: flex-start; min-height: 42px; border-radius: 12px; padding: 0 12px; font-size: 14px; background: transparent; border: 0; box-shadow: none; gap: 10px; }
.ai-more-menu button::before { content: ""; width: 18px; height: 18px; background: currentColor; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; opacity: .8; }
.ai-more-menu button:hover { background: var(--accent-soft); }
.ai-comp-bar .spacer { flex: 0 0 2px; }
.ai-comp-bar #sendBtn, .ai-comp-bar #stopBtn { width: 40px; height: 40px; min-height: 40px; padding: 0; border-radius: 50%; font-size: 0; flex: 0 0 auto; }
.ai-comp-bar #sendBtn::before, .ai-comp-bar #stopBtn::before { content: ""; width: 18px; height: 18px; background: currentColor; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.ai-comp-bar #stopBtn { background: var(--ink); color: var(--surface-solid); border: 0; }
@media (min-width: 901px) { .ai-more-sideonly, #aiSideOpen { display: none !important; } }
.ai-adv { border-radius: 16px; padding: 4px 8px; border: 0; background: transparent; font-size: 13px; }
.ai-adv summary { cursor: pointer; font-size: 12px; color: var(--faint); user-select: none; text-align: center; list-style: none; padding: 2px; }
.ai-adv summary::-webkit-details-marker { display: none; }
.ai-adv[open] { background: var(--surface-solid); border: 1px solid var(--hair); padding: 10px 14px; }
.ai-adv .row { margin-top: 8px; }
.ai-adv label { font-size: 12.5px; }
.ai-backdrop { display: none; }
@media (max-width: 900px) {
  .ai-shell { grid-template-columns: 1fr; }
  .ai-side { position: fixed; left: 0; top: 0; bottom: 0; width: min(312px, 86vw); z-index: 55; transform: translateX(-105%); transition: transform .5s var(--spring); border-right: 1px solid var(--hair); border-radius: 0 24px 24px 0; box-shadow: var(--sh-3); background: var(--surface-solid); -webkit-backdrop-filter: none; backdrop-filter: none; padding-top: max(16px, env(safe-area-inset-top, 0px)); }
  .ai-shell.side-open .ai-side { transform: translateX(0); }
  .ai-backdrop { display: none; position: fixed; inset: 0; z-index: 54; background: rgba(8,10,16,.36); animation: fadeIn .25s ease both; }
  .ai-shell.side-open .ai-backdrop { display: block; }
  .ai-top { height: 56px; padding: 0 8px; padding-top: env(safe-area-inset-top, 0px); }
  .ai-sugs { grid-template-columns: 1fr; gap: 8px; margin-top: 22px; }
  .ai-sugs button { min-height: 56px; }
  .ai-orb { width: 56px; height: 56px; margin-bottom: 18px; }
  .ai-comp-wrap { padding: 0 10px calc(10px + env(safe-area-inset-bottom, 0px)); }
  .ai-comp { border-radius: 24px; }
  .bubble { font-size: 15px; }
}

.ic-home { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3.5%2010.5%2012%203.5l8.5%207%22%2F%3E%3Cpath%20d%3D%22M5.5%209v11.5h13V9%22%2F%3E%3Cpath%20d%3D%22M10%2020.5v-5.5h4v5.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-sparkles { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%203l1.9%205.1L19%2010l-5.1%201.9L12%2017l-1.9-5.1L5%2010l5.1-1.9z%22%2F%3E%3Cpath%20d%3D%22M19%2015.5l.7%201.8%201.8.7-1.8.7-.7%201.8-.7-1.8-1.8-.7%201.8-.7z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-ai { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%224%22%20y%3D%227.5%22%20width%3D%2216%22%20height%3D%2212%22%20rx%3D%224%22%2F%3E%3Cpath%20d%3D%22M12%203.5v4%22%2F%3E%3Cpath%20d%3D%22M9%2013v1.5M15%2013v1.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-gauge { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2016a8%208%200%201%201%2016%200%22%2F%3E%3Cpath%20d%3D%22M12%2016l4-5%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2216%22%20r%3D%221.4%22%2F%3E%3C%2Fsvg%3E"); }
.ic-grid { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%224%22%20y%3D%224%22%20width%3D%226.5%22%20height%3D%226.5%22%20rx%3D%222%22%2F%3E%3Crect%20x%3D%2213.5%22%20y%3D%224%22%20width%3D%226.5%22%20height%3D%226.5%22%20rx%3D%222%22%2F%3E%3Crect%20x%3D%224%22%20y%3D%2213.5%22%20width%3D%226.5%22%20height%3D%226.5%22%20rx%3D%222%22%2F%3E%3Crect%20x%3D%2213.5%22%20y%3D%2213.5%22%20width%3D%226.5%22%20height%3D%226.5%22%20rx%3D%222%22%2F%3E%3C%2Fsvg%3E"); }
.ic-sun { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%224%22%2F%3E%3Cpath%20d%3D%22M12%202.5v2M12%2019.5v2M5.3%205.3l1.4%201.4M17.3%2017.3l1.4%201.4M2.5%2012h2M19.5%2012h2M5.3%2018.7l1.4-1.4M17.3%206.7l1.4-1.4%22%2F%3E%3C%2Fsvg%3E"); }
.ic-moon { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%2014.5A8%208%200%200%201%209.5%204a8%208%200%201%200%2010.5%2010.5z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-palette { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%203a9%209%200%201%200%200%2018c1.1%200%201.8-.9%201.8-1.9%200-.5-.2-.9-.5-1.3-.3-.3-.5-.8-.5-1.3%200-1%20.8-1.8%201.9-1.8H17a4%204%200%200%200%204-4C21%206.6%2017%203%2012%203z%22%2F%3E%3Ccircle%20cx%3D%227.5%22%20cy%3D%2211%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%227%22%20r%3D%221%22%2F%3E%3Ccircle%20cx%3D%2215%22%20cy%3D%227%22%20r%3D%221%22%2F%3E%3C%2Fsvg%3E"); }
.ic-play { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M8%205.2v13.6a.8.8%200%200%200%201.2.7l11-6.8a.8.8%200%200%200%200-1.4l-11-6.8A.8.8%200%200%200%208%205.2z%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E"); }
.ic-pause { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%226.5%22%20y%3D%225%22%20width%3D%223.6%22%20height%3D%2214%22%20rx%3D%221%22%20fill%3D%22black%22%2F%3E%3Crect%20x%3D%2213.9%22%20y%3D%225%22%20width%3D%223.6%22%20height%3D%2214%22%20rx%3D%221%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E"); }
.ic-vol { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%209.5h3.5L12%205.5v13l-4.5-4H4z%22%2F%3E%3Cpath%20d%3D%22M15.5%209a4%204%200%200%201%200%206M18%206.5a7.5%207.5%200%200%201%200%2011%22%2F%3E%3C%2Fsvg%3E"); }
.ic-mute { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%209.5h3.5L12%205.5v13l-4.5-4H4z%22%2F%3E%3Cpath%20d%3D%22M16%209.5l5%205M21%209.5l-5%205%22%2F%3E%3C%2Fsvg%3E"); }
.ic-next { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%205.5v13l9.5-6.5z%22%20fill%3D%22black%22%2F%3E%3Cpath%20d%3D%22M18.5%205.5v13%22%20stroke-width%3D%222.4%22%2F%3E%3C%2Fsvg%3E"); }
.ic-arrow-left { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M19%2012H5M11%206l-6%206%206%206%22%2F%3E%3C%2Fsvg%3E"); }
.ic-arrow-right { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2012h14M13%206l6%206-6%206%22%2F%3E%3C%2Fsvg%3E"); }
.ic-arrow-up-right { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M7%2017%2017%207M8%207h9v9%22%2F%3E%3C%2Fsvg%3E"); }
.ic-arrow-up { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2019V5M5.5%2011.5%2012%205l6.5%206.5%22%20stroke-width%3D%222.2%22%2F%3E%3C%2Fsvg%3E"); }
.ic-stop { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%226.5%22%20y%3D%226.5%22%20width%3D%2211%22%20height%3D%2211%22%20rx%3D%222.5%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E"); }
.ic-search { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2211%22%20cy%3D%2211%22%20r%3D%227%22%2F%3E%3Cpath%20d%3D%22m20%2020-3.5-3.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-heart { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2020s-7.5-4.6-7.5-10.2A4.3%204.3%200%200%201%2012%207a4.3%204.3%200%200%201%207.5%202.8C19.5%2015.4%2012%2020%2012%2020z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-eye { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M2.5%2012S6%205.5%2012%205.5%2021.5%2012%2021.5%2012%2018%2018.5%2012%2018.5%202.5%2012%202.5%2012z%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%223%22%2F%3E%3C%2Fsvg%3E"); }
.ic-clock { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22%2F%3E%3Cpath%20d%3D%22M12%207v5l3%202%22%2F%3E%3C%2Fsvg%3E"); }
.ic-image { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2216%22%20rx%3D%223%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%2210%22%20r%3D%221.8%22%2F%3E%3Cpath%20d%3D%22m21%2016-5-5L5%2020%22%2F%3E%3C%2Fsvg%3E"); }
.ic-mic { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%229%22%20y%3D%223%22%20width%3D%226%22%20height%3D%2211%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M5.5%2011a6.5%206.5%200%200%200%2013%200M12%2017.5V21%22%2F%3E%3C%2Fsvg%3E"); }
.ic-menu { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%207h16M4%2012h16M4%2017h10%22%2F%3E%3C%2Fsvg%3E"); }
.ic-plus { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%205v14M5%2012h14%22%2F%3E%3C%2Fsvg%3E"); }
.ic-sidebar { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2216%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M9%204v16%22%2F%3E%3C%2Fsvg%3E"); }
.ic-bike { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%225.5%22%20cy%3D%2216%22%20r%3D%223.5%22%2F%3E%3Ccircle%20cx%3D%2218.5%22%20cy%3D%2216%22%20r%3D%223.5%22%2F%3E%3Cpath%20d%3D%22M5.5%2016%209%209h6l3.5%207M9%209%207.8%206H6M15%209l-1.6-3.5H16M12%2016l3-7%22%2F%3E%3C%2Fsvg%3E"); }
.ic-pingpong { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2210%22%20cy%3D%2210%22%20r%3D%226.5%22%2F%3E%3Cpath%20d%3D%22M14.7%2014.7%2020%2020%22%2F%3E%3Ccircle%20cx%3D%2219%22%20cy%3D%225%22%20r%3D%221.6%22%2F%3E%3C%2Fsvg%3E"); }
.ic-code { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m8%207-5%205%205%205M16%207l5%205-5%205M13.5%204l-3%2016%22%2F%3E%3C%2Fsvg%3E"); }
.ic-cloud { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M7%2018.5a4.5%204.5%200%200%201-.6-9A6%206%200%200%201%2018%209a4.8%204.8%200%200%201-.5%209.5z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-pin { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2021s-6.5-6-6.5-11a6.5%206.5%200%200%201%2013%200c0%205-6.5%2011-6.5%2011z%22%2F%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2210%22%20r%3D%222.3%22%2F%3E%3C%2Fsvg%3E"); }
.ic-msg { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M21%2011.5a8.5%208.5%200%200%201-12.4%207.6L3.5%2020.5l1.4-4.6A8.5%208.5%200%201%201%2021%2011.5z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-phone { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%227%22%20y%3D%222.5%22%20width%3D%2210%22%20height%3D%2219%22%20rx%3D%222.5%22%2F%3E%3Cpath%20d%3D%22M11%2018.5h2%22%2F%3E%3C%2Fsvg%3E"); }
.ic-lock { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%225%22%20y%3D%2210.5%22%20width%3D%2214%22%20height%3D%2210%22%20rx%3D%222.5%22%2F%3E%3Cpath%20d%3D%22M8%2010.5V8a4%204%200%200%201%208%200v2.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-user { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%228%22%20r%3D%224%22%2F%3E%3Cpath%20d%3D%22M4.5%2020.5a7.5%207.5%200%200%201%2015%200%22%2F%3E%3C%2Fsvg%3E"); }
.ic-pen { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2020h4L19%209l-4-4L4%2016z%22%2F%3E%3Cpath%20d%3D%22M13.5%206.5l4%204%22%2F%3E%3C%2Fsvg%3E"); }
.ic-logout { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M14%204h4a2%202%200%200%201%202%202v12a2%202%200%200%201-2%202h-4M9%2016l-4-4%204-4M5%2012h10%22%2F%3E%3C%2Fsvg%3E"); }
.ic-x { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M6%206l12%2012M18%206%206%2018%22%2F%3E%3C%2Fsvg%3E"); }
.ic-download { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%204v11M7%2010l5%205%205-5%22%2F%3E%3Cpath%20d%3D%22M5%2019h14%22%2F%3E%3C%2Fsvg%3E"); }
.ic-share { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%203v12M7%208l5-5%205%205%22%2F%3E%3Cpath%20d%3D%22M5%2014v5a2%202%200%200%200%202%202h10a2%202%200%200%200%202-2v-5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-globe { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22%2F%3E%3Cpath%20d%3D%22M3%2012h18M12%203a14%2014%200%200%201%200%2018M12%203a14%2014%200%200%200%200%2018%22%2F%3E%3C%2Fsvg%3E"); }
.ic-book { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%204.5h6a2%202%200%200%201%202%202v14a2%202%200%200%200-2-2H4zM20%204.5h-6a2%202%200%200%200-2%202v14a2%202%200%200%201%202-2h6z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-school { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M2.5%209%2012%204.5%2021.5%209%2012%2013.5z%22%2F%3E%3Cpath%20d%3D%22M6.5%2011v5c3%202.5%208%202.5%2011%200v-5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-send { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M21%203%2010%2014M21%203l-7%2018-4-7-7-4z%22%2F%3E%3C%2Fsvg%3E"); }
#musicPlay { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M8%205.2v13.6a.8.8%200%200%200%201.2.7l11-6.8a.8.8%200%200%200%200-1.4l-11-6.8A.8.8%200%200%200%208%205.2z%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E"); }
#musicPlay[data-s="pause"] { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%226.5%22%20y%3D%225%22%20width%3D%223.6%22%20height%3D%2214%22%20rx%3D%221%22%20fill%3D%22black%22%2F%3E%3Crect%20x%3D%2213.9%22%20y%3D%225%22%20width%3D%223.6%22%20height%3D%2214%22%20rx%3D%221%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E"); }
#musicMute { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%209.5h3.5L12%205.5v13l-4.5-4H4z%22%2F%3E%3Cpath%20d%3D%22M15.5%209a4%204%200%200%201%200%206M18%206.5a7.5%207.5%200%200%201%200%2011%22%2F%3E%3C%2Fsvg%3E"); }
#musicMute[data-s="off"] { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%209.5h3.5L12%205.5v13l-4.5-4H4z%22%2F%3E%3Cpath%20d%3D%22M16%209.5l5%205M21%209.5l-5%205%22%2F%3E%3C%2Fsvg%3E"); }
#musicNext { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%205.5v13l9.5-6.5z%22%20fill%3D%22black%22%2F%3E%3Cpath%20d%3D%22M18.5%205.5v13%22%20stroke-width%3D%222.4%22%2F%3E%3C%2Fsvg%3E"); }
#aiMoreBtn { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%207h16M4%2012h16M4%2017h10%22%2F%3E%3C%2Fsvg%3E"); }
#sendBtn { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2019V5M5.5%2011.5%2012%205l6.5%206.5%22%20stroke-width%3D%222.2%22%2F%3E%3C%2Fsvg%3E"); }
#stopBtn { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%226.5%22%20y%3D%226.5%22%20width%3D%2211%22%20height%3D%2211%22%20rx%3D%222.5%22%20fill%3D%22black%22%2F%3E%3C%2Fsvg%3E"); }
#imgBtn { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2216%22%20rx%3D%223%22%2F%3E%3Ccircle%20cx%3D%229%22%20cy%3D%2210%22%20r%3D%221.8%22%2F%3E%3Cpath%20d%3D%22m21%2016-5-5L5%2020%22%2F%3E%3C%2Fsvg%3E"); }
#micBtn { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%229%22%20y%3D%223%22%20width%3D%226%22%20height%3D%2211%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M5.5%2011a6.5%206.5%200%200%200%2013%200M12%2017.5V21%22%2F%3E%3C%2Fsvg%3E"); }
#aiSideToggle { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223%22%20y%3D%224%22%20width%3D%2218%22%20height%3D%2216%22%20rx%3D%223%22%2F%3E%3Cpath%20d%3D%22M9%204v16%22%2F%3E%3C%2Fsvg%3E"); }
.posts-sec { display: grid; grid-template-columns: minmax(0, 1fr); gap: 18px; scroll-margin-top: 88px; }
.posts-sec > * { min-width: 0; }
#app { grid-template-columns: minmax(0, 1fr); }
.t-latest .cover { aspect-ratio: auto; height: 100%; }
.t-latest .ph { place-items: start; padding: 22px 26px; font-size: clamp(96px, 12vw, 150px); color: rgba(255,255,255,.42); text-shadow: none; }
.hx-title .nb { display: inline-block; }
@media (max-width: 760px) { .card .cover { aspect-ratio: 16 / 9; } }
.ph { line-height: 1; }
.ai-sugs button { display: block; }
.art-body { background: var(--glass-strong) !important; border: 1px solid var(--line) !important; box-shadow: var(--hi), var(--sh-1) !important; border-radius: 28px; padding: 44px 56px 36px !important; margin-top: 24px; }
@media (max-width: 760px) { .art-body { padding: 26px 20px 18px !important; border-radius: 22px; margin-top: 16px; } }
.modal .panel:has(.ai-login) { width: min(420px, 100%); padding: 28px; }
.ai-login h2 { font-size: 24px; letter-spacing: -.03em; }
.ai-login button[type="submit"] { min-height: 50px; }
@media (max-width: 1099px) { .tile:not(.t-latest):not(.t-ai) .kicker { display: none; } }
@media (min-width: 761px) and (max-width: 1099px) { .bento { grid-auto-rows: 188px; } .tile p { font-size: 12.5px; } }
.ai-comp-picks select[hidden] { display: none !important; }
.ai-comp-bar #stopBtn:not([hidden]) + #sendBtn { display: none; }
.ai-tier-wrap { position: relative; flex: 0 0 auto; }
#tierBtn { display: inline-flex; align-items: center; gap: 8px; min-height: 36px; height: 36px; padding: 0 12px 0 14px; border-radius: 999px; font-size: 13px; font-weight: 600; color: var(--accent); background: var(--accent-soft); border: 1px solid var(--accent-line); box-shadow: none; white-space: nowrap; }
#tierBtn::after { content: ""; width: 6px; height: 6px; border-right: 1.6px solid currentColor; border-bottom: 1.6px solid currentColor; transform: translateY(-2px) rotate(45deg); transition: transform .25s var(--spring); }
#tierBtn[aria-expanded="true"]::after { transform: translateY(1px) rotate(-135deg); }
.ai-tier-menu { position: absolute; bottom: calc(100% + 10px); left: -4px; z-index: 13; width: min(320px, calc(100vw - 40px)); padding: 6px; border-radius: 20px; border: 1px solid var(--hair-2); background: var(--surface-solid); box-shadow: var(--sh-3); display: grid; gap: 2px; transform-origin: bottom left; animation: popIn .35s var(--spring) both; }
.ai-tier-menu[hidden] { display: none !important; }
.ai-tier-cap { margin: 4px 10px 4px; font-size: 11.5px; font-weight: 600; letter-spacing: .06em; color: var(--muted); }
.ai-tier-menu button { display: grid; grid-template-columns: 34px 1fr 18px; align-items: center; gap: 12px; text-align: left; min-height: 60px; padding: 8px 10px; border-radius: 14px; border: 0; background: transparent; box-shadow: none; color: var(--ink); font-weight: 400; }
.ai-tier-menu button:hover, .ai-tier-menu button:focus-visible { background: var(--accent-soft); }
.ai-tier-menu button > .ic { width: 34px; height: 34px; border-radius: 11px; background: var(--grad); -webkit-mask: none; mask: none; position: relative; }
.ai-tier-menu button > .ic::after { content: ""; position: absolute; inset: 8px; background: #fff; -webkit-mask: var(--m) center / contain no-repeat; mask: var(--m) center / contain no-repeat; }
.ai-tier-menu button span { display: grid; gap: 2px; min-width: 0; }
.ai-tier-menu b { font-size: 14px; font-weight: 600; }
.ai-tier-menu b em { font-style: normal; font-size: 11px; font-weight: 600; color: #d14343; margin-left: 4px; }
.ai-tier-menu small { font-size: 12px; line-height: 1.45; color: var(--muted); }
.ai-tier-ck { width: 18px; height: 18px; border-radius: 50%; opacity: 0; transform: scale(.6); transition: opacity .2s ease, transform .3s var(--spring); background: var(--accent); position: relative; }
.ai-tier-ck::after { content: ""; position: absolute; left: 6px; top: 3.5px; width: 4px; height: 8px; border-right: 2px solid #fff; border-bottom: 2px solid #fff; transform: rotate(45deg); }
.ai-tier-menu [aria-selected="true"] .ai-tier-ck { opacity: 1; transform: scale(1); }
.ai-more-menu button:disabled { opacity: .45; cursor: not-allowed; }
.ai-thinking { display: inline-flex; align-items: center; gap: 10px; min-height: 28px; font-size: 14px; font-weight: 500; color: var(--muted); }
.ai-thinking .dots { display: inline-flex; gap: 4px; }
.ai-thinking .dots i { width: 6px; height: 6px; border-radius: 50%; background: var(--accent); opacity: .35; animation: hgDot 1.2s cubic-bezier(.4,0,.2,1) infinite; }
.ai-thinking .dots i:nth-child(2) { animation-delay: .15s; }
.ai-thinking .dots i:nth-child(3) { animation-delay: .3s; }
.ai-thinking.deep .lbl { animation: hgPulse 1.8s ease-in-out infinite; }
.ai-thinking .lbl.sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }
@keyframes hgDot { 0%, 80%, 100% { transform: translateY(0); opacity: .35; } 40% { transform: translateY(-4px); opacity: 1; } }
@keyframes hgPulse { 0%, 100% { opacity: .55; } 50% { opacity: 1; } }
.ai-gen { margin: 4px 0 0; display: grid; gap: 10px; width: min(520px, 100%); }
.bubble .ai-gen img { width: 100%; height: auto; max-height: none; border-radius: 20px; display: block; border: 1px solid var(--hair); box-shadow: var(--sh-2); margin: 0; }
.ai-gen figcaption { display: flex; align-items: center; gap: 10px; font-size: 13px; color: var(--muted); min-width: 0; }
.ai-gen figcaption span { flex: 1 1 auto; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.ai-gen figcaption button { flex: 0 0 auto; min-height: 36px; border-radius: 999px; padding: 0 14px; font-size: 13px; gap: 6px; }
.ai-gen-wait { width: min(420px, 100%); max-height: 56vh; border-radius: 20px; display: grid; place-items: center; background: var(--field); border: 1px solid var(--hair); position: relative; overflow: hidden; }
.ai-gen-wait::before { content: ""; position: absolute; inset: 0; background: linear-gradient(135deg, var(--accent-soft), transparent 60%); animation: hgPulse 1.8s ease-in-out infinite; }
.ai-gen-wait .ai-thinking { position: relative; }
@media (prefers-reduced-motion: reduce) { .ai-thinking .dots i, .ai-thinking.deep .lbl, .ai-gen-wait::before { animation: none !important; opacity: 1; } }

/* ===== trim: logo, header menu, drawer, photo scrim, covers ===== */
.mark { filter: drop-shadow(0 1px 1.5px rgba(16,18,24,.22)) drop-shadow(0 4px 10px rgba(16,18,24,.10)); }
.brand:hover .mark { transform: scale(1.04); }
html[data-theme="dark"] .mark .la, html[data-theme="dark"] .g-mark .la { stop-color: #B6B6BC; }
html[data-theme="dark"] .mark .lb, html[data-theme="dark"] .g-mark .lb { stop-color: #94949B; }
html[data-theme="dark"] .mark { filter: drop-shadow(0 1px 1.5px rgba(0,0,0,.5)); }
.top .mark, .drawer .mark, html[data-theme="dark"] .top .mark, html[data-theme="dark"] .drawer .mark { filter: none; }
.sp-mark { filter: drop-shadow(0 2px 3px rgba(16,18,24,.18)) drop-shadow(0 14px 26px rgba(16,18,24,.16)); }
@keyframes markIn { from { transform: scale(.82); opacity: 0; } }
html[data-photo] { --scrim-a: rgba(244,246,250,.30); --scrim-b: rgba(244,246,250,.64); }
html[data-photo][data-theme="dark"] { --scrim-a: rgba(6,8,12,.50); --scrim-b: rgba(6,8,12,.78); }
html[data-photo] { --halo: rgba(244,246,250,.92); }
html[data-photo][data-theme="dark"] { --halo: rgba(6,8,12,.9); }
html[data-photo] .art-title, html[data-photo] .art-lede, html[data-photo] .art-meta > span, html[data-photo] .art-meta-top .meta, html[data-photo] .page-head .page-title, html[data-photo] .page-head .lede { text-shadow: 0 0 1px var(--halo), 0 1px 14px var(--halo), 0 0 28px var(--halo); }
html[data-photo] .art-lede, html[data-photo] .art-meta, html[data-photo] .art-meta-top .meta { color: color-mix(in srgb, var(--ink) 74%, transparent); }
@media (max-width: 480px) { .art-meta { gap: 8px 12px; font-size: 13px; } .art-meta .heart { padding: 0 13px; min-height: 40px; } .art-head { padding-top: 20px; } }
html.ai-route[data-photo] body::before { background: none; }
.menu-btn { display: none; }
.hb { position: relative; width: 18px; height: 14px; display: block; }
.hb i { position: absolute; left: 0; right: 0; height: 1.8px; border-radius: 2px; background: currentColor; transition: transform .45s var(--spring), opacity .2s ease, top .45s var(--spring); }
.hb i:nth-child(1) { top: 1px; } .hb i:nth-child(2) { top: 6.1px; } .hb i:nth-child(3) { top: 11.2px; }
html.drawer-open, html.drawer-open body { overflow: hidden; overscroll-behavior: none; }
html.drawer-open .hb i:nth-child(1) { top: 6.1px; transform: rotate(45deg); }
html.drawer-open .hb i:nth-child(2) { opacity: 0; transform: scaleX(.3); }
html.drawer-open .hb i:nth-child(3) { top: 6.1px; transform: rotate(-45deg); }
.drawer-bd { position: fixed; inset: 0; z-index: 60; background: rgba(8,10,16,.28); -webkit-backdrop-filter: blur(3px); backdrop-filter: blur(3px); opacity: 0; transition: opacity .35s ease; }
.drawer-bd.on { opacity: 1; }
.drawer {
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 61; width: min(360px, 88vw); display: flex; flex-direction: column; gap: 14px; overflow-y: auto; overscroll-behavior: contain;
  padding: max(14px, env(safe-area-inset-top, 0px)) max(16px, env(safe-area-inset-right, 0px)) max(18px, env(safe-area-inset-bottom, 0px)) 16px;
  background: var(--surface-solid); border-left: 1px solid var(--hair); box-shadow: -30px 0 80px -30px rgba(10,14,30,.4);
  transform: translateX(104%); transition: transform .5s var(--spring); outline: none;
}
.drawer.on { transform: none; }
.drawer[hidden], .drawer-bd[hidden] { display: none !important; }
.dr-head { display: flex; align-items: center; justify-content: space-between; min-height: 48px; }
.dr-brand { display: inline-flex; align-items: center; gap: 10px; }
.dr-brand .mark { width: 28px; height: 28px; }
.dr-brand b { font-size: 15px; font-weight: 750; letter-spacing: .06em; }
.dr-nav { display: grid; gap: 2px; }
.dr-nav a { display: flex; align-items: center; gap: 14px; min-height: 52px; padding: 0 14px; border-radius: 16px; color: var(--ink); text-decoration: none; font-size: 16px; font-weight: 560; transition: background-color .2s ease, transform .45s var(--spring); }
.dr-nav a .ic { width: 20px; height: 20px; color: var(--muted); }
.dr-nav a .ext { margin-left: auto; width: 16px; height: 16px; }
.dr-nav a:hover { background: var(--field); }
.dr-nav a:active { transform: scale(.97); }
.dr-nav a[aria-current="page"] { background: var(--accent-soft); }
.dr-nav a[aria-current="page"] .ic { color: var(--accent); }
.drawer .dr-nav a { opacity: 0; transform: translateX(18px); transition: opacity .4s ease, transform .55s var(--spring), background-color .2s ease; }
.drawer.on .dr-nav a { opacity: 1; transform: none; }
.drawer.on .dr-nav a:nth-child(2) { transition-delay: .03s; } .drawer.on .dr-nav a:nth-child(3) { transition-delay: .06s; } .drawer.on .dr-nav a:nth-child(4) { transition-delay: .09s; } .drawer.on .dr-nav a:nth-child(5) { transition-delay: .12s; } .drawer.on .dr-nav a:nth-child(6) { transition-delay: .15s; } .drawer.on .dr-nav a:nth-child(7) { transition-delay: .18s; }
.dr-sec { border-top: 1px solid var(--hair); padding-top: 14px; }
.dr-h { display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 650; letter-spacing: .1em; color: var(--faint); margin-bottom: 10px; }
.linkish { background: none; border: 0; box-shadow: none; min-height: 32px; padding: 0 4px; color: var(--accent); font-size: 13px; font-weight: 600; letter-spacing: 0; }
.dr-bgs { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.dr-bg { display: grid; gap: 4px; padding: 0; min-height: 0; background: none; border: 0; box-shadow: none; font-size: 11px; font-weight: 550; color: var(--muted); text-align: center; letter-spacing: 0; }
.dr-bg img, .dr-bg i { display: block; width: 100%; aspect-ratio: 16 / 10; height: auto; object-fit: cover; border-radius: 10px; border: 1px solid var(--hair); outline: 2px solid transparent; outline-offset: 1px; transition: outline-color .2s ease, transform .45s var(--spring); }
.dr-bg[aria-pressed="true"] img, .dr-bg[aria-pressed="true"] i { outline-color: var(--accent); }
.dr-bg[aria-pressed="true"] span { color: var(--ink); }
.dr-bg:active img, .dr-bg:active i { transform: scale(.94); }
.dr-row { display: flex; align-items: center; justify-content: space-between; min-height: 48px; padding: 0 4px; font-size: 16px; font-weight: 560; cursor: pointer; }
.dr-row span { display: inline-flex; align-items: center; gap: 14px; }
.dr-row .ic { width: 20px; height: 20px; color: var(--muted); }
.dr-foot { margin: auto 0 0; padding-top: 12px; font-size: 12px; color: var(--faint); }
input.switch { -webkit-appearance: none; appearance: none; width: 46px; height: 28px; min-height: 0; padding: 0; border-radius: 999px; background: var(--hair-2); border: 0; position: relative; cursor: pointer; flex: 0 0 auto; transition: background-color .25s ease; box-shadow: none; }
input.switch::after { content: ""; position: absolute; top: 3px; left: 3px; width: 22px; height: 22px; border-radius: 50%; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,.25); transition: transform .45s var(--spring); }
input.switch:checked { background: #34C759; }
input.switch:checked::after { transform: translateX(18px); }
input.switch:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
#bgpop .bgsw img, #bgpop .bgsw i { display: block; width: 100%; height: auto; aspect-ratio: 16 / 10; object-fit: cover; border-radius: 12px; border: 1px solid var(--hair); }
#bgpop .bgreset { justify-self: start; }
#bgpop .meta a { color: var(--link); }
@media (max-width: 1099px) {
  .menu-btn { display: inline-grid; place-items: center; }
  .top .actions #bgBtn, .top .actions #themeBtn, .top .actions .adminbtn { display: none; }
}
html.ai-route .drawer, html.ai-route .drawer-bd { display: none !important; }
/* covers */
.cover img { background: var(--field); }
.card .cover { aspect-ratio: 16 / 9; }
.art-cover { aspect-ratio: 16 / 9; }
.art-cover img { width: 100%; height: 100%; object-fit: cover; }
@media (max-width: 760px) { .art-cover { aspect-ratio: 16 / 10; } }
.ic-folder { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%207.5A2.5%202.5%200%200%201%205.5%205H9l2%202.5h7.5A2.5%202.5%200%200%201%2021%2010v7.5a2.5%202.5%200%200%201-2.5%202.5h-13A2.5%202.5%200%200%201%203%2017.5z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-folder-plus { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%207.5A2.5%202.5%200%200%201%205.5%205H9l2%202.5h7.5A2.5%202.5%200%200%201%2021%2010v7.5a2.5%202.5%200%200%201-2.5%202.5h-13A2.5%202.5%200%200%201%203%2017.5zM12%2011v6M9%2014h6%22%2F%3E%3C%2Fsvg%3E"); }
.ic-file { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M14%203H7a2%202%200%200%200-2%202v14a2%202%200%200%200%202%202h10a2%202%200%200%200%202-2V8zM14%203v5h5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-file-text { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M14%203H7a2%202%200%200%200-2%202v14a2%202%200%200%200%202%202h10a2%202%200%200%200%202-2V8zM14%203v5h5M9%2013h6M9%2017h4%22%2F%3E%3C%2Fsvg%3E"); }
.ic-film { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223.5%22%20y%3D%224.5%22%20width%3D%2217%22%20height%3D%2215%22%20rx%3D%222.5%22%2F%3E%3Cpath%20d%3D%22M8%204.5v15M16%204.5v15M3.5%209.5H8M3.5%2014.5H8M16%209.5h4.5M16%2014.5h4.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-music { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M9%2018V6l11-2v12%22%2F%3E%3Ccircle%20cx%3D%226%22%20cy%3D%2218%22%20r%3D%223%22%2F%3E%3Ccircle%20cx%3D%2217%22%20cy%3D%2216%22%20r%3D%223%22%2F%3E%3C%2Fsvg%3E"); }
.ic-archive { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%223.5%22%20y%3D%224%22%20width%3D%2217%22%20height%3D%224.5%22%20rx%3D%221.2%22%2F%3E%3Cpath%20d%3D%22M5%208.5V18a2%202%200%200%200%202%202h10a2%202%200%200%200%202-2V8.5M10%2012.5h4%22%2F%3E%3C%2Fsvg%3E"); }
.ic-trash { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%207h16M10%2011v6M14%2011v6M6%207l1%2012a2%202%200%200%200%202%202h6a2%202%200%200%200%202-2l1-12M9%207V4.5h6V7%22%2F%3E%3C%2Fsvg%3E"); }
.ic-link { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M10%2014a4%204%200%200%200%205.66%200l3-3a4%204%200%200%200-5.66-5.66l-1%201M14%2010a4%204%200%200%200-5.66%200l-3%203a4%204%200%200%200%205.66%205.66l1-1%22%2F%3E%3C%2Fsvg%3E"); }
.ic-move { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%207.5A2.5%202.5%200%200%201%205.5%205H9l2%202.5h7.5A2.5%202.5%200%200%201%2021%2010v7.5a2.5%202.5%200%200%201-2.5%202.5h-13A2.5%202.5%200%200%201%203%2017.5zM9%2013.5h6M12.5%2011l2.5%202.5-2.5%202.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-check { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M5%2012.5l4.5%204.5L19%207.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-list { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M9%206h11M9%2012h11M9%2018h11M4.5%206h.01M4.5%2012h.01M4.5%2018h.01%22%2F%3E%3C%2Fsvg%3E"); }
.ic-upload { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2015V4M7.5%208.5%2012%204l4.5%204.5M5%2015v3a2%202%200%200%200%202%202h10a2%202%200%200%200%202-2v-3%22%2F%3E%3C%2Fsvg%3E"); }
.ic-dots { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20stroke-width%3D%223%22%20d%3D%22M5%2012h.01M12%2012h.01M19%2012h.01%22%2F%3E%3C%2Fsvg%3E"); }
.ic-refresh { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M20%2011a8%208%200%200%200-14.9-3M4%204.5V8h3.5M4%2013a8%208%200%200%200%2014.9%203M20%2019.5V16h-3.5%22%2F%3E%3C%2Fsvg%3E"); }
.ic-copy { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Crect%20x%3D%229%22%20y%3D%229%22%20width%3D%2211%22%20height%3D%2211%22%20rx%3D%222.5%22%2F%3E%3Cpath%20d%3D%22M5%2015V6.5A2.5%202.5%200%200%201%207.5%204H15%22%2F%3E%3C%2Fsvg%3E"); }
.ic-shield { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%203l7%203v5.5c0%204.6-3%207.9-7%209.5-4-1.6-7-4.9-7-9.5V6z%22%2F%3E%3C%2Fsvg%3E"); }
.ic-activity { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M3%2012h4l3%207%204-14%203%207h4%22%2F%3E%3C%2Fsvg%3E"); }
.ic-toc { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%206h16M4%2012h10M4%2018h13%22%2F%3E%3C%2Fsvg%3E"); }
.ic-edit { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M4%2020h4L19%209a2.8%202.8%200%200%200-4-4L4%2016zM13.5%206.5l4%204%22%2F%3E%3C%2Fsvg%3E"); }
.ic-info { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Ccircle%20cx%3D%2212%22%20cy%3D%2212%22%20r%3D%229%22%2F%3E%3Cpath%20d%3D%22M12%2011v5M12%208h.01%22%2F%3E%3C%2Fsvg%3E"); }
.ic-alert { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%204%202.8%2019.5h18.4zM12%2010v4.5M12%2017h.01%22%2F%3E%3C%2Fsvg%3E"); }
.ic-up-arrow-bar { --m: url("data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22black%22%20stroke-width%3D%221.8%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22M12%2020V8M7%2013l5-5%205%205M5%204h14%22%2F%3E%3C%2Fsvg%3E"); }

/* ===== trim: bento, article toc, credits ===== */
.cov-ed { display: grid; grid-template-columns: 200px minmax(0, 1fr); gap: 14px; align-items: start; }
.cov-prev { aspect-ratio: 16 / 9; border-radius: 14px; overflow: hidden; background: var(--field); border: 1px solid var(--hair); display: grid; place-items: center; }
.cov-prev img { width: 100%; height: 100%; object-fit: cover; display: block; }
.cov-side { display: grid; gap: 8px; }
.cov-side .meta { margin: 0; font-size: 12px; }
@media (max-width: 760px) { .cov-ed { grid-template-columns: 1fr; } }
.t-about { --tint: rgba(142,142,147,.16); --tc: #636366; }
html[data-theme="dark"] .t-about { --tc: #C7C7CC; }
.t-speed { grid-column: span 1; }
.toc { margin: 4px 0 0; }
.toc details { border-radius: 18px; background: var(--glass); border: 1px solid var(--line); padding: 4px 6px; box-shadow: var(--hi); }
.toc summary { list-style: none; display: flex; align-items: center; gap: 8px; min-height: 44px; padding: 0 12px; font-size: 14px; font-weight: 650; color: var(--ink-2); }
.toc summary::-webkit-details-marker { display: none; }
.toc-l { display: grid; padding: 0 6px 8px; }
.toc-l a { display: block; padding: 8px 12px; border-radius: 12px; color: var(--muted); text-decoration: none; font-size: 14px; line-height: 1.45; transition: background-color .2s ease, color .2s ease; }
.toc-l a.lv3 { padding-left: 28px; font-size: 13px; }
.toc-l a:hover { background: var(--field); color: var(--ink); }
.art-body h2, .art-body h3 { scroll-margin-top: 96px; }
.credits { margin-top: 8px; padding: 24px; border-radius: var(--r-card); background: var(--glass); border: 1px solid var(--line); }
.credits h2 { margin: 0 0 4px; font-size: 18px; letter-spacing: -.02em; }
.credits ul { list-style: none; margin: 14px 0 0; padding: 0; display: grid; gap: 2px; }
.credits li { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; padding: 10px 0; border-top: 1px solid var(--hair); font-size: 14px; }
.credits li span { color: var(--muted); }
.credits a { color: var(--link); }
@media print {
  .topslot, .foot, #splash, .drawer, .drawer-bd, #toast, #musicCtl, .pn, .toc, #progress, .art-meta .heart, .back-link { display: none !important; }
  body::before, body::after { display: none !important; }
  body { background: #fff !important; color: #000; }
  .md, .glass { background: #fff !important; box-shadow: none !important; border: 0 !important; }
  a { color: #000; }
}

/* ===== dialogs, menus ===== */
.dlg { display: grid; gap: 14px; min-width: min(380px, 100%); }
.dlg h2 { margin: 0; font-size: 19px; letter-spacing: -.02em; }
.dlg p { margin: 0; }
.dlg-act { display: flex; gap: 8px; justify-content: flex-end; flex-wrap: wrap; }
button.primary.danger { background: #E5484D; color: #fff; }
html[data-theme="dark"] button.primary.danger { background: #E5484D; color: #fff; }
.danger-t { color: #E5484D !important; }
.modal .panel:has(.dlg) { width: min(460px, 100%); }
.modal .panel.wide, .modal .panel:has(.pv) { width: min(1040px, 100%); }
.pop-menu { position: fixed; z-index: 75; width: 196px; padding: 6px; border-radius: 16px; background: var(--surface-solid); border: 1px solid var(--hair); box-shadow: var(--sh-3); display: grid; animation: menuIn .32s var(--spring) both; transform-origin: top right; }
@keyframes menuIn { from { opacity: 0; transform: scale(.94) translateY(-4px); } }
.pop-menu button { justify-content: flex-start; gap: 12px; min-height: 40px; padding: 0 12px; border-radius: 10px; border: 0; box-shadow: none; background: transparent; font-size: 14px; }
.pop-menu button:hover { background: var(--field); }
.pop-menu .ic { width: 17px; height: 17px; color: var(--muted); }
.seg { display: inline-flex; padding: 3px; gap: 2px; border-radius: 12px; background: var(--field); border: 1px solid var(--hair); }
.seg button { min-height: 36px; padding: 0 12px; border-radius: 9px; border: 0; background: transparent; box-shadow: none; color: var(--muted); }
.seg button[aria-pressed="true"] { background: var(--surface-solid); color: var(--ink); box-shadow: var(--sh-1); }
.seg.wide { display: flex; } .seg.wide button { flex: 1 1 0; }
.share-out { display: flex; gap: 8px; } .share-out input { flex: 1 1 auto; font-family: var(--mono); font-size: 13px; }

/* ===== speed ===== */
.spd { display: grid; gap: 16px; }
.spd-main { display: grid; justify-items: center; gap: 14px; padding: 28px 24px 22px; border-radius: 32px; text-align: center; }
.spd-dial { position: relative; width: min(340px, 82vw); aspect-ratio: 240 / 200; }
.spd-svg { width: 100%; height: 100%; display: block; overflow: visible; }
.spd-svg path { fill: none; stroke-width: 14; stroke-linecap: round; }
.spd-svg .trk { stroke: var(--hair-2); }
.spd-svg .val { stroke: var(--ink); transition: stroke-dashoffset .18s linear; }
html[data-theme="dark"] .spd-svg .val { stroke: #F3F4F8; }
.spd-read { position: absolute; inset: 22% 0 0; display: grid; justify-items: center; align-content: center; gap: 0; }
.spd-phase { font-size: 12px; font-weight: 650; letter-spacing: .12em; color: var(--muted); }
.spd-read b { font-size: clamp(48px, 13vw, 76px); line-height: 1.02; letter-spacing: -.04em; font-weight: 720; font-variant-numeric: tabular-nums; }
.spd-unit { font-size: 14px; color: var(--muted); font-weight: 600; }
.spd-steps { display: flex; gap: 6px; justify-content: center; }
.spd-steps span { font-size: 12.5px; font-weight: 600; padding: 4px 12px; border-radius: 999px; color: var(--faint); background: var(--field); border: 1px solid var(--hair); transition: color .2s, background-color .2s; }
.spd-steps span.on { color: var(--ink); border-color: var(--hair-2); background: var(--surface-solid); }
.spd-steps span.done { color: var(--mint); }
.spd-bar { width: min(340px, 82vw); height: 4px; border-radius: 4px; background: var(--hair); overflow: hidden; }
.spd-bar i { display: block; height: 100%; width: 0; background: var(--ink); border-radius: 4px; transition: width .15s linear; }
html[data-theme="dark"] .spd-bar i { background: #F3F4F8; }
.spd-ctl { display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; }
.spd-ctl .primary { min-width: 168px; }
.spd-ctl .ghost { background: transparent; box-shadow: none; }
.spd-note { margin: 0; font-size: 12.5px; }
.spd-cards { display: grid; grid-template-columns: repeat(5, minmax(0, 1fr)); gap: 12px; }
.spd-card { display: grid; gap: 4px; padding: 16px 18px; border-radius: 22px; min-width: 0; }
.sc-h { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: var(--muted); }
.sc-h .ic { width: 16px; height: 16px; }
.spd-card b { font-size: 30px; line-height: 1.15; letter-spacing: -.03em; font-weight: 700; font-variant-numeric: tabular-nums; }
.spd-card b small { font-size: 13px; font-weight: 600; color: var(--muted); margin-left: 4px; letter-spacing: 0; }
.sc-sub { font-size: 12px; color: var(--faint); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; font-variant-numeric: tabular-nums; }
.spd-card.ok b { animation: pop .5s var(--spring); }
@keyframes pop { 40% { transform: scale(1.06); } }
.spd-grade { padding: 24px; border-radius: 28px; display: grid; gap: 14px; }
.gr-head { display: flex; justify-content: space-between; align-items: flex-start; gap: 12px; }
.gr-head h2 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
.gr-badge { padding: 6px 14px; border-radius: 999px; font-size: 13px; font-weight: 700; background: var(--field); border: 1px solid var(--hair); }
.gr-rows { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
.gr-row { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 4px 10px; padding: 14px 16px; border-radius: 18px; background: var(--field); border: 1px solid var(--hair); }
.gr-row b { font-size: 15px; } .gr-row span { font-size: 13px; font-weight: 650; }
.gr-row small { grid-column: 2 / -1; font-size: 12px; color: var(--faint); }
.dot { width: 9px; height: 9px; border-radius: 50%; background: var(--faint); flex: 0 0 auto; }
.good .dot { background: #34C759; } .ok .dot, .warn .dot { background: #FF9F0A; } .bad .dot { background: #FF453A; } .pending .dot { background: var(--faint); animation: blink 1s infinite; }
@keyframes blink { 50% { opacity: .3; } }
.gr-row.good span { color: #1F9D47; } .gr-row.ok span { color: #C77700; } .gr-row.bad span { color: #D93A3A; }
html[data-theme="dark"] .gr-row.good span { color: #4CD964; } html[data-theme="dark"] .gr-row.ok span { color: #FFB340; } html[data-theme="dark"] .gr-row.bad span { color: #FF6961; }
.spd-grade .meta { margin: 0; font-size: 12.5px; }
/* ===== IP quality ===== */
.ipq { padding: 24px; border-radius: 28px; display: grid; gap: 16px; }
.ipq-head { display: flex; justify-content: space-between; align-items: center; gap: 16px; }
.ipq-head h2 { margin: 0; font-size: 22px; letter-spacing: -.02em; }
.ipq-head .meta { margin: 4px 0 0; font-size: 13px; }
.ipq-load { display: grid; gap: 10px; }
.ipq-score { --c: #34C759; width: 92px; height: 92px; flex: 0 0 auto; border-radius: 50%; display: grid; place-items: center; align-content: center; background: radial-gradient(closest-side, var(--surface-solid) 82%, transparent 83%), conic-gradient(var(--ink) calc(var(--p) * 1%), var(--hair) 0); }
html[data-theme="dark"] .ipq-score { background: radial-gradient(closest-side, var(--surface-solid) 82%, transparent 83%), conic-gradient(#F3F4F8 calc(var(--p) * 1%), var(--hair-2) 0); }
.ipq-score b { font-size: 28px; line-height: 1; font-weight: 720; font-variant-numeric: tabular-nums; }
.ipq-score span { font-size: 11px; color: var(--muted); font-weight: 600; margin-top: 2px; }
.ipq-est { margin: 0; display: flex; gap: 8px; align-items: flex-start; font-size: 13px; color: var(--muted); }
.ipq-est .ic { margin-top: 2px; width: 16px; height: 16px; }
.ipq-facts { margin: 0; display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: 8px; }
.ipq-facts div { padding: 12px 14px; border-radius: 16px; background: var(--field); border: 1px solid var(--hair); min-width: 0; }
.ipq-facts div.wide { grid-column: span 2; }
.ipq-facts dt { font-size: 11.5px; font-weight: 650; letter-spacing: .06em; color: var(--faint); }
.ipq-facts dd { margin: 2px 0 0; font-size: 14.5px; font-weight: 600; overflow-wrap: anywhere; line-height: 1.4; font-variant-numeric: tabular-nums; }
.ipq-checks { list-style: none; margin: 0; padding: 0; display: grid; gap: 2px; }
.ipq-checks li { display: flex; gap: 12px; align-items: flex-start; padding: 12px 4px; border-top: 1px solid var(--hair); }
.ipq-checks li .dot { margin-top: 7px; }
.ipq-checks b { display: block; font-size: 14.5px; }
.ipq-checks span { display: block; font-size: 13px; color: var(--muted); line-height: 1.55; }
.ipq > .meta { margin: 0; font-size: 12px; }
@media (max-width: 1099px) {
  .spd-cards { grid-template-columns: repeat(6, minmax(0, 1fr)); }
  .spd-card { grid-column: span 2; }
  .spd-card:nth-child(1), .spd-card:nth-child(2) { grid-column: span 3; }
  .ipq-facts { grid-template-columns: repeat(2, minmax(0, 1fr)); }
}
@media (max-width: 760px) {
  .spd-main { padding: 22px 16px 18px; border-radius: 28px; }
  .spd-cards { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 10px; }
  .spd-card, .spd-card:nth-child(1), .spd-card:nth-child(2) { grid-column: span 1; padding: 14px 16px; }
  .spd-card:nth-child(5) { grid-column: span 2; }
  .spd-card b { font-size: 26px; }
  .gr-rows { grid-template-columns: 1fr; }
  .ipq, .spd-grade { padding: 20px 18px; }
  .ipq-score { width: 78px; height: 78px; } .ipq-score b { font-size: 24px; }
  .ipq-facts div.wide { grid-column: 1 / -1; }
}

/* ===== drive ===== */
.drv { display: grid; gap: 14px; position: relative; }
.drv-head { display: flex; justify-content: space-between; align-items: flex-end; gap: 16px; flex-wrap: wrap; padding: 36px 4px 4px; }
.drv-usage { display: grid; gap: 6px; min-width: 240px; font-size: 12.5px; color: var(--muted); font-variant-numeric: tabular-nums; }
.u-bar { height: 6px; border-radius: 6px; background: var(--hair); overflow: hidden; }
.u-bar i { display: block; height: 100%; width: 0; border-radius: 6px; background: var(--ink); transition: width .6s var(--ease-out); }
html[data-theme="dark"] .u-bar i { background: #F3F4F8; }
.drv-usage.warn .u-bar i { background: #FF9F0A; }
.drv-tools { display: grid; gap: 12px; padding: 14px; border-radius: 22px; position: sticky; top: 84px; z-index: 5; }
.drv-crumb { display: flex; align-items: center; gap: 4px; flex-wrap: wrap; min-height: 32px; font-size: 14px; }
.drv-crumb .bc { display: inline-flex; align-items: center; gap: 6px; padding: 4px 8px; border-radius: 8px; color: var(--muted); text-decoration: none; font-weight: 550; }
.drv-crumb a.bc:hover { background: var(--field); color: var(--ink); }
.drv-crumb .bc.cur { color: var(--ink); font-weight: 650; }
.drv-crumb .sep { color: var(--faint); }
.drv-tr { display: flex; gap: 8px; align-items: center; flex-wrap: wrap; }
.drv-search { flex: 1 1 220px; min-width: 0; }
.drv-tr select { width: auto; flex: 0 0 auto; min-height: 42px; }
.drv-tr > button { min-height: 42px; }
.drv-tr .ghost { background: transparent; box-shadow: none; }
.drv-sel { display: flex; justify-content: space-between; align-items: center; gap: 10px; padding: 8px 8px 8px 18px; border-radius: 18px; position: sticky; top: 84px; z-index: 6; animation: sheetIn .4s var(--spring) both; font-weight: 650; font-size: 14px; }
.sel-act { display: flex; gap: 4px; }
.sel-act button { min-height: 40px; padding: 0 14px; border: 0; box-shadow: none; background: transparent; }
.sel-act button:hover { background: var(--field); }
.drv-body { border-radius: 24px; padding: 6px; min-height: 240px; transition: opacity .2s ease; }
.drv-body.busy { opacity: .55; pointer-events: none; }
.drv-list { display: grid; }
.dl-h, .dl-r { display: grid; grid-template-columns: 44px minmax(0, 1fr) 110px 160px 48px; align-items: center; gap: 4px; }
.dl-h { min-height: 40px; font-size: 12px; font-weight: 650; letter-spacing: .06em; color: var(--faint); border-bottom: 1px solid var(--hair); }
.dl-r { min-height: 60px; border-radius: 14px; transition: background-color .15s ease; animation: rise .45s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 18ms); }
.dl-r + .dl-r { box-shadow: 0 -1px 0 var(--hair); }
.dl-r:hover { background: var(--field); }
.dl-r.sel, .gi.sel { background: var(--accent-soft); }
.dl-n { justify-content: flex-start; gap: 12px; min-height: 56px; padding: 0 6px; border: 0; box-shadow: none; background: transparent; border-radius: 12px; text-align: left; min-width: 0; white-space: normal; }
.dl-n:active { transform: scale(.985); }
.dl-n .nm { display: grid; min-width: 0; }
.dl-n .nm b { font-size: 14.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.dl-n .nm small { font-size: 12px; color: var(--faint); display: none; }
.c-sz, .c-t { font-size: 13px; color: var(--muted); font-variant-numeric: tabular-nums; white-space: nowrap; }
.fi { width: 38px; height: 38px; flex: 0 0 auto; border-radius: 11px; display: grid; place-items: center; background: var(--field); color: var(--muted); }
.fi .ic { width: 20px; height: 20px; }
.k-folder { color: #0A84FF; background: rgba(10,132,255,.12); } .k-image { color: #30B0C7; background: rgba(48,176,199,.13); } .k-video { color: #AF52DE; background: rgba(175,82,222,.12); } .k-audio { color: #FF375F; background: rgba(255,55,95,.11); } .k-pdf { color: #FF453A; background: rgba(255,69,58,.11); } .k-archive { color: #A2845E; background: rgba(162,132,94,.15); } .k-text { color: #636366; background: rgba(99,99,102,.12); }
.ck { display: grid; place-items: center; width: 44px; height: 44px; position: relative; cursor: pointer; }
.ck input { position: absolute; opacity: 0; width: 44px; height: 44px; margin: 0; cursor: pointer; }
.ck i { width: 20px; height: 20px; border-radius: 6px; border: 1.6px solid var(--hair-2); background: var(--surface-solid); transition: background-color .15s, border-color .15s, transform .35s var(--spring); }
.ck input:checked + i { background: var(--ink); border-color: var(--ink); -webkit-mask: none; box-shadow: inset 0 0 0 3px var(--surface-solid); }
html[data-theme="dark"] .ck input:checked + i { background: #F3F4F8; border-color: #F3F4F8; }
.ck input:indeterminate + i { background: linear-gradient(var(--ink), var(--ink)) center / 10px 2px no-repeat, var(--surface-solid); }
.ck input:focus-visible + i { outline: 2px solid var(--accent); outline-offset: 2px; }
.ck:active i { transform: scale(.88); }
.more { opacity: .7; } .more:hover { opacity: 1; }
.drv-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(156px, 1fr)); gap: 8px; padding: 6px; }
.gi { position: relative; border-radius: 18px; transition: background-color .15s ease; animation: rise .45s var(--ease-out) both; animation-delay: calc(var(--i, 0) * 22ms); }
.gi:hover { background: var(--field); }
.gi .ck { position: absolute; top: 4px; left: 4px; z-index: 2; opacity: 0; transition: opacity .15s; }
.gi .more { position: absolute; top: 6px; right: 6px; z-index: 2; opacity: 0; background: var(--surface-solid); }
.gi:hover .ck, .gi:hover .more, .gi.sel .ck, .gi .ck:focus-within, .gi .more:focus-visible { opacity: 1; }
@media (hover: none) { .gi .ck, .gi .more { opacity: 1; } }
.gi-open { display: grid; grid-template-columns: minmax(0, 1fr); justify-content: stretch; align-items: start; align-content: start; gap: 6px; justify-items: stretch; width: 100%; padding: 10px; min-height: 0; border: 0; box-shadow: none; background: transparent; border-radius: 18px; white-space: normal; text-align: left; }
.gi-th { width: 100%; aspect-ratio: 4 / 3; border-radius: 12px; display: grid; place-items: center; overflow: hidden; }
.gi-th .ic { width: 38px; height: 38px; }
.gi-th img { width: 100%; height: 100%; object-fit: cover; display: block; }
.gi-n { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.gi-s { font-size: 11.5px; color: var(--faint); font-variant-numeric: tabular-nums; margin-top: -4px; }
.drv-empty { display: grid; justify-items: center; text-align: center; gap: 6px; padding: 56px 20px; color: var(--muted); }
.drv-empty .em-ic { width: 60px; height: 60px; border-radius: 20px; display: grid; place-items: center; background: var(--field); color: var(--muted); margin-bottom: 8px; }
.drv-empty .em-ic .ic { width: 28px; height: 28px; }
.drv-empty h2 { margin: 0; font-size: 18px; color: var(--ink); }
.drv-empty p { margin: 0; font-size: 14px; }
.drv-drop { position: fixed; inset: 0; z-index: 66; display: grid; place-items: center; background: rgba(10,132,255,.08); -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); pointer-events: none; animation: fadeIn .2s ease both; }
.drv-drop > div { display: grid; justify-items: center; gap: 6px; padding: 32px 48px; border-radius: 28px; border: 2px dashed #0A84FF; background: var(--surface-solid); box-shadow: var(--sh-3); }
.drv-drop .ic { width: 34px; height: 34px; color: #0A84FF; }
.drv-drop span { font-size: 13px; color: var(--muted); }
.adm-posts { display: grid; gap: 10px; margin-top: 16px; }
.adm-post { display: grid; grid-template-columns: 96px minmax(0, 1fr) auto; gap: 14px; align-items: center; padding: 10px; border-radius: 18px; background: var(--field); border: 1px solid var(--hair); }
.adm-thumb { aspect-ratio: 16 / 10; border-radius: 12px; overflow: hidden; display: grid; place-items: center; background: var(--surface); color: var(--muted); }
.adm-thumb img { width: 100%; height: 100%; object-fit: cover; display: block; }
.adm-main { display: grid; gap: 4px; min-width: 0; }
.adm-main b { font-size: 15px; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; }
.adm-main .meta { font-size: 12.5px; margin: 0; line-height: 1.5; }
.st-dot { width: 7px; height: 7px; border-radius: 50%; background: #C2C2C8; display: inline-block; margin-right: 6px; vertical-align: 1px; }
.st-dot.on { background: #22C55E; }
.adm-act { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
.adm-act .mini, .adm-act .btn.mini { min-height: 36px; padding: 0 12px; font-size: 13px; display: inline-flex; align-items: center; }
.adm-act .danger { color: #D93A3A; }
@media (max-width: 600px) { .adm-post { grid-template-columns: 72px minmax(0, 1fr); } .adm-act { grid-column: 1 / -1; justify-content: flex-start; } }
html[data-photo] .drv-foot { text-shadow: 0 0 1px var(--halo), 0 1px 10px var(--halo); color: color-mix(in srgb, var(--ink) 72%, transparent); }
.drv-foot { margin: 0; font-size: 12.5px; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; justify-content: space-between; }
.up-panel { position: fixed; right: max(16px, env(safe-area-inset-right, 0px)); bottom: max(16px, env(safe-area-inset-bottom, 0px)); z-index: 64; width: min(380px, calc(100vw - 32px)); max-height: min(60vh, 460px); display: flex; flex-direction: column; border-radius: 22px; padding: 8px; animation: sheetIn .45s var(--spring) both; box-shadow: var(--sh-3); }
.up-h { display: flex; justify-content: space-between; align-items: center; padding: 4px 4px 4px 12px; font-size: 14px; }
.up-list { overflow-y: auto; display: grid; gap: 2px; }
.up-r { display: grid; grid-template-columns: auto minmax(0, 1fr) auto; gap: 10px; align-items: center; padding: 8px; border-radius: 14px; }
.up-m { display: grid; gap: 3px; min-width: 0; }
.up-m b { font-size: 13.5px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-m small { font-size: 11.5px; color: var(--muted); font-variant-numeric: tabular-nums; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.up-m .u-bar { height: 4px; }
.up-r.done .u-bar i { background: #34C759; } .up-r.err small { color: #E5484D; }
.pv { display: grid; gap: 14px; }
.pv-h { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.pv-t { display: grid; flex: 1 1 200px; min-width: 0; }
.pv-t b { font-size: 16px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.pv-t small { font-size: 12.5px; color: var(--muted); }
.pv-h .btn { min-height: 40px; }
.pv-media { border-radius: 16px; overflow: hidden; background: #0b0c10; display: grid; place-items: center; }
.pv-media img, .pv-media video { max-width: 100%; max-height: 70vh; display: block; }
.pv-pdf { background: #fff; } .pv-pdf iframe { width: 100%; height: 72vh; border: 0; display: block; }
.pv-audio { padding: 24px; border-radius: 16px; background: var(--field); } .pv-audio audio { width: 100%; }
.pv-text { max-height: 70vh; overflow: auto; margin: 0; white-space: pre-wrap; word-break: break-word; }
.pick .pk-crumb { display: flex; gap: 6px; flex-wrap: wrap; font-size: 14px; } .pick .pk-crumb a { color: var(--link); text-decoration: none; } .pick .pk-crumb span { color: var(--faint); }
.pk-list { display: grid; gap: 2px; max-height: 46vh; overflow: auto; border-radius: 14px; border: 1px solid var(--hair); padding: 4px; }
.pk-list button { justify-content: flex-start; gap: 10px; border: 0; box-shadow: none; background: transparent; border-radius: 10px; min-height: 44px; }
.pk-list button:hover { background: var(--field); } .pk-list .ic { color: #0A84FF; }
.pk-list .meta { margin: 0; padding: 12px; }
@media (max-width: 1099px) { .dl-h, .dl-r { grid-template-columns: 44px minmax(0, 1fr) 96px 48px; } .c-t { display: none; } }
@media (max-width: 760px) {
  .drv-head { padding-top: 24px; }
  .drv-usage { min-width: 0; width: 100%; }
  .drv-tools, .drv-sel { top: 76px; }
  .drv-tr { display: grid; grid-template-columns: minmax(0, 1fr) auto auto; }
  .drv-search { grid-column: 1 / -1; }
  .drv-tr select { width: 100%; grid-column: 1; }
  .drv-tr > #mkdirBtn span { display: none; }
  .drv-tr > #mkdirBtn { padding: 0 12px; }
  #upBtn { grid-column: 1 / -1; }
  .dl-h, .dl-r { grid-template-columns: 40px minmax(0, 1fr) 44px; }
  .dl-h .c-sz, .dl-r .c-sz { display: none; }
  .dl-n .nm small { display: block; }
  .drv-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
  .sel-act button span { display: none; }
  .sel-act button { padding: 0 12px; }
  .drv-foot { flex-direction: column; align-items: flex-start; }
  .up-panel { left: 12px; right: 12px; width: auto; bottom: max(12px, env(safe-area-inset-bottom, 0px)); }
}
@media (min-width: 761px) and (max-width: 1099px) { .drv-grid { grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); } }
`;

/* HONGUI_PART_2 */
function extractFn(fn) {
  const s = fn.toString();
  return s.slice(s.indexOf("{") + 1, s.lastIndexOf("}"));
}
let CLIENT_BUNDLE = "";
function clientBundle() {
  if (!CLIENT_BUNDLE) {
    CLIENT_BUNDLE = "var __name=function(f){return f;};\n" + [escapeHtml, safeUrl, inlineMd, renderMath, highlightCode, renderMdBlocks, renderMarkdown]
      .map((fn) => fn.toString()).join("\n") + "\n" + extractFn(clientApp);
  }
  return CLIENT_BUNDLE;
}

function clientApp() {
  const app = document.getElementById("app");
  const CATS = ["鄞州高中随想", "公路骑行日记", "乒乓球手记", "极客技术折腾"];
  const MODES = [
    { id: "general", label: "通用助手" },
    { id: "polish", label: "写作润色" },
    { id: "code", label: "代码助手" },
    { id: "translate", label: "翻译" },
    { id: "study", label: "学习辅导" }
  ];
  let me = null;
  let aiCfg = { tiers: [], allowGuest: true, guestImages: true, guestDailyLimit: 20, defaultTier: "general", isAdmin: false, unlimited: false, guestRemaining: null };
  let postsCache = null;
  let drivePath = "";
  let driveSelected = [];

  function $(id) { return document.getElementById(id); }
  const ROOT = document.documentElement;
  const MARK = (document.getElementById("tplMark") || {}).innerHTML || "";
  const AIHOST = ROOT.getAttribute("data-host") === "ai";
  const AI_ORIGIN = ROOT.getAttribute("data-ai-origin") || "https://ai.hongspaces.com";
  const MAIN_ORIGIN = ROOT.getAttribute("data-main-origin") || location.origin;
  function reducedMotion() { try { return matchMedia("(prefers-reduced-motion: reduce)").matches; } catch { return false; } }
  const SPRING = (window.CSS && CSS.supports && CSS.supports("transition-timing-function", "linear(0, 1)")) ? "linear(0, 0.006, 0.025 2.8%, 0.101 6.1%, 0.539 18.9%, 0.721 25.3%, 0.849 31.5%, 0.937 38.1%, 0.968 41.8%, 0.991 45.7%, 1.006 50.1%, 1.015 55%, 1.017 63.9%, 1.001 85.9%, 1)" : "cubic-bezier(.2,.9,.25,1.08)";
  function curPath() { return AIHOST ? "/ai" : location.pathname; }
  function onAiView() { return curPath() === "/ai"; }
  function moveInd(box, instant) {
    if (!box) return;
    let ind = null;
    for (const c of box.children) { if (c.classList && c.classList.contains("ind")) { ind = c; break; } }
    if (!ind) { ind = document.createElement("span"); ind.className = "ind"; ind.setAttribute("aria-hidden", "true"); box.insertBefore(ind, box.firstChild); instant = true; }
    const on = box.querySelector(':scope > [aria-current="page"], :scope > [aria-pressed="true"]');
    if (!on || !on.offsetWidth) { ind.style.opacity = "0"; return; }
    if (instant || reducedMotion()) ind.style.transition = "none";
    ind.style.width = on.offsetWidth + "px";
    ind.style.height = on.offsetHeight + "px";
    ind.style.transform = "translate(" + on.offsetLeft + "px," + on.offsetTop + "px)";
    ind.style.opacity = "1";
    if (instant) { void ind.offsetWidth; requestAnimationFrame(() => { ind.style.transition = ""; }); }
  }
  function pageEnter() {
    if (reducedMotion() || AIHOST || !app) return;
    app.classList.remove("pg-in");
    void app.offsetWidth;
    app.classList.add("pg-in");
    clearTimeout(pageEnter._t);
    pageEnter._t = setTimeout(() => app.classList.remove("pg-in"), 700);
  }
  function skeletonFor(path) {
    if (path.startsWith("/post/")) return '<div class="sk-page article" aria-hidden="true"><div class="sk sk-line" style="width:110px;height:40px;border-radius:999px;margin-top:32px"></div><div class="sk sk-title"></div><div class="sk sk-line" style="width:90%"></div><div class="sk sk-line" style="width:60%"></div><div class="sk sk-cover" style="width:min(1040px,100%)"></div></div>';
    if (path === "/") return '<div class="sk-page" aria-hidden="true"><div class="sk sk-hero"></div><div class="sk-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div></div>';
    return '<div class="sk-page" aria-hidden="true"><div class="sk sk-title" style="margin-top:40px"></div><div class="sk sk-line" style="width:50%"></div><div class="sk sk-card" style="height:260px"></div></div>';
  }
  let prevPath = curPath();
  let navSource = null;
  function vtCover(host, on) {
    if (!host) return [];
    const cv = host.querySelector(".cover");
    if (!cv) return [];
    cv.style.viewTransitionName = on ? "post-cover" : "";
    return [cv];
  }
  function runRoute(kind) {
    const from = prevPath;
    const to = curPath();
    prevPath = to;
    const src = navSource;
    navSource = null;
    if (from.startsWith("/post/") && !to.startsWith("/post/") && kind !== "fade") kind = "back";
    if (AIHOST || !document.startViewTransition || reducedMotion() || !ROOT.classList.contains("splash-done")) {
      window.scrollTo(0, 0);
      return renderRoute().then(() => pageEnter());
    }
    let oldEls = [];
    if (to.startsWith("/post/") && src && src.closest) {
      oldEls = vtCover(src.closest("[data-pid]"), true);
      if (oldEls.length) kind = "expand";
    } else if (from.startsWith("/post/") && !to.startsWith("/post/")) {
      oldEls = vtCover(app.querySelector(".article"), true);
    }
    ROOT.setAttribute("data-vt", kind || "forward");
    let t;
    try {
      t = document.startViewTransition(async () => {
        oldEls.forEach((el) => { el.style.viewTransitionName = ""; });
        let done = false;
        const p = renderRoute().then(() => { done = true; });
        await Promise.race([p, new Promise((r) => setTimeout(r, 350))]);
        if (!done) app.innerHTML = skeletonFor(to);
        window.scrollTo(0, 0);
        if (kind === "expand" && to.startsWith("/post/")) vtCover(app.querySelector(".article"), true);
        else if (from.startsWith("/post/") && to === "/") {
          const id = decodeURIComponent(from.slice(6));
          const c = Array.from(app.querySelectorAll("[data-pid]")).find((el) => el.getAttribute("data-pid") === id);
          if (c) vtCover(c, true);
        }
      });
    } catch (e) {
      ROOT.removeAttribute("data-vt");
      window.scrollTo(0, 0);
      return renderRoute();
    }
    return t.finished.catch(() => {}).finally(() => {
      ROOT.removeAttribute("data-vt");
      app.querySelectorAll(".cover").forEach((el) => { if (el.style.viewTransitionName) el.style.viewTransitionName = ""; });
    });
  }
  function toggleDrawer(force) {
    const dr = $("navDrawer"), bd = $("drawerBd"), b = $("menuBtn");
    if (!dr) return;
    const open = force == null ? dr.hidden : !!force;
    if (open === !dr.hidden) return;
    if (open) {
      syncDrawer();
      dr.hidden = false; bd.hidden = false;
      void dr.offsetWidth;
      dr.classList.add("on"); bd.classList.add("on");
      ROOT.classList.add("drawer-open");
      const f = dr.querySelector('[aria-current="page"]') || dr.querySelector("a");
      if (f) setTimeout(() => f.focus({ preventScroll: true }), 60);
    } else {
      dr.classList.remove("on"); bd.classList.remove("on");
      ROOT.classList.remove("drawer-open");
      const done = () => { if (!dr.classList.contains("on")) { dr.hidden = true; bd.hidden = true; } };
      if (reducedMotion()) done(); else setTimeout(done, 380);
      if (b && dr.contains(document.activeElement)) b.focus({ preventScroll: true });
    }
    if (b) { b.setAttribute("aria-expanded", open ? "true" : "false"); b.setAttribute("aria-label", open ? "关闭菜单" : "打开菜单"); }
  }
  function syncDrawer() {
    const box = $("drawerBgs"), H = window.HBG;
    if (box && H && !box.dataset.built) {
      box.dataset.built = "1";
      box.innerHTML = H.order.map((id) => {
        const p = H.presets[id];
        const th = p.ph ? '<img src="/bg/' + id + '-t.webp" alt="" loading="lazy" decoding="async" width="160" height="100">' : '<i style="background:linear-gradient(135deg,' + p.a[0] + "," + p.a[1] + ')"></i>';
        return '<button type="button" class="dr-bg" data-dbg="' + id + '" aria-pressed="false" title="' + p.n + '">' + th + "<span>" + p.n + "</span></button>";
      }).join("");
    }
    if (box && H) {
      const c = H.effective();
      box.querySelectorAll("[data-dbg]").forEach((el) => el.setAttribute("aria-pressed", c && c.k === "preset" && (c.id === el.getAttribute("data-dbg") || (!H.presets[c.id] && el.getAttribute("data-dbg") === "default")) ? "true" : "false"));
    }
    const dk = $("drawerDark");
    if (dk) dk.checked = ROOT.getAttribute("data-theme") === "dark";
  }
  function aiSugsHtml() {
    const list = [["规划骑行", "帮我规划一条 60 公里左右的宁波周末公路骑行路线，并给出补给建议"], ["乒乓球进阶", "乒乓球反手拧拉怎么练？给我一个两周训练计划"], ["学习辅导", "用高中生能听懂的方式讲讲什么是导数，并举两个例子"], ["代码助手", "用 JavaScript 写一个防抖函数，并解释原理"]];
    return '<div class="ai-sugs">' + list.map((x) => '<button type="button" data-sug="' + escapeHtml(x[1]) + '"><b>' + escapeHtml(x[0]) + "</b><span>" + escapeHtml(x[1]) + "</span></button>").join("") + "</div>";
  }
  function aiAcctHtml() {
    if (!AIHOST) return "";
    return '<div class="ai-acct"><button type="button" id="themeBtn" class="icon-btn" aria-pressed="' + (ROOT.getAttribute("data-theme") === "dark" ? "true" : "false") + '" aria-label="切换深色模式" title="切换深色模式"><i class="ic ic-moon" aria-hidden="true"></i><i class="ic ic-sun" aria-hidden="true"></i></button><a class="btn ghost" href="' + escapeHtml(MAIN_ORIGIN) + '/"><i class="ic ic-globe" aria-hidden="true"></i>主站</a><span class="grow"></span>' +
      (me && me.user ? '<button type="button" id="aiLogout" title="退出管理员"><i class="ic ic-logout" aria-hidden="true"></i>退出</button>' : '<button type="button" id="aiLoginOpen"><i class="ic ic-lock" aria-hidden="true"></i>管理员登录</button>') + "</div>";
  }
  function openAiLogin() {
    openModal('<form id="aiLoginForm" class="poster-form ai-login"><p class="kicker">HONGUI AI</p><h2 style="margin:0">管理员登录</h2><p class="meta">登录后不限次数，会话同步到服务器。密码只发到服务器，不会写进浏览器本地存储。</p><label>账号<input name="user" autocomplete="username" required></label><label>密码<input name="pass" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">登录</button><p id="aiLoginErr" class="warn"></p></form>');
    const f = $("aiLoginForm");
    if (!f) return;
    const first = f.querySelector("input");
    if (first) setTimeout(() => first.focus(), 50);
    f.onsubmit = async (e) => {
      e.preventDefault();
      const fd = new FormData(f);
      try {
        await api("/api/auth/login", { method: "POST", body: JSON.stringify({ user: fd.get("user"), pass: fd.get("pass") }) });
        location.reload();
      } catch (err) { $("aiLoginErr").textContent = err.message; }
    };
  }
  function bindAiAcct() {
    if ($("aiLoginOpen")) $("aiLoginOpen").onclick = () => openAiLogin();
    if ($("aiLogout")) $("aiLogout").onclick = async () => {
      try { await api("/api/auth/logout", { method: "POST", body: "{}" }); } catch { /* ignore */ }
      location.reload();
    };
  }
  function toast(msg) {
    const t = $("toast");
    t.textContent = msg;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => { t.hidden = true; }, 2600);
  }
  function safeNext(n) {
    try {
      const u = new URL(n || "/", location.origin);
      if (u.origin !== location.origin) return "/";
      if (u.pathname.startsWith("//")) return "/";
      return u.pathname + u.search;
    } catch { return "/"; }
  }
  function navigate(path, replace) {
    const next = safeNext(path);
    if (replace) history.replaceState({}, "", next);
    else if (location.pathname + location.search !== next) history.pushState({}, "", next);
    return runRoute(replace ? "fade" : "forward");
  }
  async function api(path, opts) {
    opts = opts || {};
    opts.headers = Object.assign({ Accept: "application/json" }, opts.headers || {});
    if (opts.body && typeof opts.body === "string" && !opts.headers["Content-Type"]) opts.headers["Content-Type"] = "application/json";
    const r = await fetch(path, opts);
    const ct = r.headers.get("content-type") || "";
    if (ct.includes("application/json")) {
      const j = await r.json();
      if (r.status === 403 && j.gate) {
        let n = 0;
        try { n = Number(sessionStorage.getItem("hongui_gate_reload") || 0); sessionStorage.setItem("hongui_gate_reload", String(n + 1)); } catch { /* ignore */ }
        if (n < 2) { location.reload(); return new Promise(() => {}); }
      }
      if (!r.ok || j.ok === false) {
        const err = new Error(j.error || ("请求失败 " + r.status));
        err.status = r.status;
        throw err;
      }
      return j;
    }
    if (!r.ok) throw new Error("请求失败 " + r.status);
    return r;
  }
  function fmtBytes(n) {
    n = Number(n) || 0;
    const u = ["B", "KB", "MB", "GB", "TB"];
    let i = 0;
    while (n >= 1024 && i < u.length - 1) { n /= 1024; i++; }
    return (i === 0 ? String(n) : n.toFixed(n >= 10 ? 1 : 2)) + " " + u[i];
  }
  function fmtDate(s) {
    if (!s) return "";
    const d = new Date(s);
    if (isNaN(d.getTime())) return "";
    const p = (x) => (x < 10 ? "0" + x : "" + x);
    return d.getFullYear() + "-" + p(d.getMonth() + 1) + "-" + p(d.getDate()) + " " + p(d.getHours()) + ":" + p(d.getMinutes());
  }
  function readingMinutes(md) {
    const text = String(md || "").replace(/```[\s\S]*?```/g, " ");
    const n = text.replace(/\s/g, "").length;
    return Math.max(1, Math.round(n / 400));
  }
  function setNav(path) {
    const onAi = path === "/ai";
    document.documentElement.classList.toggle("ai-route", onAi);
    if (!onAi) {
      document.documentElement.style.removeProperty("--aiShellH");
      const appEl = $("app");
      if (appEl) appEl.style.transform = "";
      if (window.__aiVvCleanup) { window.__aiVvCleanup(); window.__aiVvCleanup = null; }
    }
    document.querySelectorAll("[data-nav]").forEach((a) => {
      const on = a.getAttribute("data-nav") === path || (path.startsWith("/post/") && a.getAttribute("data-nav") === "/");
      if (on) a.setAttribute("aria-current", "page");
      else a.removeAttribute("aria-current");
    });
    moveInd(document.querySelector(".top .nav"));
  }
  function hero() {
    return '<section class="intro-card hero-x reveal" style="--i:0"><div class="hx-eyebrow">Powered by HONGUI · 开发者：项宏</div>' +
      '<h1 class="hx-title">你好，我是项宏。<br><span class="grad-text nb">把想法，</span><span class="grad-text nb">做成能运行的东西。</span></h1>' +
      '<p class="bio">浙江省宁波市鄞州区的高中生。喜欢理性自省、公路骑行、乒乓球，也热衷把想法做成可运行的东西。</p>' +
      '<div class="hx-cta"><a class="btn primary lg" href="#posts" data-jump="posts">阅读文章 <i class="ic ic-arrow-right" aria-hidden="true"></i></a><a class="btn ghost lg" href="' + escapeHtml(AI_ORIGIN) + '/">和 AI 聊聊 <i class="ic ic-arrow-up-right" aria-hidden="true"></i></a></div>' +
      '<div class="pills"><span class="pill"><i class="ic ic-pin" aria-hidden="true"></i>宁波鄞州</span><span class="pill"><i class="ic ic-bike" aria-hidden="true"></i>公路骑行</span><span class="pill"><i class="ic ic-pingpong" aria-hidden="true"></i>乒乓球</span><span class="pill"><i class="ic ic-code" aria-hidden="true"></i>极客技术</span><a class="pill" href="https://t.me/your_telegram" rel="noopener noreferrer" target="_blank"><i class="ic ic-send" aria-hidden="true"></i>Telegram @your_telegram</a><span class="pill"><i class="ic ic-msg" aria-hidden="true"></i>微信 your_wechat</span></div></section>';
  }
  function coverSrc(key) { return "/image/" + String(key).split("/").map(encodeURIComponent).join("/"); }
  function coverHtml(p, lazy, sizes) {
    const ci = CATS.indexOf(p.category);
    if (!p.cover) return '<div class="ph" data-c="' + ci + '" aria-hidden="true">' + escapeHtml((p.title || "文").slice(0, 1)) + "</div>";
    const m = /^(.*)-1600\.webp$/.exec(p.cover);
    const small = m ? coverSrc(m[1] + "-800.webp") : coverSrc(p.cover);
    const set = m ? ' srcset="' + escapeHtml(small) + " 800w, " + escapeHtml(coverSrc(p.cover)) + ' 1600w" sizes="' + (sizes || "(max-width: 760px) 92vw, (max-width: 1099px) 46vw, 380px") + '"' : "";
    return '<img' + (lazy ? ' loading="lazy"' : ' fetchpriority="high"') + ' decoding="async" width="1600" height="914" src="' + escapeHtml(lazy || m ? small : coverSrc(p.cover)) + '"' + set + ' alt="' + escapeHtml(p.title) + ' 封面">';
  }
  function bentoHtml() {
    const posts = postsCache || [];
    const latest = posts[0];
    const go = '<span class="go" aria-hidden="true"><i class="ic ic-arrow-up-right"></i></span>';
    const small = (cls, href, ic, kicker, title, sub, attr) => '<a class="tile ' + cls + ' reveal" href="' + href + '"' + (attr || "") + '><span class="tile-ic" aria-hidden="true"><i class="ic ic-' + ic + '"></i></span>' + go + '<span class="kicker">' + kicker + "</span><h3>" + title + "</h3><p>" + sub + "</p></a>";
    const lt = latest
      ? '<a class="tile t-latest reveal" data-pid="' + escapeHtml(latest.id) + '" href="/post/' + escapeHtml(latest.id) + '" style="--i:1"><div class="cover">' + coverHtml(latest, false, "(max-width: 760px) 92vw, 600px") + "</div>" + go + '<div class="tile-body"><span class="kicker">最新文章 · ' + escapeHtml(latest.category) + "</span><h3>" + escapeHtml(latest.title) + "</h3><p>" + escapeHtml(latest.summary || "") + "</p></div></a>"
      : '<a class="tile t-latest reveal" href="/admin?tab=edit" style="--i:1"><div class="cover"><div class="ph" aria-hidden="true">H</div></div>' + go + '<div class="tile-body"><span class="kicker">最新文章</span><h3>还没有文章</h3><p>后台发布后会出现在这里。</p></div></a>';
    return '<section class="bento" aria-label="站点导览">' + lt +
      '<a class="tile t-ai reveal" href="' + escapeHtml(AI_ORIGIN) + '/" style="--i:2"><span class="tile-ic" aria-hidden="true"><i class="ic ic-sparkles"></i></span>' + go + '<span class="kicker">HONGUI AI · 独立站点</span><h3>随时提问的 AI 助手</h3><p>ai.hongspaces.com · 游客可免费体验</p></a>' +
      small("t-speed", "/speed", "gauge", "工具", "测速与 IP 质量", "到 Cloudflare 边缘的网络体检", ' style="--i:3"') +
      small("t-about", "/about", "user", "关于", "关于我", "宁波鄞州 · 高中生开发者", ' style="--i:4"') +
      "</section>";
  }
  function openModal(html) {
    const root = $("modal");
    root.innerHTML = '<div class="panel" role="dialog" aria-modal="true"><div class="row" style="justify-content:flex-end"><button type="button" id="modalClose">关闭</button></div>' + html + "</div>";
    root.hidden = false;
  }
  function closeModal() {
    const root = $("modal");
    root.hidden = true;
    root.innerHTML = "";
  }
  function saveBlob(blob, name) {
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }
  function xhrSend(method, url, body, headers, onProgress) {
    return new Promise((resolve, reject) => {
      const x = new XMLHttpRequest();
      x.open(method, url);
      Object.keys(headers || {}).forEach((k) => x.setRequestHeader(k, headers[k]));
      if (x.upload && onProgress) x.upload.onprogress = (e) => { if (e.lengthComputable) onProgress(e.loaded, e.total); };
      x.onload = () => {
        let j = {};
        try { j = JSON.parse(x.responseText || "{}"); } catch { j = {}; }
        if (x.status >= 200 && x.status < 300 && j.ok !== false) resolve(j);
        else {
          const err = new Error((j && j.error) || ("上传失败 " + x.status));
          err.status = x.status;
          reject(err);
        }
      };
      x.onerror = () => reject(new Error("网络错误"));
      x.send(body);
    });
  }
  function etaText(loaded, total, t0) {
    const sec = (Date.now() - t0) / 1000;
    if (!sec || !loaded) return "计算中";
    const left = Math.max(0, total - loaded) / (loaded / sec);
    if (!Number.isFinite(left)) return "计算中";
    if (left < 60) return Math.max(1, Math.ceil(left)) + " 秒";
    return Math.ceil(left / 60) + " 分钟";
  }

  async function renderRoute() {
    const path = curPath();
    if (path === "/ai" && !AIHOST) { location.replace(AI_ORIGIN + "/"); return; }
    setNav(path);
    $("progress").style.width = "0";
    closeModal();
    try {
      if (path === "/") await renderHome();
      else if (path.startsWith("/post/")) await renderPost(decodeURIComponent(path.slice(6)));
      else if (path === "/about") await renderAbout();
      else if (path === "/values") await renderValues();
      else if (path === "/drive") await renderDrive();
      else if (path === "/ai") await renderAi();
      else if (path === "/speed") await renderSpeed();
      else if (path === "/admin") await renderAdmin();
      else renderNotFound();
    } catch (e) {
      app.innerHTML = '<div class="glass strong pad"><h1>出错了</h1><p>' + escapeHtml(e.message || "加载失败") + '</p><p><button type="button" id="retryRoute">重试</button></p></div>';
      const b = $("retryRoute");
      if (b) b.onclick = () => renderRoute();
    }
  }
  function renderNotFound() {
    document.title = "页面不存在 · 项宏";
    app.innerHTML = '<div class="glass strong pad"><p class="brandline">Powered by HONGUI</p><h1>页面不存在</h1><p>这个地址没有内容。可以回到首页，或看看博客与关于页。</p><p><a class="btn" href="/">回到首页</a></p></div>';
  }

  function homeEmptyCard(kw) {
    if (kw || (postsCache && postsCache.length)) return '<div class="empty"><div class="em-ic"><i class="ic ic-search" aria-hidden="true"></i></div><h2>没有找到相关文章</h2><p>' + (kw ? "没有匹配「" + escapeHtml(kw) + "」的内容，换个关键词试试。" : "这个分类下暂时还没有文章。") + '</p><a class="btn" href="/">查看全部文章</a></div>';
    return '<div class="empty"><div class="em-ic"><i class="ic ic-pen" aria-hidden="true"></i></div><h2>还没有文章</h2><p>后台发布后，这里会出现文章卡片。</p><a class="btn primary" href="/admin?tab=edit">发布文章 / 管理后台</a></div>';
  }
  function homeCardHtml(p, i) {
    return '<article class="card reveal" data-pid="' + escapeHtml(p.id) + '" style="--i:' + ((i || 0) % 9) + '"><a class="card-a" href="/post/' + escapeHtml(p.id) + '"><div class="cover">' + coverHtml(p, true) + '</div><div class="body"><div class="meta-row"><span class="catchip">' + escapeHtml(p.category) + '</span><span class="meta">' + escapeHtml(fmtDate(p.publishedAt).slice(0, 10)) + "</span></div><h2>" + escapeHtml(p.title) + "</h2><p>" + escapeHtml(p.summary || "") + '</p><div class="footrow"><span class="more">阅读全文<i class="ic ic-arrow-right" aria-hidden="true"></i></span><span class="row" style="gap:12px"><span class="stats-i"><i class="ic ic-eye" aria-hidden="true"></i>' + (p.views || 0) + '</span><span class="stats-i"><i class="ic ic-heart" aria-hidden="true"></i>' + (p.likes || 0) + "</span></span></div></div></a></article>";
  }
  function homeFilterPosts(cat, keyword) {
    const kw = (keyword || "").toLowerCase();
    return (postsCache || []).filter((p) => (!cat || p.category === cat) && (!kw || (p.title + " " + p.summary + " " + p.category).toLowerCase().includes(kw)));
  }
  function syncHomeFilterUi(cat, keyword, opts) {
    const keepScroll = !!(opts && opts.keepScroll);
    const y = keepScroll ? (window.scrollY || window.pageYOffset || 0) : 0;
    const chipsEl = $("chips");
    if (chipsEl) {
      chipsEl.querySelectorAll("[data-cat]").forEach((btn) => {
        const c = btn.getAttribute("data-cat") || "";
        btn.setAttribute("aria-pressed", ((!cat && !c) || c === cat) ? "true" : "false");
      });
    }
    const qEl = $("q");
    if (qEl && document.activeElement !== qEl && qEl.value !== (keyword || "")) qEl.value = keyword || "";
    const masonry = app.querySelector(".masonry");
    if (masonry) {
      const filtered = homeFilterPosts(cat, keyword);
      const next = filtered.map(homeCardHtml).join("") || homeEmptyCard(keyword);
      if (masonry.dataset.sig !== next.length + ":" + (cat || "") + ":" + (keyword || "") + ":" + filtered.map((p) => p.id).join(",")) {
        masonry.dataset.sig = next.length + ":" + (cat || "") + ":" + (keyword || "") + ":" + filtered.map((p) => p.id).join(",");
        const before = new Map();
        const anim = !reducedMotion() && !!masonry.animate;
        if (anim) masonry.querySelectorAll("[data-pid]").forEach((el) => before.set(el.getAttribute("data-pid"), el.getBoundingClientRect()));
        masonry.innerHTML = next;
        if (anim) {
          let k = 0;
          masonry.querySelectorAll(".card, .empty").forEach((el) => {
            el.style.animation = "none";
            const r0 = before.get(el.getAttribute("data-pid") || "");
            const r1 = el.getBoundingClientRect();
            try {
              if (r0) {
                const dx = r0.left - r1.left, dy = r0.top - r1.top;
                if (dx || dy) el.animate([{ transform: "translate(" + dx + "px," + dy + "px)" }, { transform: "none" }], { duration: 620, easing: SPRING });
              } else {
                el.animate([{ opacity: 0, transform: "translateY(16px) scale(.96)" }, { opacity: 1, transform: "none" }], { duration: 480, delay: (k++) * 40, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" });
              }
            } catch (e) { /* ignore */ }
          });
        }
      }
    }
    moveInd(chipsEl);
    if (keepScroll) {
      const restore = () => { if ((window.scrollY || 0) !== y) window.scrollTo(0, y); };
      restore();
      requestAnimationFrame(restore);
    }
  }
  function bindHomeTools() {
    const qEl = $("q");
    const chipsEl = $("chips");
    if (qEl && !qEl.dataset.bound) {
      qEl.dataset.bound = "1";
      qEl.addEventListener("input", () => {
        const params = new URLSearchParams(location.search);
        const v = qEl.value.trim();
        if (v) params.set("q", v); else params.delete("q");
        const s = params.toString();
        history.replaceState({}, "", s ? "/?" + s : "/");
        syncHomeFilterUi(params.get("cat") || "", v, { keepScroll: true });
      });
    }
    if (chipsEl && !chipsEl.dataset.bound) {
      chipsEl.dataset.bound = "1";
      chipsEl.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-cat]");
        if (!btn) return;
        e.preventDefault();
        const params = new URLSearchParams(location.search);
        const c = btn.getAttribute("data-cat") || "";
        if (c) params.set("cat", c); else params.delete("cat");
        const s = params.toString();
        history.replaceState({}, "", s ? "/?" + s : "/");
        syncHomeFilterUi(c, params.get("q") || "", { keepScroll: true });
      });
    }
  }
  async function renderHome() {
    document.title = "项宏 · 个人网站";
    const q = new URLSearchParams(location.search);
    const cat = q.get("cat") || "";
    const keyword = q.get("q") || "";
    if (!postsCache) {
      const data = await api("/api/posts");
      postsCache = data.posts || [];
    }
    const shell = $("chips") && app.querySelector(".masonry") && app.querySelector(".intro-card");
    if (shell) {
      syncHomeFilterUi(cat, keyword, { keepScroll: true });
      bindHomeTools();
      return;
    }
    const chips = ['<button type="button" data-cat="" aria-pressed="' + (cat ? "false" : "true") + '">全部文章</button>']
      .concat(CATS.map((c) => '<button type="button" data-cat="' + escapeHtml(c) + '" aria-pressed="' + (c === cat ? "true" : "false") + '">' + escapeHtml(c) + "</button>")).join("");
    const filtered = homeFilterPosts(cat, keyword);
    const cards = filtered.map(homeCardHtml).join("");
    app.innerHTML = hero() + bentoHtml() +
      '<section class="posts-sec" id="posts" aria-labelledby="postsTitle"><div class="sec-head"><div><p class="kicker">Journal · 文章</p><h2 class="sec-title" id="postsTitle">最近在写</h2></div></div>' +
      '<div class="home-tools"><div class="chips" id="chips" role="group" aria-label="文章分类">' + chips + '</div><div class="search"><i class="ic ic-search" aria-hidden="true"></i><label for="q" class="sr-only">搜索文章</label><input id="q" type="search" value="' + escapeHtml(keyword) + '" placeholder="搜索标题或摘要…" aria-label="搜索文章" autocomplete="off"></div></div>' +
      '<div class="masonry">' + (cards || homeEmptyCard(keyword)) + "</div></section>";
    const masonry = app.querySelector(".masonry");
    if (masonry) masonry.dataset.sig = (cards || homeEmptyCard(keyword)).length + ":" + cat + ":" + keyword + ":" + filtered.map((p) => p.id).join(",");
    bindHomeTools();
    moveInd($("chips"), true);
  }

  async function renderPost(id) {
    const data = await api("/api/post/" + encodeURIComponent(id));
    const p = data.post;
    document.title = p.title + " · 项宏";
    const cover = coverHtml(p, false);
    const quote = (p.summary || "").slice(0, 80);
    app.innerHTML = '<article class="article" data-pid="' + escapeHtml(p.id) + '"><header class="art-head"><a class="back-link" href="/"><i class="ic ic-arrow-left" aria-hidden="true"></i>首页</a>' +
      '<div class="art-meta-top"><span class="catchip">' + escapeHtml(p.category) + '</span><span class="meta">' + escapeHtml(fmtDate(p.publishedAt)) + "</span></div>" +
      '<h1 class="page-title art-title">' + escapeHtml(p.title) + "</h1>" + (p.summary ? '<p class="art-lede">' + escapeHtml(p.summary) + "</p>" : "") +
      '<div class="art-meta"><span><i class="ic ic-clock" aria-hidden="true"></i>约 ' + readingMinutes(p.content) + ' 分钟</span><span><i class="ic ic-eye" aria-hidden="true"></i>阅读 ' + (p.views || 0) + '</span><button type="button" class="heart" id="likeBtn" aria-label="点赞"><i class="ic ic-heart" aria-hidden="true"></i>赞 <b>' + (p.likes || 0) + '</b></button><button type="button" class="heart" id="shareBtn" aria-label="分享这篇文章"><i class="ic ic-share" aria-hidden="true"></i>分享</button></div></header>' +
      (p.cover ? '<figure class="art-cover cover">' + cover + "</figure>" : "") +
      '<nav class="toc" id="toc" aria-label="文章目录" hidden></nav>' +
      '<div class="md art-body" id="articleMd">' + renderMarkdown(p.content || "") + "</div>" +
      '<nav class="pn" aria-label="上一篇与下一篇">' +
      (data.prev ? '<a class="prev" href="/post/' + escapeHtml(data.prev.id) + '"><small><i class="ic ic-arrow-left" aria-hidden="true"></i>上一篇</small><b>' + escapeHtml(data.prev.title) + "</b></a>" : "<span></span>") +
      (data.next ? '<a class="next" href="/post/' + escapeHtml(data.next.id) + '"><small>下一篇<i class="ic ic-arrow-right" aria-hidden="true"></i></small><b>' + escapeHtml(data.next.title) + "</b></a>" : "") +
      "</nav></article>";
    $("likeBtn").onclick = async () => {
      try {
        const res = await api("/api/like/" + encodeURIComponent(id), { method: "POST", body: "{}" });
        $("likeBtn").querySelector("b").textContent = res.likes;
        $("likeBtn").classList.add("pop");
        if (res.duplicate) toast("你已经赞过这篇了");
      } catch (e) { toast(e.message); }
    };
    $("shareBtn").onclick = async () => {
      const url = location.origin + "/post/" + encodeURIComponent(p.id);
      if (navigator.share && matchMedia("(pointer: coarse)").matches) {
        try { await navigator.share({ title: p.title, text: p.summary || p.title, url }); return; } catch (e) { if (e && e.name === "AbortError") return; }
      }
      try { await navigator.clipboard.writeText(url); toast("链接已复制"); } catch { toast(url); }
    };
    buildToc();
  }

  function buildToc() {
    const md = $("articleMd"), toc = $("toc");
    if (!md || !toc) return;
    const hs = [...md.querySelectorAll("h2, h3")];
    if (hs.length < 3) return;
    const used = {};
    const items = hs.map((h, i) => {
      let id = "s-" + (i + 1);
      while (used[id]) id += "x";
      used[id] = 1;
      h.id = id;
      return '<a href="#' + id + '" data-toc="' + id + '" class="lv' + h.tagName.slice(1) + '">' + escapeHtml(h.textContent || "") + "</a>";
    });
    toc.innerHTML = '<details open><summary><i class="ic ic-toc" aria-hidden="true"></i>目录</summary><div class="toc-l">' + items.join("") + "</div></details>";
    toc.hidden = false;
    toc.addEventListener("click", (e) => {
      const a = e.target.closest("[data-toc]");
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      const el = $(a.getAttribute("data-toc"));
      if (el) el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
    }, true);
  }
  function dataUrlToBlob(dataUrl) {
    const parts = String(dataUrl).split(",");
    const mime = ((parts[0].match(/:(.*?);/) || [])[1]) || "image/png";
    const bin = atob(parts[1] || "");
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }

  function creditsHtml() {
    const L = { "CC0": "https://creativecommons.org/publicdomain/zero/1.0/deed.zh-hans", "CC BY-SA 4.0": "https://creativecommons.org/licenses/by-sa/4.0/deed.zh-hans", "CC BY-SA 3.0": "https://creativecommons.org/licenses/by-sa/3.0/deed.zh-hans", "CC BY 2.0": "https://creativecommons.org/licenses/by/2.0/deed.zh-hans" };
    const rows = [
      ["千岛湖", "Pauloleong2002", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Qiandao_Lake_(near_Hangzhou)_2.jpg"],
      ["九寨长海", "Suicasmo", "CC0", "https://commons.wikimedia.org/wiki/File:Long_Lake_(Jiuzhaigou)_20260511-1.jpg"],
      ["漓江", "chensiyuan", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:1_li_jiang_guilin_yangshuo_2011.jpg"],
      ["莫干山竹林", "Walter Grassroot", "CC BY-SA 4.0", "https://commons.wikimedia.org/wiki/File:Mount_Mogan_bamboo_forest.jpg"],
      ["海岸公路（Bixby Creek）", "Diliff", "CC BY-SA 3.0", "https://commons.wikimedia.org/wiki/File:Bixby_Creek_Bridge,_California,_USA_-_May_2013.jpg"],
      ["黄山", "Chi King", "CC BY 2.0", "https://commons.wikimedia.org/wiki/File:Huangshan,_China_(YELLOW_MOUNTAIN-LANDSCAPE)_XII_(1071076723).jpg"]
    ];
    return '<section class="credits reveal" id="credits" style="--i:3"><h2>图片来源</h2><p class="meta">背景风景照片来自 Wikimedia Commons，已缩放并转为 WebP，按原许可使用。文章封面为 AI 生成的示意图。</p><ul>' +
      rows.map((r) => '<li><b>' + r[0] + '</b><span>' + escapeHtml(r[1]) + ' · <a href="' + L[r[2]] + '" target="_blank" rel="noopener noreferrer license">' + r[2] + '</a> · <a href="' + r[3] + '" target="_blank" rel="noopener noreferrer">原图</a></span></li>').join("") + "</ul></section>";
  }
  async function renderAbout() {
    document.title = "关于 · 项宏";
    const data = await api("/api/about");
    app.innerHTML = '<section class="about"><div class="about-hero reveal"><div class="avatar" aria-hidden="true">项</div><div><p class="brandline">Powered by HONGUI</p><h1 class="page-title">关于项宏</h1><p class="lede" style="margin-top:10px">宁波鄞州 · 高中生开发者</p></div></div><div class="md about-md reveal" style="--i:1">' + renderMarkdown(data.content || "") + '</div><div class="contact reveal" style="--i:2"><a class="pill" href="https://t.me/your_telegram" rel="noopener noreferrer" target="_blank"><i class="ic ic-send" aria-hidden="true"></i>Telegram @your_telegram</a><span class="pill"><i class="ic ic-msg" aria-hidden="true"></i>微信 your_wechat</span></div>' + creditsHtml() + '<p class="muted">开发者：项宏 · Telegram @your_telegram · 微信 your_wechat</p></section>';
    if (location.hash === "#credits") { const c = $("credits"); if (c) setTimeout(() => c.scrollIntoView({ block: "start" }), 60); }
  }
  async function renderValues() {
    document.title = "价值观 · 项宏";
    const data = await api("/api/values");
    const cards = (data.values || []).map((v, i) => '<article class="vcard reveal" style="--i:' + i + '"><span class="vnum">' + String(i + 1).padStart(2, "0") + '</span><p class="meta">其 ' + (i + 1) + "</p><h2>" + escapeHtml(v.title) + "</h2><p>" + escapeHtml(v.text) + "</p></article>").join("");
    app.innerHTML = '<section class="page-hero reveal"><p class="brandline">Powered by HONGUI</p><h1 class="page-title">价值观</h1><p class="lede">几件想长期记住的事。开发者：项宏</p></section><div class="values-grid">' + cards + "</div>";
  }

  const DRV = { view: "list", sort: "name", q: "", data: null, uploads: [] };
  try { DRV.view = localStorage.getItem("hongui_drive_view") === "grid" ? "grid" : "list"; DRV.sort = localStorage.getItem("hongui_drive_sort") || "name"; } catch { /* ignore */ }
  function fileKind(name, type) {
    const n = String(name || "").toLowerCase(), t = String(type || "");
    if (/\.(png|jpe?g|gif|webp|avif|bmp|heic|svg)$/.test(n) || t.startsWith("image/")) return "image";
    if (/\.(mp4|webm|mov|m4v|mkv|ogv)$/.test(n) || t.startsWith("video/")) return "video";
    if (/\.(mp3|wav|m4a|flac|aac|ogg|opus)$/.test(n) || t.startsWith("audio/")) return "audio";
    if (/\.pdf$/.test(n)) return "pdf";
    if (/\.(zip|rar|7z|tar|gz|tgz|bz2|xz)$/.test(n)) return "archive";
    if (/\.(txt|md|json|js|mjs|ts|css|csv|log|xml|ya?ml|py|html?|sh|ini|toml|c|cpp|h|java|go|rs|sql)$/.test(n) || t.startsWith("text/")) return "text";
    return "file";
  }
  const KIND_IC = { folder: "folder", image: "image", video: "film", audio: "music", pdf: "file-text", archive: "archive", text: "file-text", file: "file" };
  function fileUrl(key, dl) { return "/api/drive/file?key=" + encodeURIComponent(key) + (dl ? "&download=1" : ""); }
  function relOf(folderKey) { return String(folderKey || "").replace(/^drive\//, "").replace(/\/$/, ""); }
  function breadcrumb(prefix) {
    const parts = prefix ? prefix.split("/").filter(Boolean) : [];
    let html = '<a href="#" data-dir="" class="bc"><i class="ic ic-cloud" aria-hidden="true"></i>网盘</a>';
    let acc = "";
    parts.forEach((p, i) => { acc = acc ? acc + "/" + p : p; html += '<span class="sep" aria-hidden="true">/</span>' + (i === parts.length - 1 ? '<span class="bc cur" aria-current="page">' + escapeHtml(p) + "</span>" : '<a href="#" class="bc" data-dir="' + escapeHtml(acc) + '">' + escapeHtml(p) + "</a>"); });
    return html;
  }
  function sortFiles(files, mode) {
    const arr = files.slice();
    const byName = (a, b) => String(a.name).localeCompare(String(b.name), "zh", { numeric: true });
    if (mode === "name-desc") arr.sort((a, b) => byName(b, a));
    else if (mode === "size") arr.sort((a, b) => (b.size || 0) - (a.size || 0));
    else if (mode === "time") arr.sort((a, b) => String(b.uploaded || "").localeCompare(String(a.uploaded || "")));
    else arr.sort(byName);
    return arr;
  }
  function askText(title, value, okText) {
    return new Promise((resolve) => {
      openModal('<form class="dlg" id="dlgF"><h2>' + escapeHtml(title) + '</h2><input id="dlgI" autocomplete="off" maxlength="200" value="' + escapeHtml(value || "") + '"><div class="dlg-act"><button type="button" id="dlgC">取消</button><button type="submit" class="primary">' + escapeHtml(okText || "确定") + "</button></div></form>");
      const f = $("dlgF"), i = $("dlgI");
      setTimeout(() => { i.focus(); const dot = i.value.lastIndexOf("."); i.setSelectionRange(0, dot > 0 ? dot : i.value.length); }, 30);
      f.onsubmit = (e) => { e.preventDefault(); const v = i.value.trim(); closeModal(); resolve(v || null); };
      $("dlgC").onclick = () => { closeModal(); resolve(null); };
      watchModalClose(() => resolve(null));
    });
  }
  function askConfirm(title, body, okText, danger) {
    return new Promise((resolve) => {
      openModal('<div class="dlg"><h2>' + escapeHtml(title) + '</h2><p class="meta">' + escapeHtml(body || "") + '</p><div class="dlg-act"><button type="button" id="dlgC">取消</button><button type="button" class="primary' + (danger ? " danger" : "") + '" id="dlgO">' + escapeHtml(okText || "确定") + "</button></div></div>");
      setTimeout(() => { const o = $("dlgO"); if (o) o.focus(); }, 30);
      $("dlgO").onclick = () => { closeModal(); resolve(true); };
      $("dlgC").onclick = () => { closeModal(); resolve(false); };
      watchModalClose(() => resolve(false));
    });
  }
  function watchModalClose(cb) {
    const m = $("modal");
    const ob = new MutationObserver(() => { if (m.hidden) { ob.disconnect(); cb(); } });
    ob.observe(m, { attributes: true, attributeFilter: ["hidden"] });
  }
  async function renderDrive() {
    document.title = "网盘 · 项宏";
    if (!me) { navigate("/admin?next=/drive"); return; }
    if (!app.querySelector(".drv")) {
      app.innerHTML = '<section class="drv" id="drv">' +
        '<header class="drv-head"><div><p class="kicker">Drive · 私人网盘</p><h1 class="page-title">网盘</h1></div>' +
        '<div class="drv-usage" id="drvUsage"><div class="u-bar"><i></i></div><span>—</span></div></header>' +
        '<div class="drv-tools glass strong">' +
          '<div class="drv-crumb" id="drvCrumb"></div>' +
          '<div class="drv-tr">' +
            '<div class="search drv-search"><i class="ic ic-search" aria-hidden="true"></i><input id="driveQ" type="search" placeholder="搜索全部文件" aria-label="搜索文件" autocomplete="off"></div>' +
            '<select id="driveSort" aria-label="排序"><option value="name">名称 A→Z</option><option value="name-desc">名称 Z→A</option><option value="time">最近上传</option><option value="size">文件大小</option></select>' +
            '<div class="seg" role="group" aria-label="视图"><button type="button" data-view="list" aria-label="列表视图" title="列表"><i class="ic ic-list" aria-hidden="true"></i></button><button type="button" data-view="grid" aria-label="网格视图" title="网格"><i class="ic ic-grid" aria-hidden="true"></i></button></div>' +
            '<button type="button" id="mkdirBtn" class="ghost"><i class="ic ic-folder-plus" aria-hidden="true"></i><span>新建文件夹</span></button>' +
            '<button type="button" id="upBtn" class="primary"><i class="ic ic-upload" aria-hidden="true"></i><span>上传</span></button><input id="filePick" type="file" multiple hidden>' +
          "</div></div>" +
        '<div class="drv-sel glass strong" id="drvSel" hidden><span id="selN"></span><div class="sel-act"><button type="button" data-bulk="dl"><i class="ic ic-download" aria-hidden="true"></i><span>下载</span></button><button type="button" data-bulk="mv"><i class="ic ic-move" aria-hidden="true"></i><span>移动</span></button><button type="button" data-bulk="rm" class="danger-t"><i class="ic ic-trash" aria-hidden="true"></i><span>删除</span></button><button type="button" data-bulk="x" aria-label="取消选择"><i class="ic ic-x" aria-hidden="true"></i></button></div></div>' +
        '<div class="drv-body glass strong" id="drvBody" aria-live="polite"></div>' +
        '<div class="drv-drop" id="drvDrop" hidden><div><i class="ic ic-upload" aria-hidden="true"></i><b>松开即可上传</b><span>上传到当前文件夹</span></div></div>' +
        '<p class="meta drv-foot">单文件上限 2GB；约 95MB 以上自动分片上传，失败分片自动重试。快捷键：/ 搜索 · Esc 取消选择。<button type="button" class="linkish" id="revokeAll">撤销全部分享链接</button></p>' +
        "</section>";
      bindDrive();
    }
    syncDriveTools();
    await loadDrive();
  }
  function syncDriveTools() {
    $("driveSort").value = DRV.sort;
    document.querySelectorAll("[data-view]").forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-view") === DRV.view ? "true" : "false"));
    $("driveQ").value = DRV.q;
  }
  async function loadDrive() {
    const body = $("drvBody"); if (!body) return;
    body.classList.add("busy");
    try {
      DRV.data = DRV.q ? await api("/api/drive/search?q=" + encodeURIComponent(DRV.q)) : await api("/api/drive/list?prefix=" + encodeURIComponent(drivePath));
    } catch (e) { body.classList.remove("busy"); body.innerHTML = '<div class="empty"><h2>加载失败</h2><p>' + escapeHtml(e.message) + '</p><button type="button" id="drvRetry">重试</button></div>'; $("drvRetry").onclick = loadDrive; return; }
    body.classList.remove("busy");
    paintDrive();
  }
  function driveItems() {
    const d = DRV.data || {};
    const folders = DRV.q ? [] : (d.folders || []).map((f) => ({ key: f.key, name: f.name, folder: true })).sort((a, b) => a.name.localeCompare(b.name, "zh", { numeric: true }));
    return folders.concat(sortFiles(d.files || [], DRV.sort));
  }
  function paintDrive() {
    const d = DRV.data || {};
    const u = d.usage || { bytes: 0, limit: 10 * 1024 ** 3 };
    const pctU = Math.min(100, (u.bytes || 0) / (u.limit || 1) * 100);
    const ub = $("drvUsage");
    if (ub) { ub.querySelector("i").style.width = Math.max(1, pctU) + "%"; ub.classList.toggle("warn", !!u.warn); ub.querySelector("span").textContent = "已用 " + fmtBytes(u.bytes || 0) + " / " + fmtBytes(u.limit || 0) + " · " + (u.count || 0) + " 个对象"; }
    $("drvCrumb").innerHTML = DRV.q ? '<span class="bc cur">搜索「' + escapeHtml(DRV.q) + '」 · ' + (d.files || []).length + ' 个结果</span><a href="#" class="bc" data-dir="' + escapeHtml(drivePath) + '">清除</a>' : breadcrumb(drivePath);
    const items = driveItems();
    driveSelected = driveSelected.filter((k) => items.some((x) => x.key === k));
    const body = $("drvBody");
    if (!items.length) {
      body.innerHTML = '<div class="drv-empty"><span class="em-ic"><i class="ic ic-' + (DRV.q ? "search" : "folder") + '" aria-hidden="true"></i></span><h2>' + (DRV.q ? "没有匹配的文件" : "这里还是空的") + "</h2><p>" + (DRV.q ? "换个关键词试试。" : "把文件拖到这里，或点击「上传」。") + "</p></div>";
      syncSel(); return;
    }
    const chk = (it) => '<label class="ck" title="选择"><input type="checkbox" data-key="' + escapeHtml(it.key) + '"' + (driveSelected.includes(it.key) ? " checked" : "") + ' aria-label="选择 ' + escapeHtml(it.name) + '"><i aria-hidden="true"></i></label>';
    const kindOf = (it) => it.folder ? "folder" : fileKind(it.name, it.contentType);
    const more = (it) => '<button type="button" class="icon-btn more" data-menu="' + escapeHtml(it.key) + '" aria-label="更多操作：' + escapeHtml(it.name) + '"><i class="ic ic-dots" aria-hidden="true"></i></button>';
    const sub = (it) => it.folder ? "文件夹" : fmtBytes(it.size) + (it.uploaded ? " · " + fmtDate(it.uploaded).slice(0, 10) : "");
    if (DRV.view === "grid") {
      body.innerHTML = '<div class="drv-grid">' + items.map((it, i) => {
        const k = kindOf(it);
        const th = k === "image" && it.size < 15 * 1024 * 1024 ? '<img src="' + escapeHtml(fileUrl(it.key)) + '" alt="" loading="lazy" decoding="async">' : '<i class="ic ic-' + KIND_IC[k] + '" aria-hidden="true"></i>';
        return '<div class="gi' + (driveSelected.includes(it.key) ? " sel" : "") + '" data-item="' + escapeHtml(it.key) + '" data-k="' + k + '" style="--i:' + (i % 12) + '">' + chk(it) + more(it) + '<button type="button" class="gi-open" data-open-item="' + escapeHtml(it.key) + '"><span class="gi-th k-' + k + '">' + th + '</span><span class="gi-n">' + escapeHtml(it.name) + '</span><span class="gi-s">' + sub(it) + "</span></button></div>";
      }).join("") + "</div>";
    } else {
      body.innerHTML = '<div class="drv-list" role="table" aria-label="文件列表"><div class="dl-h" role="row"><label class="ck" title="全选"><input type="checkbox" id="selAll" aria-label="全选"><i aria-hidden="true"></i></label><span role="columnheader">名称</span><span role="columnheader" class="c-sz">大小</span><span role="columnheader" class="c-t">上传时间</span><span></span></div>' +
        items.map((it, i) => {
          const k = kindOf(it);
          return '<div class="dl-r' + (driveSelected.includes(it.key) ? " sel" : "") + '" role="row" data-item="' + escapeHtml(it.key) + '" data-k="' + k + '" style="--i:' + (i % 16) + '">' + chk(it) +
            '<button type="button" class="dl-n" data-open-item="' + escapeHtml(it.key) + '"><span class="fi k-' + k + '"><i class="ic ic-' + KIND_IC[k] + '" aria-hidden="true"></i></span><span class="nm"><b>' + escapeHtml(it.name) + '</b><small>' + (DRV.q && !it.folder ? escapeHtml(relOf(it.key.split("/").slice(0, -1).join("/") + "/") || "根目录") : sub(it)) + "</small></span></button>" +
            '<span class="c-sz">' + (it.folder ? "—" : fmtBytes(it.size)) + '</span><span class="c-t">' + (it.uploaded ? escapeHtml(fmtDate(it.uploaded)) : "—") + "</span>" + more(it) + "</div>";
        }).join("") + "</div>";
    }
    syncSel();
  }
  function syncSel() {
    const bar = $("drvSel"); if (!bar) return;
    const n = driveSelected.length;
    bar.hidden = !n;
    $("selN").textContent = "已选 " + n + " 项";
    const all = $("selAll");
    if (all) { const items = driveItems(); all.checked = n > 0 && n === items.length; all.indeterminate = n > 0 && n < items.length; }
    document.querySelectorAll("#drvBody [data-item]").forEach((el) => el.classList.toggle("sel", driveSelected.includes(el.getAttribute("data-item"))));
  }
  function itemOf(key) { return driveItems().find((x) => x.key === key) || null; }
  function openItem(it) {
    if (!it) return;
    if (it.folder) { drivePath = relOf(it.key); DRV.q = ""; driveSelected = []; syncDriveTools(); loadDrive(); return; }
    previewFile(it);
  }
  function itemMenu(btn, it) {
    closeMenus();
    const m = document.createElement("div");
    m.className = "pop-menu"; m.setAttribute("role", "menu");
    const acts = it.folder ? [["open", "folder", "打开"], ["ren", "edit", "重命名"], ["mv", "move", "移动到…"], ["rm", "trash", "删除"]]
      : [["open", "eye", "预览"], ["dl", "download", "下载"], ["share", "link", "分享链接"], ["ren", "edit", "重命名"], ["mv", "move", "移动到…"], ["rm", "trash", "删除"]];
    m.innerHTML = acts.map((a) => '<button type="button" role="menuitem" data-act="' + a[0] + '"' + (a[0] === "rm" ? ' class="danger-t"' : "") + '><i class="ic ic-' + a[1] + '" aria-hidden="true"></i>' + a[2] + "</button>").join("");
    document.body.appendChild(m);
    const r = btn.getBoundingClientRect();
    const mw = 196, mh = acts.length * 44 + 12;
    m.style.left = Math.max(8, Math.min(window.innerWidth - mw - 8, r.right - mw)) + "px";
    m.style.top = (r.bottom + mh + 8 > window.innerHeight ? Math.max(8, r.top - mh - 6) : r.bottom + 6) + "px";
    m.addEventListener("click", (e) => { const b = e.target.closest("[data-act]"); if (!b) return; closeMenus(); itemAction(b.getAttribute("data-act"), [it]); });
    const f = m.querySelector("button"); if (f) f.focus();
  }
  function closeMenus() { document.querySelectorAll(".pop-menu").forEach((x) => x.remove()); }
  async function itemAction(act, list) {
    const keys = list.map((x) => x.key);
    try {
      if (act === "open") return openItem(list[0]);
      if (act === "dl") return downloadItems(list.filter((x) => !x.folder));
      if (act === "ren") {
        const it = list[0];
        const name = await askText("重命名", it.name, "重命名");
        if (!name || name === it.name) return;
        await api("/api/drive/rename", { method: "POST", body: JSON.stringify({ key: it.key, name }) });
        toast("已重命名"); return loadDrive();
      }
      if (act === "rm") {
        const nf = list.filter((x) => x.folder).length;
        const ok = await askConfirm("删除 " + (list.length === 1 ? "「" + list[0].name + "」" : list.length + " 个项目") + "？", (nf ? "文件夹及其中的所有内容都会被删除。" : "") + "删除后无法恢复。", "删除", true);
        if (!ok) return;
        await api("/api/drive/delete", { method: "POST", body: JSON.stringify({ keys }) });
        driveSelected = driveSelected.filter((k) => !keys.includes(k));
        toast("已删除"); return loadDrive();
      }
      if (act === "mv") {
        const dest = await pickFolder(keys);
        if (dest == null) return;
        await api("/api/drive/move", { method: "POST", body: JSON.stringify({ keys, dest: dest ? "drive/" + dest + "/" : "drive/" }) });
        driveSelected = []; toast("已移动"); return loadDrive();
      }
      if (act === "share") return shareItem(list[0]);
    } catch (e) { toast(e.message || "操作失败"); }
  }
  async function pickFolder(moving) {
    let cur = drivePath;
    return new Promise((resolve) => {
      let settled = false;
      const done = (v) => { if (settled) return; settled = true; closeModal(); resolve(v); };
      const draw = async () => {
        let d;
        try { d = await api("/api/drive/list?prefix=" + encodeURIComponent(cur)); } catch (e) { toast(e.message); return; }
        const folders = (d.folders || []).filter((f) => !moving.includes(f.key));
        const crumb = cur ? cur.split("/") : [];
        openModal('<div class="dlg pick"><h2>移动到</h2><div class="pk-crumb"><a href="#" data-pk="">网盘</a>' + crumb.map((p, i) => '<span>/</span><a href="#" data-pk="' + escapeHtml(crumb.slice(0, i + 1).join("/")) + '">' + escapeHtml(p) + "</a>").join("") + '</div><div class="pk-list">' +
          (folders.length ? folders.map((f) => '<button type="button" data-pk="' + escapeHtml(relOf(f.key)) + '"><i class="ic ic-folder" aria-hidden="true"></i>' + escapeHtml(f.name) + "</button>").join("") : '<p class="meta">没有子文件夹</p>') +
          '</div><div class="dlg-act"><button type="button" id="pkC">取消</button><button type="button" class="primary" id="pkO">移动到「' + escapeHtml(cur || "网盘根目录") + "」</button></div></div>");
        const panel = document.querySelector("#modal .panel");
        panel.addEventListener("click", (e) => { const a = e.target.closest("[data-pk]"); if (!a) return; e.preventDefault(); cur = a.getAttribute("data-pk"); draw(); });
        $("pkC").onclick = () => done(null);
        $("pkO").onclick = () => done(cur);
      };
      draw().then(() => watchModalClose(() => { if (!settled && $("modal").hidden) { settled = true; resolve(null); } }));
    });
  }
  async function shareItem(it) {
    openModal('<div class="dlg"><h2>分享「' + escapeHtml(it.name) + '」</h2><p class="meta">任何拿到链接的人都能下载这个文件（访问前需通过人机验证），到期自动失效。</p><div class="seg wide" role="group" aria-label="有效期"><button type="button" data-h="1">1 小时</button><button type="button" data-h="24" aria-pressed="true">1 天</button><button type="button" data-h="72">3 天</button><button type="button" data-h="168">7 天</button></div><div class="share-out" id="shOut"><input id="shUrl" readonly placeholder="点击「生成链接」"><button type="button" class="primary" id="shGo"><i class="ic ic-link" aria-hidden="true"></i>生成链接</button></div><p class="meta" id="shExp"></p></div>');
    let hours = 24;
    document.querySelectorAll("[data-h]").forEach((b) => b.onclick = () => { hours = Number(b.getAttribute("data-h")); document.querySelectorAll("[data-h]").forEach((x) => x.setAttribute("aria-pressed", x === b ? "true" : "false")); });
    $("shGo").onclick = async () => {
      try {
        const r = await api("/api/drive/share", { method: "POST", body: JSON.stringify({ key: it.key, hours }) });
        $("shUrl").value = r.url;
        $("shExp").textContent = "有效期至 " + fmtDate(r.expires);
        try { await navigator.clipboard.writeText(r.url); toast("链接已复制"); } catch { $("shUrl").select(); }
        $("shGo").innerHTML = '<i class="ic ic-copy" aria-hidden="true"></i>复制';
        $("shGo").onclick = async () => { try { await navigator.clipboard.writeText(r.url); toast("链接已复制"); } catch { $("shUrl").select(); } };
      } catch (e) { toast(e.message); }
    };
  }
  async function downloadItems(files) {
    if (!files.length) return toast("请选择文件（文件夹不能直接下载）");
    if (files.length === 1) { const a = document.createElement("a"); a.href = fileUrl(files[0].key, true); a.download = files[0].name; document.body.appendChild(a); a.click(); a.remove(); return; }
    const total = files.reduce((s, f) => s + (f.size || 0), 0);
    if (total > 200 * 1024 * 1024) {
      toast("文件较大，将逐个下载");
      files.forEach((f, i) => setTimeout(() => { const a = document.createElement("a"); a.href = fileUrl(f.key, true); a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); }, i * 350));
      return;
    }
    toast("正在打包 " + files.length + " 个文件…");
    const packed = [];
    for (const f of files) {
      const res = await fetch(fileUrl(f.key, true));
      if (!res.ok) { toast(f.name + " 下载失败"); continue; }
      packed.push({ name: f.name, data: new Uint8Array(await res.arrayBuffer()) });
    }
    saveBlob(buildZip(packed), "hongui-drive-" + new Date().toISOString().slice(0, 10) + ".zip");
  }
  function bindDrive() {
    const root = $("drv");
    $("driveSort").onchange = () => { DRV.sort = $("driveSort").value; try { localStorage.setItem("hongui_drive_sort", DRV.sort); } catch { /* ignore */ } paintDrive(); };
    let qt = 0;
    $("driveQ").addEventListener("input", () => { clearTimeout(qt); qt = setTimeout(() => { DRV.q = $("driveQ").value.trim(); driveSelected = []; loadDrive(); }, 280); });
    root.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => { DRV.view = b.getAttribute("data-view"); try { localStorage.setItem("hongui_drive_view", DRV.view); } catch { /* ignore */ } syncDriveTools(); paintDrive(); });
    $("mkdirBtn").onclick = async () => {
      const name = await askText("新建文件夹", "", "创建");
      if (!name) return;
      try { await api("/api/drive/mkdir", { method: "POST", body: JSON.stringify({ prefix: drivePath, name }) }); toast("已创建"); loadDrive(); } catch (e) { toast(e.message); }
    };
    $("upBtn").onclick = () => $("filePick").click();
    $("filePick").onchange = () => { uploadFiles([...$("filePick").files]); $("filePick").value = ""; };
    $("revokeAll").onclick = async () => {
      if (!await askConfirm("撤销全部分享链接？", "之前生成的所有分享链接都会立即失效。", "全部撤销", true)) return;
      try { await api("/api/drive/share/revoke-all", { method: "POST", body: "{}" }); toast("已撤销全部分享链接"); } catch (e) { toast(e.message); }
    };
    root.addEventListener("click", (e) => {
      const dir = e.target.closest("[data-dir]");
      if (dir) { e.preventDefault(); drivePath = dir.getAttribute("data-dir"); DRV.q = ""; driveSelected = []; syncDriveTools(); loadDrive(); return; }
      const mb = e.target.closest("[data-menu]");
      if (mb) { e.stopPropagation(); const it = itemOf(mb.getAttribute("data-menu")); if (it) itemMenu(mb, it); return; }
      const op = e.target.closest("[data-open-item]");
      if (op) { if (driveSelected.length && !e.target.closest(".ck")) { toggleSel(op.getAttribute("data-open-item")); return; } openItem(itemOf(op.getAttribute("data-open-item"))); return; }
      const bk = e.target.closest("[data-bulk]");
      if (bk) {
        const a = bk.getAttribute("data-bulk");
        if (a === "x") { driveSelected = []; paintDrive(); return; }
        const list = driveSelected.map(itemOf).filter(Boolean);
        itemAction(a === "dl" ? "dl" : a, list);
      }
    });
    root.addEventListener("change", (e) => {
      if (e.target.id === "selAll") { driveSelected = e.target.checked ? driveItems().map((x) => x.key) : []; paintDrive(); return; }
      const box = e.target.closest("[data-key]");
      if (!box) return;
      const key = box.getAttribute("data-key");
      if (box.checked) { if (!driveSelected.includes(key)) driveSelected.push(key); } else driveSelected = driveSelected.filter((k) => k !== key);
      syncSel();
    });
    let depth = 0;
    const drop = $("drvDrop");
    const hasFiles = (e) => e.dataTransfer && [...(e.dataTransfer.types || [])].includes("Files");
    root.addEventListener("dragenter", (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth++; drop.hidden = false; });
    root.addEventListener("dragover", (e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; });
    root.addEventListener("dragleave", () => { depth = Math.max(0, depth - 1); if (!depth) drop.hidden = true; });
    root.addEventListener("drop", (e) => { if (!hasFiles(e)) return; e.preventDefault(); depth = 0; drop.hidden = true; uploadFiles([...e.dataTransfer.files]); });
    if (bindDrive.doc) return;
    bindDrive.doc = 1;
    document.addEventListener("click", (e) => { if (!e.target.closest(".pop-menu") && !e.target.closest("[data-menu]")) closeMenus(); });
    document.addEventListener("keydown", (e) => {
      if (!$("drv")) return;
      if (e.key === "Escape") { closeMenus(); if (driveSelected.length && $("modal").hidden) { driveSelected = []; paintDrive(); } }
    });
    window.addEventListener("scroll", closeMenus, { passive: true });
  }
  function toggleSel(key) {
    if (driveSelected.includes(key)) driveSelected = driveSelected.filter((k) => k !== key); else driveSelected.push(key);
    const cb = document.querySelector('#drvBody input[data-key="' + (window.CSS && CSS.escape ? CSS.escape(key) : key) + '"]');
    if (cb) cb.checked = driveSelected.includes(key);
    syncSel();
  }
  function upPanel() {
    let p = $("upPanel");
    if (!p) {
      p = document.createElement("div"); p.id = "upPanel"; p.className = "up-panel glass strong"; p.setAttribute("role", "region"); p.setAttribute("aria-label", "上传队列");
      p.innerHTML = '<div class="up-h"><b id="upTitle">上传</b><button type="button" class="icon-btn" id="upClose" aria-label="关闭上传面板"><i class="ic ic-x" aria-hidden="true"></i></button></div><div class="up-list" id="upList"></div>';
      document.body.appendChild(p);
      $("upClose").onclick = () => { if (DRV.uploads.some((u) => u.state === "up")) { toast("还有文件在上传"); return; } p.remove(); DRV.uploads = []; };
    }
    return p;
  }
  function upRow(u) {
    const el = document.createElement("div"); el.className = "up-r";
    el.innerHTML = '<span class="fi k-' + fileKind(u.file.name, u.file.type) + '"><i class="ic ic-' + KIND_IC[fileKind(u.file.name, u.file.type)] + '" aria-hidden="true"></i></span><div class="up-m"><b></b><small></small><div class="u-bar"><i></i></div></div><button type="button" class="icon-btn" aria-label="取消上传"><i class="ic ic-x" aria-hidden="true"></i></button>';
    el.querySelector("b").textContent = u.file.name;
    el.querySelector("button").onclick = () => { if (u.state === "up" || u.state === "wait") { u.cancel = true; if (u.xhr) try { u.xhr.abort(); } catch { /* ignore */ } } else el.remove(); };
    u.el = el;
    return el;
  }
  function upPaint(u, text, frac) {
    if (!u.el) return;
    u.el.querySelector("small").textContent = text;
    u.el.querySelector(".u-bar i").style.width = Math.round((frac || 0) * 100) + "%";
    u.el.classList.toggle("done", u.state === "done");
    u.el.classList.toggle("err", u.state === "err");
    const t = $("upTitle");
    if (t) { const left = DRV.uploads.filter((x) => x.state === "up" || x.state === "wait").length; t.textContent = left ? "正在上传 · 剩余 " + left + " 个" : "上传完成"; }
  }
  async function uploadFiles(list) {
    if (!list.length) return;
    const p = upPanel();
    const dir = drivePath;
    const batch = list.map((file) => ({ file, state: "wait", dir }));
    batch.forEach((u) => { DRV.uploads.push(u); p.querySelector("#upList").appendChild(upRow(u)); upPaint(u, fmtBytes(u.file.size) + " · 等待中", 0); });
    let idx = 0;
    const worker = async () => {
      while (idx < batch.length) {
        const u = batch[idx++];
        if (u.cancel) { u.state = "err"; upPaint(u, "已取消", 0); continue; }
        u.state = "up";
        const t0 = Date.now();
        try {
          await uploadOne(u, (loaded, total) => {
            const sec = Math.max(0.2, (Date.now() - t0) / 1000);
            upPaint(u, fmtBytes(loaded) + " / " + fmtBytes(total) + " · " + fmtBytes(loaded / sec) + "/s · 剩余 " + etaText(loaded, total, t0), total ? loaded / total : 0);
          });
          u.state = "done"; upPaint(u, fmtBytes(u.file.size) + " · 已完成", 1);
        } catch (e) {
          u.state = "err"; upPaint(u, u.cancel ? "已取消" : (e.message || "上传失败"), 0);
        }
      }
    };
    await Promise.all([worker(), worker()]);
    if ($("drv") && drivePath === dir) loadDrive();
    const bad = batch.filter((u) => u.state === "err" && !u.cancel).length;
    toast(bad ? bad + " 个文件上传失败" : "上传完成");
  }
  async function uploadOne(u, onProgress) {
    const file = u.file, dir = u.dir;
    if (file.size > 2 * 1024 * 1024 * 1024) throw new Error("超过 2GB 上限");
    const send = (method, url, body, headers, prog) => new Promise((resolve, reject) => {
      const x = new XMLHttpRequest(); u.xhr = x;
      x.open(method, url);
      Object.keys(headers || {}).forEach((k) => x.setRequestHeader(k, headers[k]));
      if (prog) x.upload.onprogress = (e) => { if (e.lengthComputable) prog(e.loaded); };
      x.onload = () => { let j = {}; try { j = JSON.parse(x.responseText || "{}"); } catch { j = {}; } if (x.status >= 200 && x.status < 300 && j.ok !== false) resolve(j); else { const er = new Error((j && j.error) || ("上传失败 " + x.status)); er.status = x.status; reject(er); } };
      x.onerror = () => reject(new Error("网络错误"));
      x.onabort = () => reject(new Error("已取消"));
      x.send(body);
    });
    if (file.size > 95 * 1024 * 1024) {
      const created = await api("/api/drive/multipart/create", { method: "POST", body: JSON.stringify({ dir, name: file.name, size: file.size, type: file.type || "application/octet-stream", overwrite: true }) });
      const partSize = 10 * 1024 * 1024, parts = [];
      try {
        for (let start = 0, n = 1; start < file.size; start += partSize, n++) {
          if (u.cancel) throw new Error("已取消");
          const end = Math.min(file.size, start + partSize);
          let res = null, attempt = 0;
          while (!res) {
            try {
              res = await send("PUT", "/api/drive/multipart/part?key=" + encodeURIComponent(created.key) + "&uploadId=" + encodeURIComponent(created.uploadId) + "&partNumber=" + n + (end >= file.size ? "&last=1" : ""), file.slice(start, end), { "Content-Type": "application/octet-stream" }, (l) => onProgress(start + l, file.size));
            } catch (e) {
              if (u.cancel || ++attempt >= 4) throw e;
              await new Promise((r) => setTimeout(r, 800 * attempt));
            }
          }
          parts.push({ partNumber: n, etag: res.etag });
          onProgress(end, file.size);
        }
        await api("/api/drive/multipart/complete", { method: "POST", body: JSON.stringify({ key: created.key, uploadId: created.uploadId, parts }) });
      } catch (e) {
        api("/api/drive/multipart/abort", { method: "POST", body: JSON.stringify({ key: created.key, uploadId: created.uploadId }) }).catch(() => {});
        throw e;
      }
      return created.key;
    }
    const r = await send("POST", "/api/drive/upload?dir=" + encodeURIComponent(dir || "") + "&name=" + encodeURIComponent(file.name) + "&overwrite=1", file, { "Content-Type": file.type || "application/octet-stream" }, (l) => onProgress(l, file.size));
    return r.key;
  }
  async function previewFile(it) {
    const k = fileKind(it.name, it.contentType);
    const src = fileUrl(it.key);
    const head = '<div class="pv-h"><span class="fi k-' + k + '"><i class="ic ic-' + KIND_IC[k] + '" aria-hidden="true"></i></span><div class="pv-t"><b>' + escapeHtml(it.name) + "</b><small>" + fmtBytes(it.size) + (it.uploaded ? " · " + escapeHtml(fmtDate(it.uploaded)) : "") + '</small></div><a class="btn ghost" href="' + escapeHtml(fileUrl(it.key, true)) + '" download><i class="ic ic-download" aria-hidden="true"></i>下载</a><button type="button" class="btn ghost" id="pvShare"><i class="ic ic-link" aria-hidden="true"></i>分享</button></div>';
    let inner = "";
    if (k === "image") inner = '<div class="pv-media"><img src="' + escapeHtml(src) + '" alt="' + escapeHtml(it.name) + '"></div>';
    else if (k === "video") inner = '<div class="pv-media"><video src="' + escapeHtml(src) + '" controls playsinline preload="metadata"></video></div>';
    else if (k === "audio") inner = '<div class="pv-audio"><audio src="' + escapeHtml(src) + '" controls preload="metadata"></audio></div>';
    else if (k === "pdf" && it.size < 40 * 1024 * 1024) inner = '<div class="pv-media pv-pdf" id="pvPdf"><p class="meta">正在载入 PDF…</p></div>';
    else if (k === "text" && it.size < 2 * 1024 * 1024) inner = '<pre class="code pv-text" id="pvText">载入中…</pre>';
    else inner = '<div class="drv-empty"><span class="em-ic"><i class="ic ic-' + KIND_IC[k] + '" aria-hidden="true"></i></span><h2>无法在线预览</h2><p>这种文件请下载后查看。</p></div>';
    openModal('<div class="pv">' + head + inner + "</div>");
    const panel = document.querySelector("#modal .panel"); if (panel) panel.classList.add("wide");
    $("pvShare").onclick = () => shareItem(it);
    if (k === "pdf" && $("pvPdf")) {
      try { const b = await (await fetch(src)).blob(); const u = URL.createObjectURL(new Blob([b], { type: "application/pdf" })); if ($("pvPdf")) $("pvPdf").innerHTML = '<iframe title="' + escapeHtml(it.name) + '" src="' + u + '"></iframe>'; watchModalClose(() => URL.revokeObjectURL(u)); } catch { if ($("pvPdf")) $("pvPdf").innerHTML = '<p class="meta">PDF 载入失败，请下载查看。</p>'; }
    }
    if (k === "text" && $("pvText")) {
      try { const t = await (await fetch(src)).text(); if ($("pvText")) $("pvText").textContent = t.slice(0, 300000); } catch { if ($("pvText")) $("pvText").textContent = "载入失败"; }
    }
  }
  function crc32(bytes) {
    if (!crc32.table) {
      const table = new Uint32Array(256);
      for (let n = 0; n < 256; n++) {
        let c = n;
        for (let k = 0; k < 8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
        table[n] = c >>> 0;
      }
      crc32.table = table;
    }
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i++) crc = crc32.table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function buildZip(files) {
    const enc = new TextEncoder();
    const parts = [];
    const central = [];
    let offset = 0;
    const dt = new Date();
    const time = (dt.getHours() << 11) | (dt.getMinutes() << 5) | ((dt.getSeconds() / 2) | 0);
    const date = ((dt.getFullYear() - 1980) << 9) | ((dt.getMonth() + 1) << 5) | dt.getDate();
    files.forEach((f) => {
      const name = enc.encode(String(f.name || "file").replace(/\\/g, "/"));
      const data = f.data instanceof Uint8Array ? f.data : new Uint8Array(f.data || []);
      const crc = crc32(data);
      const local = new Uint8Array(30 + name.length);
      const v = new DataView(local.buffer);
      v.setUint32(0, 0x04034b50, true);
      v.setUint16(4, 20, true);
      v.setUint16(6, 0x800, true);
      v.setUint16(8, 0, true);
      v.setUint16(10, time, true);
      v.setUint16(12, date, true);
      v.setUint32(14, crc, true);
      v.setUint32(18, data.length, true);
      v.setUint32(22, data.length, true);
      v.setUint16(26, name.length, true);
      local.set(name, 30);
      parts.push(local, data);
      const cen = new Uint8Array(46 + name.length);
      const c = new DataView(cen.buffer);
      c.setUint32(0, 0x02014b50, true);
      c.setUint16(4, 20, true);
      c.setUint16(6, 20, true);
      c.setUint16(8, 0x800, true);
      c.setUint16(10, 0, true);
      c.setUint16(12, time, true);
      c.setUint16(14, date, true);
      c.setUint32(16, crc, true);
      c.setUint32(20, data.length, true);
      c.setUint32(24, data.length, true);
      c.setUint16(28, name.length, true);
      c.setUint32(42, offset, true);
      cen.set(name, 46);
      central.push(cen);
      offset += local.length + data.length;
    });
    const centralSize = central.reduce((s, x) => s + x.length, 0);
    const end = new Uint8Array(22);
    const e = new DataView(end.buffer);
    e.setUint32(0, 0x06054b50, true);
    e.setUint16(8, files.length, true);
    e.setUint16(10, files.length, true);
    e.setUint32(12, centralSize, true);
    e.setUint32(16, offset, true);
    return new Blob(parts.concat(central, [end]), { type: "application/zip" });
  }

  function idb() {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open("hongui-ai", 1);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains("sessions")) db.createObjectStore("sessions", { keyPath: "id" });
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  const LS_SESS = "hongui_ai_sessions_v1";
  function lsAll() {
    try {
      const v = JSON.parse(localStorage.getItem(LS_SESS) || "[]");
      return Array.isArray(v) ? v : [];
    } catch { return []; }
  }
  function lsWriteAll(list) {
    try { localStorage.setItem(LS_SESS, JSON.stringify(list.slice(0, 40))); return true; } catch { return false; }
  }
  async function idbAll() {
    try {
      const db = await idb();
      return await new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readonly");
        const rq = tx.objectStore("sessions").getAll();
        rq.onsuccess = () => resolve(rq.result || []);
        rq.onerror = () => reject(rq.error);
      });
    } catch {
      return lsAll();
    }
  }
  async function idbPutLocal(session) {
    try {
      const db = await idb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readwrite");
        tx.objectStore("sessions").put(session);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      const list = lsAll().filter((x) => x && x.id !== session.id);
      list.unshift(session);
      lsWriteAll(list);
    }
  }
  async function idbDelLocal(id) {
    try {
      const db = await idb();
      await new Promise((resolve, reject) => {
        const tx = db.transaction("sessions", "readwrite");
        tx.objectStore("sessions").delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
      });
    } catch {
      lsWriteAll(lsAll().filter((x) => x && x.id !== id));
    }
  }
  const adminSyncQ = { timers: Object.create(null), pending: Object.create(null), last: Object.create(null) };
  function isAdminUser() { return !!(me && me.user); }
  function scheduleAdminSync(session) {
    if (!isAdminUser() || !session || !session.id) return;
    adminSyncQ.pending[session.id] = session;
    const now = Date.now();
    const last = adminSyncQ.last[session.id] || 0;
    const wait = Math.max(0, 2500 - (now - last));
    clearTimeout(adminSyncQ.timers[session.id]);
    adminSyncQ.timers[session.id] = setTimeout(async () => {
      const snap = adminSyncQ.pending[session.id];
      delete adminSyncQ.pending[session.id];
      delete adminSyncQ.timers[session.id];
      if (!snap || !isAdminUser()) return;
      adminSyncQ.last[snap.id] = Date.now();
      try {
        await api("/api/admin/ai-chats/" + encodeURIComponent(snap.id), {
          method: "PUT",
          body: JSON.stringify({ session: snap })
        });
      } catch (e) { /* keep local copy */ }
    }, wait);
  }
  async function flushAdminSync(id) {
    if (!isAdminUser()) return;
    const sid = id || Object.keys(adminSyncQ.pending)[0];
    if (!sid) return;
    clearTimeout(adminSyncQ.timers[sid]);
    delete adminSyncQ.timers[sid];
    const snap = adminSyncQ.pending[sid];
    delete adminSyncQ.pending[sid];
    if (!snap) return;
    adminSyncQ.last[sid] = Date.now();
    try {
      await api("/api/admin/ai-chats/" + encodeURIComponent(sid), {
        method: "PUT",
        body: JSON.stringify({ session: snap })
      });
    } catch (e) { /* ignore */ }
  }
  async function idbPut(session) {
    await idbPutLocal(session);
    scheduleAdminSync(session);
  }
  async function idbDel(id) {
    await idbDelLocal(id);
    if (isAdminUser()) {
      clearTimeout(adminSyncQ.timers[id]);
      delete adminSyncQ.pending[id];
      try { await api("/api/admin/ai-chats/" + encodeURIComponent(id), { method: "DELETE" }); } catch (e) { /* ignore */ }
    }
  }
  async function loadSessionsForUser() {
    let local = [];
    try { local = await idbAll(); } catch { local = []; }
    if (!isAdminUser()) return Array.isArray(local) ? local : [];
    try {
      const data = await api("/api/admin/ai-chats?full=1");
      const remote = Array.isArray(data.sessions) ? data.sessions : [];
      const map = new Map();
      for (const s of local) if (s && s.id) map.set(s.id, s);
      for (const s of remote) {
        if (!s || !s.id) continue;
        const prev = map.get(s.id);
        if (!prev || (Number(s.updated) || 0) >= (Number(prev.updated) || 0)) map.set(s.id, s);
      }
      const merged = [...map.values()];
      for (const s of merged) {
        try { await idbPutLocal(s); } catch { /* ignore */ }
      }
      return merged;
    } catch {
      return Array.isArray(local) ? local : [];
    }
  }
  function rid() {
    return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
  }

  async function renderAi() {
    document.title = AIHOST ? "HONGUI AI · 项宏" : "AI 对话 · 项宏";
    try { aiCfg = Object.assign(aiCfg, await api("/api/ai/config")); } catch { /* keep defaults */ }
    if (!me) {
      try { me = await api("/api/auth/me?soft=1"); if (!me || !me.user) me = null; } catch { me = null; }
    }
    if (!me && !aiCfg.allowGuest) {
      app.innerHTML = '<section class="glass strong pad"><p class="brandline">Powered by HONGUI</p><h1>AI 对话</h1><p>当前仅管理员可以使用。管理员在后台打开「允许游客使用 AI」后，游客可按 IP 每日限次体验。</p><p>' + (AIHOST ? '<button type="button" class="primary" id="aiLoginOpen"><i class="ic ic-lock" aria-hidden="true"></i>管理员登录</button> <a class="btn ghost" href="' + escapeHtml(MAIN_ORIGIN) + '/">返回主站</a>' : '<a class="btn" href="/admin?next=/ai">发布文章 / 管理后台</a>') + '</p></section>';
      bindAiAcct();
      return;
    }
    let sessions = [];
    try { sessions = await loadSessionsForUser(); } catch { sessions = []; toast("浏览器不允许本地存储，历史无法保存"); }
    if (!Array.isArray(sessions)) sessions = [];
    sessions.sort((a, b) => (b.pinned - a.pinned) || (b.updated - a.updated));
    if (!renderAi.current || !sessions.some((s) => s.id === renderAi.current)) {
      renderAi.current = sessions[0] && sessions[0].id;
    }
    let session = sessions.find((s) => s.id === renderAi.current);
    if (!session) {
      session = { id: rid(), title: "新的对话", pinned: false, mode: "general", messages: [], created: Date.now(), updated: Date.now() };
      renderAi.current = session.id;
      try { await idbPut(session); sessions.unshift(session); } catch { /* ignore */ }
    }
    const tiers = aiCfg.tiers || [];
    if (!tiers.length) {
      app.innerHTML = '<section class="glass strong pad"><h1>AI 对话</h1><p>暂时没有可用的 AI 档位，请稍后再试。</p></section>';
      return;
    }
    let prefsAll = {};
    try { prefsAll = JSON.parse(localStorage.getItem("hongui_ai_prefs2") || "{}") || {}; } catch { prefsAll = {}; }
    let tierPick = localStorage.getItem("hongui_ai_tier") || aiCfg.defaultTier;
    if (!tiers.some((t) => t.id === tierPick)) tierPick = aiCfg.defaultTier;
    if (!tiers.some((t) => t.id === tierPick)) tierPick = tiers[0].id;
    const tierOptions = tiers.map((t) => '<option value="' + escapeHtml(t.id) + '"' + (t.id === tierPick ? " selected" : "") + ">" + escapeHtml(t.label) + "</option>").join("");
    const side = sessions.map((s) => '<button type="button" data-sid="' + escapeHtml(s.id) + '" aria-pressed="' + (s.id === session.id ? "true" : "false") + '">' + (s.pinned ? "📌 " : "") + escapeHtml(s.title || "未命名") + "</button>").join("");
    const msgs = session.messages.map((m) => bubbleHtml(m)).join("");
    const quotaText = aiCfg.unlimited || aiCfg.isAdmin
      ? "管理员 · 无限制"
      : ("今日剩余 " + (aiCfg.guestRemaining != null ? aiCfg.guestRemaining : aiCfg.guestDailyLimit) + " / " + aiCfg.guestDailyLimit + " 次");
    const emptyHtml = '<div class="ai-empty"><div class="ai-orb" aria-hidden="true">' + MARK + '</div><h2>有什么可以帮你的？</h2><p>选择模型后直接提问。回车发送，Shift+回车换行。' + (isAdminUser() ? "管理员会话会同步到服务器。" : "对话历史只保存在这台浏览器。") + '</p>' + aiSugsHtml() + '</div>';
    app.innerHTML = '<section class="ai-shell" id="aiShell"><div class="ai-backdrop" id="aiBackdrop" hidden></div>' +
      '<aside class="ai-side" id="aiSide"><div class="ai-brand"><span class="ai-logo" aria-hidden="true">' + MARK + '</span><div><b>HONGUI AI</b><small>Powered by HONGUI · 开发者：项宏</small></div></div><div class="ai-side-head"><button type="button" id="newChat" class="primary"><i class="ic ic-plus" aria-hidden="true"></i>新对话</button><button type="button" class="danger" id="clearChat">一键清空</button></div>' +
      '<p class="quota" id="aiQuota">' + escapeHtml(quotaText) + '</p>' +
      '<input id="findChat" placeholder="搜索会话" aria-label="搜索会话">' +
      '<div class="ai-sess" id="sessionList" role="list">' + side + '</div>' +
      '<div class="ai-side-tools"><button type="button" id="renameChat">重命名</button><button type="button" id="pinChat">置顶</button><button type="button" class="danger" id="delChat">删除</button><button type="button" id="exMd">导出 MD</button><button type="button" id="exJson">导出 JSON</button><button type="button" id="imJson">导入</button><input id="imFile" type="file" accept="application/json" hidden></div>' + aiAcctHtml() + '</aside>' +
      '<div class="ai-main"><div class="ai-top"><button type="button" id="aiBack" class="ai-icon" aria-label="返回主站" title="返回主站"><i class="ic ic-arrow-left" aria-hidden="true"></i></button><div class="ai-top-title"><b>HONGUI AI</b><span id="aiTopSub">' + escapeHtml(quotaText) + '</span></div><button type="button" id="aiSideOpen" class="ai-icon" aria-label="会话列表"><i class="ic ic-sidebar" aria-hidden="true"></i></button></div>' +
      '<div class="ai-msgs" id="msgs" aria-live="polite">' + (msgs || emptyHtml) + '</div>' +
      '<div class="ai-comp-wrap"><div class="previews" id="previews"></div><div class="ai-comp"><textarea id="box" aria-label="输入消息" placeholder="给 AI 发送消息…" rows="1"></textarea>' +
      '<div class="ai-comp-bar"><div class="ai-comp-picks"><div class="ai-tier-wrap"><button type="button" id="tierBtn" aria-haspopup="listbox" aria-expanded="false" aria-controls="tierMenu" title="选择模型"><span id="tierBtnLbl"></span></button>' +
      '<div class="ai-tier-menu" id="tierMenu" role="listbox" aria-label="选择模型" hidden><p class="ai-tier-cap">选择模型</p>' + tiers.map((t) => '<button type="button" role="option" data-tier="' + escapeHtml(t.id) + '" aria-selected="false"><i class="ic ic-' + (t.kind === "image" ? "image" : t.thinking ? "ai" : "sparkles") + '" aria-hidden="true"></i><span><b>' + escapeHtml(t.label) + (t.hasKey ? "" : ' <em>未配置密钥</em>') + '</b><small>' + escapeHtml(t.desc || "") + '</small></span><i class="ai-tier-ck" aria-hidden="true"></i></button>').join("") + '</div>' +
      '<select id="tier" aria-label="模型档位" tabindex="-1" hidden>' + tierOptions + '</select></div><select id="mode" aria-label="对话模式">' + MODES.map((m) => '<option value="' + m.id + '">' + m.label + "</option>").join("") + '</select>' +
      '<select id="imgSize" aria-label="图片尺寸" hidden><option value="1:1">1:1 方图</option><option value="16:9">16:9 横图</option><option value="9:16">9:16 竖图</option></select>' +
      '<div class="ai-more-wrap"><button type="button" id="aiMoreBtn" aria-label="更多" aria-haspopup="menu" aria-expanded="false">☰</button>' +
      '<div class="ai-more-menu" id="aiMoreMenu" role="menu" hidden><button type="button" role="menuitem" id="imgBtn">上传图片</button><button type="button" role="menuitem" id="micBtn">语音输入</button><button type="button" role="menuitem" id="aiSideToggle" class="ai-more-sideonly">会话列表</button></div></div></div>' +
      '<span class="spacer"></span><button type="button" id="stopBtn" hidden>停止</button><button type="button" class="primary" id="sendBtn">发送</button></div></div>' +
      '<details class="ai-adv"><summary>更多选项 · 附件与参数</summary><p class="meta" id="tierHint"></p><div class="row" id="chatParams"><label>温度 <input id="temp" type="number" min="0" max="2" step="0.1"></label><label>最大输出 <input id="maxTok" type="number" min="64" max="32768" step="64"></label></div>' +
      '<div class="row"><button type="button" id="vidBtn">视频关键帧</button><input id="vidPick" type="file" accept="video/*" hidden><button type="button" id="fileBtn">文件</button><input id="fileAi" type="file" hidden><button type="button" id="drivePick">网盘选图</button><button type="button" id="saveDrive">存到网盘</button><input id="imgPick" type="file" accept="image/*" multiple hidden></div>' +
      '<p class="meta">图片在浏览器内压缩；游客每日限次，管理员无限制。' + (isAdminUser() ? "管理员历史会同步到内部存储。" : "游客历史只留在本机浏览器。") + '</p></details></div></div></section>';
    $("mode").value = session.mode || "general";
    function curTier() { return tiers.find((t) => t.id === $("tier").value) || tiers[0]; }
    function applyTier() {
      const t = curTier();
      const img = t.kind === "image";
      const pr = prefsAll[t.id] || {};
      if ($("chatParams")) $("chatParams").hidden = img;
      if (!img) {
        $("temp").value = pr.temperature != null ? pr.temperature : t.temperature;
        $("maxTok").max = t.maxTokens;
        $("maxTok").value = Math.min(pr.maxTokens != null ? pr.maxTokens : t.maxTokens, t.maxTokens);
      }
      $("mode").hidden = img;
      $("imgSize").hidden = !img;
      if (img) { const sz = localStorage.getItem("hongui_ai_size"); $("imgSize").value = ["1:1", "16:9", "9:16"].includes(sz) ? sz : "1:1"; }
      $("box").placeholder = img ? "描述想生成的画面，如：薄雾里的东钱湖" : "给 AI 发送消息…";
      const ib = $("imgBtn");
      if (ib) { ib.disabled = img; ib.title = img ? "画图只接受文字描述" : ""; }
      if ($("tierBtnLbl")) $("tierBtnLbl").textContent = t.label || t.id;
      document.querySelectorAll("#tierMenu [data-tier]").forEach((b) => b.setAttribute("aria-selected", b.getAttribute("data-tier") === t.id ? "true" : "false"));
      $("tierHint").textContent = (t.desc || "") + (img ? " · 只接受文字描述，每生成一张计 1 次。" : t.vision ? " · 可发送图片与视频关键帧。" : " · 当前档位未开启看图。") + (t.hasKey ? "" : " ⚠ 该档位未配置密钥。") + (t.model ? " 模型：" + t.model : "");
    }
    applyTier();
    $("tier").onchange = () => { localStorage.setItem("hongui_ai_tier", $("tier").value); applyTier(); };
    if ($("tierBtn") && $("tierMenu")) {
      const tb = $("tierBtn"), tm = $("tierMenu");
      const closeTier = (focus) => { tm.hidden = true; tb.setAttribute("aria-expanded", "false"); if (focus) tb.focus(); };
      tb.onclick = (e) => {
        e.stopPropagation();
        const open = tm.hidden;
        if ($("aiMoreMenu")) { $("aiMoreMenu").hidden = true; if ($("aiMoreBtn")) $("aiMoreBtn").setAttribute("aria-expanded", "false"); }
        tm.hidden = !open;
        tb.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) { const sel = tm.querySelector('[aria-selected="true"]') || tm.querySelector("[data-tier]"); if (sel) sel.focus({ preventScroll: true }); }
      };
      tm.onclick = (e) => {
        const it = e.target.closest("[data-tier]");
        if (!it) return;
        $("tier").value = it.getAttribute("data-tier");
        $("tier").dispatchEvent(new Event("change"));
        closeTier(true);
      };
      tm.onkeydown = (e) => {
        const items = [...tm.querySelectorAll("[data-tier]")];
        const i = items.indexOf(document.activeElement);
        if (e.key === "Escape") { e.preventDefault(); closeTier(true); }
        else if (e.key === "ArrowDown") { e.preventDefault(); (items[i + 1] || items[0]).focus(); }
        else if (e.key === "ArrowUp") { e.preventDefault(); (items[i - 1] || items[items.length - 1]).focus(); }
      };
      if (window.__aiTierDocClose) document.removeEventListener("click", window.__aiTierDocClose, true);
      window.__aiTierDocClose = (e) => { if (!tm.hidden && !tb.contains(e.target) && !tm.contains(e.target)) closeTier(false); };
      document.addEventListener("click", window.__aiTierDocClose, true);
    }
    $("imgSize").onchange = () => { try { localStorage.setItem("hongui_ai_size", $("imgSize").value); } catch { /* ignore */ } };
    if ($("aiMoreBtn") && $("aiMoreMenu")) {
      const moreBtn = $("aiMoreBtn"), moreMenu = $("aiMoreMenu");
      const closeMore = () => { moreMenu.hidden = true; moreBtn.setAttribute("aria-expanded", "false"); };
      moreBtn.onclick = (e) => {
        e.stopPropagation();
        const open = moreMenu.hidden;
        moreMenu.hidden = !open;
        moreBtn.setAttribute("aria-expanded", open ? "true" : "false");
      };
      moreMenu.onclick = () => setTimeout(closeMore, 0);
      if (window.__aiMoreDocClose) document.removeEventListener("click", window.__aiMoreDocClose, true);
      window.__aiMoreDocClose = (e) => {
        if (!moreMenu.hidden && !moreBtn.contains(e.target) && !moreMenu.contains(e.target)) closeMore();
      };
      document.addEventListener("click", window.__aiMoreDocClose, true);
    }
    if ($("aiBack")) $("aiBack").onclick = () => {
      if (AIHOST) { location.href = MAIN_ORIGIN + "/"; return; }
      try {
        const ref = document.referrer ? new URL(document.referrer) : null;
        if (ref && ref.origin === location.origin && ref.pathname !== "/ai") { history.back(); return; }
      } catch { /* ignore */ }
      navigate("/");
    };
    (function bindAiViewport() {
      if (window.__aiVvCleanup) { window.__aiVvCleanup(); window.__aiVvCleanup = null; }
      const root = document.documentElement;
      const appEl = $("app");
      const msgsEl = $("msgs");
      const boxEl = $("box");
      const sync = () => {
        if (!onAiView()) return;
        const slot = document.querySelector(".topslot");
        const topHidden = document.documentElement.classList.contains("ai-route");
        const topH = topHidden ? 0 : (slot ? Math.round(slot.getBoundingClientRect().height) : 72);
        const vv = window.visualViewport;
        const vh = vv ? vv.height : window.innerHeight;
        const offsetTop = vv ? Math.max(0, vv.offsetTop || 0) : 0;
        const h = Math.max(180, Math.floor(vh - topH));
        root.style.setProperty("--aiShellH", h + "px");
        if (appEl) appEl.style.transform = offsetTop ? ("translateY(" + offsetTop + "px)") : "";
      };
      const onFocus = () => {
        sync();
        setTimeout(() => {
          sync();
          if (msgsEl) msgsEl.scrollTop = msgsEl.scrollHeight;
        }, 60);
        setTimeout(sync, 300);
      };
      sync();
      const vv = window.visualViewport;
      if (vv) {
        vv.addEventListener("resize", sync);
        vv.addEventListener("scroll", sync);
      }
      window.addEventListener("resize", sync);
      window.addEventListener("orientationchange", sync);
      if (boxEl) {
        boxEl.addEventListener("focus", onFocus);
        boxEl.addEventListener("blur", () => setTimeout(sync, 80));
      }
      window.__aiVvCleanup = () => {
        if (vv) {
          vv.removeEventListener("resize", sync);
          vv.removeEventListener("scroll", sync);
        }
        window.removeEventListener("resize", sync);
        window.removeEventListener("orientationchange", sync);
        if (boxEl) {
          boxEl.removeEventListener("focus", onFocus);
        }
      };
    })();
    const shell = $("aiShell");
    const openSide = (on) => {
      if (!shell) return;
      shell.classList.toggle("side-open", !!on);
      const bd = $("aiBackdrop");
      if (bd) bd.hidden = !on;
    };
    if ($("aiSideToggle")) $("aiSideToggle").onclick = () => openSide(!shell.classList.contains("side-open"));
    if ($("aiBackdrop")) $("aiBackdrop").onclick = () => openSide(false);
    if ($("aiSideOpen")) $("aiSideOpen").onclick = () => openSide(true);
    if ($("msgs")) $("msgs").addEventListener("click", (e) => {
      const sg = e.target.closest && e.target.closest("[data-sug]");
      if (!sg) return;
      const bx = $("box");
      if (!bx) return;
      bx.value = sg.getAttribute("data-sug") || "";
      bx.dispatchEvent(new Event("input", { bubbles: true }));
      bx.focus();
    });
    bindAiAcct();
    renderAi.pending = renderAi.pending || [];
    paintPreviews();
    $("findChat").oninput = () => {
      const q = $("findChat").value.trim().toLowerCase();
      document.querySelectorAll("#sessionList button").forEach((btn) => {
        const item = sessions.find((x) => x.id === btn.getAttribute("data-sid"));
        const blob = ((item && item.title) || "") + " " + ((item && item.messages || []).map((m) => m.content || "").join(" "));
        btn.hidden = q && !blob.toLowerCase().includes(q);
      });
    };
    $("sessionList").onclick = (e) => {
      const b = e.target.closest("[data-sid]");
      if (!b) return;
      renderAi.current = b.getAttribute("data-sid");
      openSide(false);
      renderAi();
    };
    $("newChat").onclick = async () => {
      await flushAdminSync(session.id);
      const s = { id: rid(), title: "新的对话", pinned: false, mode: $("mode").value, messages: [], created: Date.now(), updated: Date.now() };
      await idbPut(s);
      await flushAdminSync(s.id);
      renderAi.current = s.id;
      renderAi.pending = [];
      renderAi();
    };
    if ($("clearChat")) $("clearChat").onclick = async () => {
      if (!confirm("确认一键清空当前对话的全部消息？此操作不可撤销。")) return;
      session.messages = [];
      session.title = "新的对话";
      session.updated = Date.now();
      renderAi.pending = [];
      renderAi.note = "";
      await idbPut(session);
      await flushAdminSync(session.id);
      renderAi();
      toast("已清空当前对话");
    };
    $("renameChat").onclick = async () => {
      const name = prompt("会话名称", session.title);
      if (!name) return;
      session.title = name.slice(0, 80);
      session.updated = Date.now();
      await idbPut(session);
      renderAi();
    };
    $("pinChat").onclick = async () => {
      session.pinned = !session.pinned;
      session.updated = Date.now();
      await idbPut(session);
      renderAi();
    };
    $("delChat").onclick = async () => {
      if (!confirm("删除这个会话？")) return;
      await idbDel(session.id);
      renderAi.current = "";
      renderAi();
    };
    $("exMd").onclick = () => saveBlob(new Blob([sessionToMd(session)], { type: "text/markdown" }), "chat.md");
    $("exJson").onclick = () => saveBlob(new Blob([JSON.stringify(sessions, null, 2)], { type: "application/json" }), "hongui-ai.json");
    $("imJson").onclick = () => $("imFile").click();
    $("imFile").onchange = async () => {
      const file = $("imFile").files[0];
      if (!file) return;
      try {
        const data = JSON.parse(await file.text());
        const list = Array.isArray(data) ? data : [data];
        for (const item of list) {
          if (!item || !Array.isArray(item.messages)) continue;
          item.id = item.id || rid();
          item.updated = item.updated || Date.now();
          item.created = item.created || Date.now();
          await idbPut(item);
        }
        toast("已导入");
        renderAi();
      } catch (e) { toast("导入失败"); }
    };
    $("mode").onchange = async () => { session.mode = $("mode").value; await idbPut(session); };
    const savePrefs = () => {
      prefsAll[$("tier").value] = { temperature: Number($("temp").value), maxTokens: Number($("maxTok").value) };
      try { localStorage.setItem("hongui_ai_prefs2", JSON.stringify(prefsAll)); } catch { /* ignore */ }
    };
    $("temp").onchange = savePrefs;
    $("maxTok").onchange = savePrefs;
    $("box").addEventListener("input", () => { const el = $("box"); el.style.height = "auto"; el.style.height = Math.min(180, el.scrollHeight) + "px"; });
    $("box").addEventListener("keydown", (e) => {
      if (e.key === "Enter" && !e.shiftKey && !e.isComposing) { e.preventDefault(); sendChat(session, false); }
    });
    $("sendBtn").onclick = () => sendChat(session, false);
    $("stopBtn").onclick = () => { if (renderAi.abort) renderAi.abort.abort(); };
    $("micBtn").onclick = () => dictate($("box"));
    $("imgBtn").onclick = () => $("imgPick").click();
    $("imgPick").onchange = () => addImages([...$("imgPick").files]);
    $("vidBtn").onclick = () => $("vidPick").click();
    $("vidPick").onchange = () => addVideo($("vidPick").files[0]);
    $("fileBtn").onclick = () => $("fileAi").click();
    $("fileAi").onchange = () => addTextFile($("fileAi").files[0]);
    $("drivePick").onclick = () => pickFromDrive();
    $("saveDrive").onclick = () => savePendingToDrive();
    const thread = document.querySelector(".ai-main") || $("aiShell") || app;
    thread.addEventListener("dragover", (e) => e.preventDefault());
    thread.addEventListener("drop", (e) => {
      e.preventDefault();
      const files = [...e.dataTransfer.files];
      files.forEach((f) => {
        if (f.type.startsWith("image/")) addImages([f]);
        else if (f.type.startsWith("video/")) addVideo(f);
        else addTextFile(f);
      });
    });
    const msgsStickEl = $("msgs");
    if (msgsStickEl) {
      renderAi._stick = true;
      msgsStickEl.addEventListener("scroll", () => {
        const gap = msgsStickEl.scrollHeight - msgsStickEl.scrollTop - msgsStickEl.clientHeight;
        renderAi._stick = gap < 96;
      }, { passive: true });
      requestAnimationFrame(() => { msgsStickEl.scrollTop = msgsStickEl.scrollHeight; });
    }
    $("msgs").addEventListener("click", (e) => {
      const dl = e.target.closest && e.target.closest("[data-dl]");
      if (!dl) return;
      const msg = session.messages.find((m) => m.id === dl.getAttribute("data-id"));
      const src = msg && msg.images && msg.images[Number(dl.getAttribute("data-dl")) || 0];
      if (!src) return;
      const blob = dataUrlToBlob(src);
      if (!blob) return toast("图片无法下载");
      saveBlob(blob, "hongui-ai-" + new Date().toISOString().slice(0, 19).replace(/[-:T]/g, "") + (blob.type === "image/png" ? ".png" : blob.type === "image/webp" ? ".webp" : ".jpg"));
    });
    $("msgs").addEventListener("click", async (e) => {
      const copy = e.target.closest("[data-copy-msg]");
      const speak = e.target.closest("[data-speak]");
      const retry = e.target.closest("[data-retry]");
      const regen = e.target.closest("[data-regen]");
      const edit = e.target.closest("[data-edit]");
      const fb = e.target.closest("[data-fb]");
      const id = (copy || speak || regen || edit || fb || retry) && (copy || speak || regen || edit || fb || retry).getAttribute("data-id");
      const msg = session.messages.find((m) => m.id === id);
      if (copy && msg) { await navigator.clipboard.writeText(msg.content || ""); toast("已复制"); }
      if (speak && msg) speakText(msg.content || "");
      if (fb && msg) { msg.feedback = Number(fb.getAttribute("data-fb")); await idbPut(session); renderAi(); }
      if (edit && msg) {
        const idx = session.messages.findIndex((m) => m.id === msg.id);
        $("box").value = msg.content || "";
        renderAi.pending = (msg.images || []).slice();
        session.messages = session.messages.slice(0, idx);
        await idbPut(session);
        toast("已放回输入框，修改后发送即可");
        renderAi();
      }
      if ((retry || regen) && msg) sendChat(session, true);
    });
    function onPaste(e) {
      if (!onAiView()) return;
      const items = [...(e.clipboardData && e.clipboardData.items || [])];
      const images = items.filter((it) => it.type && it.type.startsWith("image/")).map((it) => it.getAsFile()).filter(Boolean);
      if (images.length) { e.preventDefault(); addImages(images); }
    }
    renderAi.paste = onPaste;
    function paintPreviews() {
      const box = $("previews");
      if (!box) return;
      box.innerHTML = (renderAi.pending || []).map((src, i) => '<button type="button" class="mini" data-rm="' + i + '" aria-label="移除第 ' + (i + 1) + ' 张图片" title="点击移除"><img alt="待发送图片 ' + (i + 1) + '" src="' + escapeHtml(String(src)) + '"></button>').join("") + (renderAi.note ? '<span class="meta">' + escapeHtml(renderAi.note) + "</span>" : "");
      box.onclick = (e) => {
        const b = e.target.closest("[data-rm]");
        if (!b) return;
        renderAi.pending.splice(Number(b.getAttribute("data-rm")), 1);
        if (!renderAi.pending.length) renderAi.note = "";
        paintPreviews();
      };
    }
    async function addImages(files) {
      for (const file of files) {
        if ((renderAi.pending || []).length >= (renderAi.note ? 8 : 4)) { toast("单次最多 " + (renderAi.note ? 8 : 4) + " 张图片"); break; }
        try {
          const url = await compressImage(file);
          renderAi.pending.push(url);
        } catch (e) { toast(e.message || "图片无法读取"); }
      }
      paintPreviews();
    }
    async function addVideo(file) {
      if (!file) return;
      try {
        const frames = await extractFrames(file);
        renderAi.note = "这是视频的关键帧，将按时间顺序发送";
        renderAi.pending = [];
        for (const frame of frames) {
          if (renderAi.pending.length >= 8) break;
          renderAi.pending.push(frame);
        }
        toast("已抽取 " + renderAi.pending.length + " 帧关键帧，将按时间顺序发送");
        paintPreviews();
      } catch (e) { toast(e.message || "视频无法读取"); }
    }
    async function addTextFile(file) {
      if (!file) return;
      const name = file.name || "附件";
      try {
        let text = "";
        if (/\.pdf$/i.test(name) || file.type === "application/pdf") text = await extractPdfText(await file.arrayBuffer());
        else if (/\.(txt|md|json|js|mjs|ts|css|csv|log|xml|ya?ml|py|html?|svg|sh)$/i.test(name) || (file.type || "").startsWith("text/")) text = await file.text();
        else { toast("这个文件类型请先自行复制文字，或改用文本、代码、CSV、PDF"); return; }
        if (!text.trim()) { toast("没有提取到文字"); return; }
        if (text.length > 80000) text = text.slice(0, 80000) + "\n…（已截断）";
        $("box").value += ($("box").value ? "\n" : "") + "【附件 " + name + "】\n" + text;
      } catch (e) { toast(e.message || "文件读取失败"); }
    }
  }
  function stripThinkClient(s) {
    let t = String(s || "");
    t = t.replace(/<think>[\s\S]*?<\/think>/gi, "");
    t = t.replace(/<think>[\s\S]*$/i, "");
    const close = t.toLowerCase().lastIndexOf("</think>");
    if (close >= 0) t = t.slice(close + 8);
    return t;
  }
  function thinkingHtml(deep) {
    return '<span class="ai-thinking' + (deep ? " deep" : "") + '" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>' + (deep ? '<span class="lbl">思考中…</span>' : '<span class="lbl sr">正在回复</span>') + "</span>";
  }
  function dataUrlToBlob(src) {
    const m = /^data:(image\/[a-z0-9.+-]+);base64,(.*)$/i.exec(String(src || ""));
    if (!m) return null;
    try {
      const bin = atob(m[2]);
      const arr = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
      return new Blob([arr], { type: m[1].toLowerCase() });
    } catch { return null; }
  }
  function shrinkGenerated(src) {
    // 生成图压到约 430KB 以内再存入会话（管理员会话还要同步到服务器）；下载用存下来的这一份
    if (String(src).length <= 440000) return Promise.resolve(src);
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        try {
          const c = document.createElement("canvas");
          c.width = img.naturalWidth;
          c.height = img.naturalHeight;
          c.getContext("2d").drawImage(img, 0, 0);
          let out = src;
          for (const q of [0.92, 0.86, 0.78, 0.68, 0.56]) {
            out = c.toDataURL("image/jpeg", q);
            if (out.length <= 440000) break;
          }
          resolve(out.length < String(src).length ? out : src);
        } catch { resolve(src); }
      };
      img.onerror = () => resolve(src);
      img.src = src;
    });
  }
  function bubbleHtml(m) {
    const id = escapeHtml(m.id);
    const gen = m.role === "assistant" && m.kind === "image";
    const okImgs = (m.images || []).filter((src) => /^data:image\//.test(String(src)));
    const images = gen
      ? okImgs.map((src, i) => '<figure class="ai-gen"><img alt="AI 生成的图片：' + escapeHtml((m.prompt || "").slice(0, 80)) + '" src="' + escapeHtml(String(src)) + '"><figcaption><span>' + escapeHtml(m.prompt || "") + '</span><button type="button" data-dl="' + i + '" data-id="' + id + '"><i class="ic ic-download" aria-hidden="true"></i>下载</button></figcaption></figure>').join("")
      : okImgs.map((src, i) => '<img alt="消息图片 ' + (i + 1) + '" src="' + escapeHtml(String(src)) + '">').join("");
    const shown = m.role === "assistant" ? stripThinkClient(m.content || "").replace(/^\s+/, "") : "";
    const body = m.role === "assistant" ? (gen && !shown ? "" : '<div class="md">' + renderMarkdown(shown) + "</div>") : "<div>" + escapeHtml(m.content || "").replace(/\n/g, "<br>") + "</div>";
    const tierTag = m.role === "assistant" && m.tier ? '<p class="meta">' + escapeHtml(m.tierLabel || m.tier) + "</p>" : "";
    const usage = m.usage ? '<p class="meta">token：提示 ' + (Number(m.usage.prompt_tokens) || 0) + " · 补全 " + (Number(m.usage.completion_tokens) || 0) + " · 合计 " + (Number(m.usage.total_tokens) || 0) + "</p>" : "";
    const tools = '<div class="tools">' +
      (m.role === "assistant"
        ? (gen ? "" : '<button type="button" data-copy-msg="1" data-id="' + id + '">复制</button><button type="button" data-speak="1" data-id="' + id + '">朗读</button>') + '<button type="button" data-regen="1" data-id="' + id + '">' + (gen ? "再画一张" : "重新生成") + '</button><button type="button" data-fb="1" data-id="' + id + '">赞</button><button type="button" data-fb="-1" data-id="' + id + '">踩</button>'
        : '<button type="button" data-edit="1" data-id="' + id + '">编辑后重发</button>') +
      (m.role === "assistant" && m.error ? '<button type="button" data-retry="1" data-id="' + id + '">重试</button>' : "") +
      (m.feedback ? '<span class="meta">' + (m.feedback > 0 ? "已赞" : "已踩") + "</span>" : "") +
      "</div>";
    return '<div class="bubble ' + (m.role === "user" ? "user" : "assistant") + (gen ? " gen" : "") + '">' + tierTag + images + body + usage + tools + "</div>";
  }
  async function sendImage(session, reuse, tierId, tier) {
    const box = $("box");
    let prompt = "";
    if (!reuse) {
      prompt = box.value.trim();
      if ((renderAi.pending || []).length) return toast("画图只接受文字描述，请先移除图片");
      if (!prompt) return toast("请描述想生成的画面");
      session.messages.push({ id: rid(), role: "user", content: prompt, images: [], ts: Date.now(), feedback: 0 });
      box.value = "";
      box.style.height = "";
    } else {
      if (session.messages.length && session.messages[session.messages.length - 1].role === "assistant") session.messages.pop();
      const lastU = session.messages.slice().reverse().find((m) => m.role === "user");
      prompt = String((lastU && lastU.content) || "").trim();
      if (!prompt) return toast("没有可用的画面描述");
    }
    const size = ($("imgSize") && $("imgSize").value) || "1:1";
    const assistant = { id: rid(), role: "assistant", kind: "image", prompt, content: "", images: [], ts: Date.now(), feedback: 0, usage: null, error: false, tier: tierId, tierLabel: tier.label || tierId };
    session.messages.push(assistant);
    session.updated = Date.now();
    if (session.title === "新的对话") session.title = ("画图：" + prompt).replace(/\s+/g, " ").slice(0, 24);
    session.mode = ($("mode") && $("mode").value) || session.mode;
    await idbPut(session).catch(() => {});
    renderAi.abort = new AbortController();
    if ($("stopBtn")) $("stopBtn").hidden = false;
    if ($("sendBtn")) $("sendBtn").disabled = true;
    const msgsEl = $("msgs");
    if (msgsEl) {
      msgsEl.innerHTML = session.messages.slice(0, -1).map((m) => bubbleHtml(m)).join("") +
        '<div class="bubble assistant gen"><p class="meta">' + escapeHtml(assistant.tierLabel) + '</p><div class="ai-gen-wait" style="aspect-ratio:' + size.replace(":", " / ") + '"><span class="ai-thinking deep" role="status"><span class="dots" aria-hidden="true"><i></i><i></i><i></i></span><span class="lbl">正在生成图片…</span></span></div></div>';
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify({ tier: tierId, prompt, size }),
        signal: renderAi.abort.signal
      });
      let j = null;
      try { j = await res.json(); } catch { j = null; }
      if (!res.ok || !j || !j.ok || !/^data:image\//.test(String(j.image || ""))) {
        assistant.content = friendlyChatError(res.status, (j && j.error) || (res.ok ? "画图服务没有返回图片，请重试" : ""));
        assistant.error = true;
        toast(assistant.content);
      } else {
        assistant.images = [await shrinkGenerated(j.image)];
        if (!aiCfg.unlimited && !aiCfg.isAdmin && aiCfg.guestRemaining != null) {
          aiCfg.guestRemaining = Math.max(0, Number(aiCfg.guestRemaining) - 1);
          aiCfg.guestUsed = (Number(aiCfg.guestUsed) || 0) + 1;
        }
      }
    } catch (e) {
      if (e.name === "AbortError") { assistant.content = "已停止生成"; toast("已停止"); }
      else { assistant.content = "网络异常，请重试"; assistant.error = true; toast("网络异常，请重试"); }
    } finally {
      await idbPut(session).catch(() => {});
      await flushAdminSync(session.id);
      if ($("stopBtn")) $("stopBtn").hidden = true;
      if ($("sendBtn")) $("sendBtn").disabled = false;
      renderAi();
    }
  }
  function friendlyChatError(status, message) {
    if (message) return message;
    if (status === 401) return "请先登录后再使用 AI 对话";
    if (status === 429) return "请求过于频繁或今日次数已用完，请稍后再试";
    if (status >= 500) return "模型服务暂时不可用，请稍后重试";
    return "请求失败（" + status + "）";
  }
  async function sendChat(session, reuse) {
    const box = $("box");
    if (!box) return;
    const tiers = aiCfg.tiers || [];
    let tierId = ($("tier") && $("tier").value) || (tiers[0] && tiers[0].id) || "general";
    let tier = tiers.find((t) => t.id === tierId) || {};
    if (tier.kind === "image") return sendImage(session, reuse, tierId, tier);
    let text = reuse ? "" : box.value.trim();
    const note = reuse ? "" : (renderAi.note || "");
    const images = reuse ? [] : (renderAi.pending || []).slice(0, note ? 8 : 4);
    if (!reuse) {
      if (!text && !images.length) return toast("请输入内容");
      if (images.length && !tier.vision) {
        const wide = tiers.find((t) => t.vision && t.hasKey);
        if (wide && confirm("当前档位不支持图片理解，是否切换到「" + wide.label + "」档再发送？")) {
          $("tier").value = wide.id;
          $("tier").dispatchEvent(new Event("change"));
          tierId = wide.id;
          tier = wide;
        } else return toast("当前档位不支持图片理解，请换一档或移除图片后再发送");
      }
      if (note) text = "这是一段视频按时间顺序抽取的关键帧（共 " + images.length + " 张），请按顺序理解视频内容。\n" + text;
      session.messages.push({ id: rid(), role: "user", content: text, images, ts: Date.now(), feedback: 0 });
      box.value = "";
      renderAi.pending = [];
      renderAi.note = "";
      const pv = $("previews");
      if (pv) pv.innerHTML = "";
    } else if (session.messages.length && session.messages[session.messages.length - 1].role === "assistant") {
      session.messages.pop();
    }
    const assistant = { id: rid(), role: "assistant", content: "", reasoning: "", ts: Date.now(), feedback: 0, usage: null, error: false, tier: tierId, tierLabel: tier.label || tierId };
    session.messages.push(assistant);
    session.updated = Date.now();
    if (session.title === "新的对话") {
      const first = session.messages.find((m) => m.role === "user");
      session.title = ((first && first.content) || "对话").replace(/\s+/g, " ").slice(0, 24);
    }
    session.mode = ($("mode") && $("mode").value) || session.mode;
    await idbPut(session).catch(() => {});
    const budget = me ? 60000 : 4000;
    let used = 0;
    const trimmed = [];
    for (let i = session.messages.length - 1; i >= 0; i--) {
      const m = session.messages[i];
      if (m.role === "assistant" && (!m.content || m.kind === "image")) continue;
      const len = (m.content || "").length;
      if (trimmed.length && used + len > budget) { toast("较早的消息已自动截断"); break; }
      used += len;
      trimmed.push(m);
    }
    trimmed.reverse();
    let lastImg = -1;
    trimmed.forEach((m, i) => { if (m.role === "user" && m.images && m.images.length) lastImg = i; });
    const payloadMessages = [];
    trimmed.forEach((m, i) => {
      if (m.role === "user" && m.images && m.images.length) {
        if (tier.vision && i === lastImg) {
          const content = [{ type: "text", text: m.content || "请看这些图片" }];
          m.images.slice(0, 8).forEach((url) => content.push({ type: "image_url", image_url: { url } }));
          payloadMessages.push({ role: "user", content });
        } else payloadMessages.push({ role: "user", content: (m.content || "") + "\n（此前附带的图片不再重复发送）" });
      } else if (m.role === "user" || (m.role === "assistant" && m.content && !m.error && m.kind !== "image")) payloadMessages.push({ role: m.role, content: m.role === "assistant" ? stripThinkClient(m.content).trim() : (m.content || "") });
    });
    renderAi.abort = new AbortController();
    if ($("stopBtn")) $("stopBtn").hidden = false;
    if ($("sendBtn")) $("sendBtn").disabled = true;
    const msgsEl = $("msgs");
    let streamBubble = null;
    let streamBody = null;
    let thinkingSeen = !!tier.thinking;
    let lastHtml = "";
    let finishReason = "";
    const ensureStreamDom = () => {
      if (!msgsEl) return;
      if (streamBubble && msgsEl.contains(streamBubble)) return;
      streamBubble = document.createElement("div");
      streamBubble.className = "bubble assistant";
      streamBubble.innerHTML = '<p class="meta">' + escapeHtml(assistant.tierLabel || assistant.tier || "") + '</p><div class="md"></div><div class="tools"></div>';
      streamBody = streamBubble.querySelector(".md");
      msgsEl.appendChild(streamBubble);
    };
    const paintLast = () => {
      if (!msgsEl) return;
      ensureStreamDom();
      const shown = stripThinkClient(assistant.content || "").replace(/^\s+/, "");
      const html = shown ? renderMarkdown(shown) : thinkingHtml(thinkingSeen);
      if (streamBody && html !== lastHtml) { streamBody.innerHTML = html; lastHtml = html; }
      if (renderAi._stick !== false) msgsEl.scrollTop = msgsEl.scrollHeight;
    };
    renderAi._stick = true;
    if (msgsEl) {
      msgsEl.innerHTML = session.messages.slice(0, -1).map((m) => bubbleHtml(m)).join("");
      paintLast();
      msgsEl.scrollTop = msgsEl.scrollHeight;
    }
    try {
      const res = await fetch("/api/ai/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "text/event-stream" },
        body: JSON.stringify({
          tier: tierId,
          mode: session.mode || "general",
          temperature: Number(($("temp") && $("temp").value) || tier.temperature || 1),
          maxTokens: Number(($("maxTok") && $("maxTok").value) || tier.maxTokens || 1024),
          messages: payloadMessages
        }),
        signal: renderAi.abort.signal
      });
      const ct = res.headers.get("content-type") || "";
      if (!res.ok || !ct.includes("text/event-stream")) {
        let message = "";
        try { const j = await res.json(); message = j.error || ""; } catch { message = ""; }
        assistant.content = friendlyChatError(res.status, message);
        assistant.error = true;
        await idbPut(session).catch(() => {});
        toast(assistant.content);
        renderAi();
        return;
      }
      const reader = res.body.getReader();
      const dec = new TextDecoder();
      let buf = "";
      let streamError = "";
      let lastPaint = 0;
      while (true) {
        const step = await reader.read();
        if (step.done) break;
        buf += dec.decode(step.value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop();
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (!trimmedLine.startsWith("data:")) continue;
          const data = trimmedLine.slice(5).trim();
          if (!data || data === "[DONE]") continue;
          try {
            const j = JSON.parse(data);
            if (j.error) { streamError = typeof j.error === "string" ? j.error : (j.error.message || "模型返回了错误"); continue; }
            if (j.hongui === "thinking") { thinkingSeen = true; continue; }
            const ch = j.choices && j.choices[0];
            if (ch && ch.finish_reason) finishReason = String(ch.finish_reason);
            const delta = ch && ch.delta;
            if (delta) {
              if (typeof delta.content === "string") assistant.content += delta.content;
              // 不向任何用户展示思考过程 / reasoning_content
            }
            if (j.usage) assistant.usage = j.usage;
          } catch { /* keep alive comments */ }
        }
        const now = Date.now();
        if (now - lastPaint > 60) { lastPaint = now; paintLast(); }
      }
      assistant.content = stripThinkClient(assistant.content || "").replace(/^\s+/, "");
      if (streamError && !assistant.content) {
        assistant.content = "模型返回了错误，请重试";
        assistant.error = true;
      } else if (!assistant.content && finishReason === "length") {
        assistant.content = "思考过长，已达到本次输出上限，请把问题拆小一些再试";
        assistant.error = true;
      } else if (!assistant.content) {
        assistant.content = "模型没有返回内容，请重试";
        assistant.error = true;
      }
      assistant.reasoning = "";
      if (!aiCfg.unlimited && !aiCfg.isAdmin && !assistant.error && aiCfg.guestRemaining != null) {
        aiCfg.guestRemaining = Math.max(0, Number(aiCfg.guestRemaining) - 1);
        aiCfg.guestUsed = (Number(aiCfg.guestUsed) || 0) + 1;
      }
      await idbPut(session).catch(() => {});
      await flushAdminSync(session.id);
      renderAi();
    } catch (e) {
      if (e.name === "AbortError") {
        assistant.content += assistant.content ? "\n\n（已停止）" : "已停止生成";
        toast("已停止");
      } else {
        assistant.content = assistant.content || "网络异常，请重试";
        assistant.error = true;
        toast("网络异常，请重试");
      }
      await idbPut(session).catch(() => {});
      await flushAdminSync(session.id);
      renderAi();
    } finally {
      if ($("stopBtn")) $("stopBtn").hidden = true;
      if ($("sendBtn")) $("sendBtn").disabled = false;
    }
  }
  function sessionToMd(s) {
    const lines = ["# " + (s.title || "对话"), ""];
    (s.messages || []).forEach((m) => {
      lines.push(m.role === "user" ? "## 我" : "## 助手", "", m.content || "", "");
    });
    lines.push("", "Powered by HONGUI", "版权所有 项宏");
    return lines.join("\n");
  }
  function dictate(textarea) {
    const Rec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Rec) return toast("当前浏览器不支持语音输入");
    const rec = new Rec();
    rec.lang = "zh-CN";
    rec.onresult = (e) => {
      let text = "";
      for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) text += e.results[i][0].transcript;
      if (text) textarea.value += text;
    };
    rec.onerror = () => toast("没有听清，请再试一次");
    rec.start();
  }
  function speakText(text) {
    if (!window.speechSynthesis) return toast("当前浏览器不支持朗读");
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(String(text || "").replace(/[#>*_`]/g, "").slice(0, 3000));
    u.lang = "zh-CN";
    window.speechSynthesis.speak(u);
  }
  function compressImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL("image/jpeg", 0.85));
      };
      img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("图片无法读取")); };
      img.src = url;
    });
  }
  function extractFrames(file) {
    return new Promise((resolve, reject) => {
      if (file.size > 50 * 1024 * 1024) return reject(new Error("视频超过 50MB，请换更短的片段"));
      const video = document.createElement("video");
      video.muted = true;
      video.playsInline = true;
      video.preload = "auto";
      const url = URL.createObjectURL(file);
      video.src = url;
      video.onloadedmetadata = () => {
        if (!Number.isFinite(video.duration) || video.duration > 60) {
          URL.revokeObjectURL(url);
          reject(new Error("只接受不超过 60 秒的视频"));
          return;
        }
        const count = Math.min(8, Math.max(1, Math.round(video.duration) || 1));
        const times = [];
        for (let i = 0; i < count; i++) times.push(Math.min(video.duration - 0.05, (video.duration * (i + 0.5)) / count));
        const frames = [];
        let idx = 0;
        video.onseeked = () => {
          const scale = Math.min(1, 1600 / Math.max(video.videoWidth || 1, video.videoHeight || 1));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round((video.videoWidth || 1) * scale));
          canvas.height = Math.max(1, Math.round((video.videoHeight || 1) * scale));
          canvas.getContext("2d").drawImage(video, 0, 0, canvas.width, canvas.height);
          frames.push(canvas.toDataURL("image/jpeg", 0.85));
          idx++;
          if (idx >= times.length) { URL.revokeObjectURL(url); resolve(frames); }
          else video.currentTime = Math.max(0, times[idx]);
        };
        video.currentTime = Math.max(0, times[0]);
      };
      video.onerror = () => { URL.revokeObjectURL(url); reject(new Error("视频无法读取")); };
    });
  }
  async function inflateBytes(data) {
    if (typeof DecompressionStream === "undefined") throw new Error("浏览器不能解压 PDF");
    try {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    } catch {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      return new Uint8Array(await new Response(stream).arrayBuffer());
    }
  }
  function unescapePdf(s) {
    if (s.length >= 2 && s.charCodeAt(0) === 254 && s.charCodeAt(1) === 255) {
      let u = "";
      for (let i = 2; i + 1 < s.length; i += 2) u += String.fromCharCode((s.charCodeAt(i) << 8) + s.charCodeAt(i + 1));
      return u;
    }
    return s.replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: "\n", r: "\r", t: "\t", b: "\b", f: "\f", "(": "(", ")": ")", "\\": "\\" }[c] || c))
      .replace(/\\([0-7]{1,3})/g, (_, o) => String.fromCharCode(parseInt(o, 8)));
  }
  async function extractPdfText(buffer) {
    const bytes = new Uint8Array(buffer);
    const latin = new TextDecoder("iso-8859-1");
    const raw = latin.decode(bytes);
    const chunks = [];
    let idx = 0;
    while ((idx = raw.indexOf("stream", idx)) !== -1) {
      const head = raw.slice(Math.max(0, idx - 240), idx);
      let start = idx + 6;
      if (raw.charCodeAt(start) === 13) start++;
      if (raw.charCodeAt(start) === 10) start++;
      const end = raw.indexOf("endstream", start);
      if (end < 0) break;
      let slice = bytes.subarray(start, end);
      while (slice.length && (slice[slice.length - 1] === 10 || slice[slice.length - 1] === 13)) slice = slice.subarray(0, slice.length - 1);
      let text = "";
      if (/FlateDecode/.test(head)) {
        try { text = latin.decode(await inflateBytes(slice)); } catch { text = ""; }
      } else if (!/Filter/.test(head)) text = latin.decode(slice);
      if (text) chunks.push(text);
      idx = end + 9;
    }
    const joined = chunks.join("\n");
    const out = [];
    const tj = /\(((?:\\.|[^\\)]){0,800})\)\s*Tj/g;
    let m;
    while ((m = tj.exec(joined))) out.push(unescapePdf(m[1]));
    const TJ = /\[((?:[^[\]]|\\\[|\\\]){0,4000})\]\s*TJ/g;
    while ((m = TJ.exec(joined))) {
      let line = "";
      const sm = /\(((?:\\.|[^\\)]){0,400})\)/g;
      let mm;
      while ((mm = sm.exec(m[1]))) line += unescapePdf(mm[1]);
      if (line) out.push(line);
    }
    const result = out.join("\n").replace(/[ \t]+\n/g, "\n").trim();
    if (!result) throw new Error("没有从 PDF 里提取到文字，可以改用文本文件");
    return result.slice(0, 80000);
  }
  async function pickFromDrive() {
    if (!me) return toast("登录后才能从网盘选择");
    let prefix = "";
    async function paint() {
      const data = await api("/api/drive/list?prefix=" + encodeURIComponent(prefix));
      const folders = (data.folders || []).map((f) => '<button type="button" data-folder="' + escapeHtml(relOf(f.key)) + '">' + escapeHtml(f.name) + "</button>").join("");
      const images = (data.files || []).filter((f) => /\.(png|jpe?g|gif|webp)$/i.test(f.name)).map((f) => '<button type="button" data-file="' + escapeHtml(f.key) + '">' + escapeHtml(f.name) + "</button>").join("");
      openModal('<h2>从网盘选择图片</h2><div class="row"><button type="button" id="upFolder">上级</button><span class="meta">' + escapeHtml(prefix || "根目录") + '</span></div><div class="row">' + folders + images + "</div>");
      $("upFolder").onclick = () => { prefix = prefix.split("/").slice(0, -1).join("/"); paint(); };
      document.querySelector("#modal").onclick = async (e) => {
        const folder = e.target.closest("[data-folder]");
        if (folder) { prefix = folder.getAttribute("data-folder"); paint(); return; }
        const file = e.target.closest("[data-file]");
        if (!file) return;
        const res = await fetch("/api/drive/file?key=" + encodeURIComponent(file.getAttribute("data-file")));
        const blob = await res.blob();
        const imageFile = new File([blob], "drive-image", { type: blob.type || "image/jpeg" });
        const url = await compressImage(imageFile);
        renderAi.pending = renderAi.pending || [];
        if (renderAi.pending.length >= 4) return toast("单次最多 4 张图片");
        renderAi.pending.push(url);
        closeModal();
        renderAi();
      };
    }
    try { await paint(); } catch (e) { toast(e.message); }
  }
  async function savePendingToDrive() {
    if (!me) return toast("登录后才能保存到网盘");
    const list = renderAi.pending || [];
    if (!list.length) return toast("没有待保存的图片");
    for (let i = 0; i < list.length; i++) {
      const blob = dataUrlToBlob(list[i]);
      const file = new File([blob], "ai-" + Date.now() + "-" + i + ".jpg", { type: "image/jpeg" });
      await uploadOne(file, "ai-uploads", () => {});
    }
    toast("已保存到网盘 ai-uploads");
  }

  async function renderSpeed() {
    document.title = "测速与 IP 质量 · 项宏";
    if (renderSpeed.abort) { try { renderSpeed.abort.abort(); } catch { /* ignore */ } }
    app.innerHTML = '<section class="spd">' +
      '<header class="page-hero reveal"><p class="kicker">Network · 网络诊断</p><h1 class="page-title">测速与 IP 质量</h1><p class="lede">测量浏览器到 Cloudflare 边缘节点的下载、上传、延迟与抖动。数据只经过本站，不调用第三方。</p></header>' +
      '<div class="spd-main glass strong reveal" style="--i:1">' +
        '<div class="spd-dial"><svg class="spd-svg" viewBox="0 0 240 200" aria-hidden="true"><path class="trk" d="M40 170 A100 100 0 1 1 200 170"/><path class="val" id="gArc" d="M40 170 A100 100 0 1 1 200 170"/></svg>' +
          '<div class="spd-read"><span class="spd-phase" id="gPhase">准备就绪</span><b id="gNum">—</b><span class="spd-unit" id="gUnit">Mbps</span></div></div>' +
        '<div class="spd-steps" id="spdSteps"><span data-s="lat">延迟</span><span data-s="down">下载</span><span data-s="up">上传</span></div>' +
        '<div class="spd-bar"><i id="spdProg"></i></div>' +
        '<div class="spd-ctl"><button type="button" class="primary lg" id="spdGo"><i class="ic ic-play" aria-hidden="true"></i><span>开始测速</span></button><button type="button" class="ghost" id="spdCopy" hidden><i class="ic ic-copy" aria-hidden="true"></i>复制结果</button></div>' +
        '<p class="meta spd-note" id="spdNote">约 10 秒，最多消耗约 100–300 MB 流量（视网速而定）。</p>' +
      '</div>' +
      '<div class="spd-cards reveal" style="--i:2">' +
        spdCard("down", "下载", "Mbps", "ic-download") + spdCard("up", "上传", "Mbps", "ic-upload") +
        spdCard("idle", "空闲延迟", "ms", "ic-clock") + spdCard("loaded", "负载延迟", "ms", "ic-activity") + spdCard("jit", "抖动", "ms", "ic-refresh") +
      '</div>' +
      '<section class="spd-grade glass strong reveal" id="spdGrade" style="--i:3" hidden></section>' +
      '<section class="ipq glass strong reveal" id="ipBox" style="--i:4" aria-labelledby="ipqT"><div class="ipq-head"><div><p class="kicker">IP Quality · IP 质量</p><h2 id="ipqT">你的连接</h2></div></div><div class="ipq-load"><span class="sk sk-line" style="width:60%"></span><span class="sk sk-line" style="width:40%"></span></div></section>' +
      '</section>';
    $("spdGo").onclick = () => { runSpeed().catch((e) => { if (!e || e.name !== "AbortError") { toast((e && e.message) || "测速中断"); spdIdle(); } }); };
    $("spdCopy").onclick = async () => {
      const r = renderSpeed.last; if (!r) return;
      const t = "HONGUI 测速 · " + new Date().toLocaleString() + "\n下载 " + r.down.toFixed(1) + " Mbps · 上传 " + r.up.toFixed(1) + " Mbps\n空闲延迟 " + r.idle.toFixed(0) + " ms · 负载延迟 " + r.loaded.toFixed(0) + " ms · 抖动 " + r.jit.toFixed(1) + " ms" + (renderSpeed.ip && renderSpeed.ip.colo ? "\n节点 " + renderSpeed.ip.colo : "");
      try { await navigator.clipboard.writeText(t); toast("结果已复制"); } catch { toast("复制失败"); }
    };
    spdArc(0);
    loadIp();
  }
  function spdCard(id, label, unit, ic) {
    return '<div class="spd-card glass" id="c-' + id + '"><span class="sc-h"><i class="ic ' + ic + '" aria-hidden="true"></i>' + label + '</span><b><span id="v-' + id + '">—</span><small>' + unit + '</small></b><span class="sc-sub" id="s-' + id + '">&nbsp;</span></div>';
  }
  function spdSet(id, v, sub, digits) {
    const el = $("v-" + id); if (!el) return;
    el.textContent = v == null || !isFinite(v) ? "—" : (v >= 100 && digits == null ? v.toFixed(0) : v.toFixed(digits == null ? 1 : digits));
    if (sub != null) { const s = $("s-" + id); if (s) s.textContent = sub; }
  }
  function spdFmt(v) { return v >= 1000 ? (v / 1000).toFixed(2) : v >= 100 ? v.toFixed(0) : v >= 10 ? v.toFixed(1) : v.toFixed(2); }
  function spdArc(mbps) {
    const arc = $("gArc"); if (!arc) return;
    const len = arc.getTotalLength ? arc.getTotalLength() : 520;
    const f = mbps <= 0 ? 0 : Math.min(1, Math.log10(1 + mbps) / Math.log10(1001));
    arc.style.strokeDasharray = len + " " + len;
    arc.style.strokeDashoffset = String(len * (1 - f));
  }
  function spdIdle() {
    const b = $("spdGo"); if (!b) return;
    b.disabled = false; b.querySelector("span").textContent = renderSpeed.last ? "重新测速" : "开始测速";
    b.querySelector(".ic").className = "ic " + (renderSpeed.last ? "ic-refresh" : "ic-play");
  }
  function spdStep(s) {
    document.querySelectorAll("#spdSteps [data-s]").forEach((el) => {
      const order = ["lat", "down", "up", "done"];
      const i = order.indexOf(el.getAttribute("data-s")), j = order.indexOf(s);
      el.className = i < j ? "done" : i === j ? "on" : "";
    });
  }
  function pct(arr, p) {
    if (!arr.length) return NaN;
    const a = arr.slice().sort((x, y) => x - y);
    const k = (a.length - 1) * p, lo = Math.floor(k), hi = Math.ceil(k);
    return a[lo] + (a[hi] - a[lo]) * (k - lo);
  }
  function spdRtt(entryName, t0, t1) {
    try {
      const es = performance.getEntriesByName(entryName);
      const e = es[es.length - 1];
      if (e && e.responseStart > 0 && e.requestStart > 0) { const v = e.responseStart - e.requestStart; if (v > 0) return v; }
    } catch { /* ignore */ }
    return t1 - t0;
  }
  async function spdPing(signal) {
    const u = location.origin + "/api/ping?r=" + Math.random().toString(36).slice(2);
    const t0 = performance.now();
    const r = await fetch(u, { cache: "no-store", signal });
    await r.arrayBuffer();
    const t1 = performance.now();
    if (!r.ok) throw new Error(r.status === 429 ? "测速过于频繁，请稍后再试" : "延迟测试失败");
    return spdRtt(u, t0, t1);
  }
  async function runSpeed() {
    if (renderSpeed.running) return;
    renderSpeed.running = true;
    const ctl = new AbortController(); renderSpeed.abort = ctl;
    const signal = ctl.signal;
    const btn = $("spdGo"); btn.disabled = true; btn.querySelector("span").textContent = "测速中…";
    $("spdCopy").hidden = true; $("spdGrade").hidden = true;
    ["down", "up", "idle", "loaded", "jit"].forEach((k) => { spdSet(k, null, "\u00a0"); const c = $("c-" + k); if (c) c.classList.remove("ok"); });
    try { performance.clearResourceTimings(); performance.setResourceTimingBufferSize(600); } catch { /* ignore */ }
    const T0 = performance.now();
    const prog = $("spdProg");
    const PLAN = { lat: 1.6, down: 5.0, up: 5.0 };
    const setProg = (phase, frac) => {
      const before = phase === "lat" ? 0 : phase === "down" ? PLAN.lat : PLAN.lat + PLAN.down;
      const total = PLAN.lat + PLAN.down + PLAN.up;
      if (prog) prog.style.width = Math.min(100, (before + PLAN[phase] * Math.min(1, frac)) / total * 100) + "%";
    };
    const num = $("gNum"), unit = $("gUnit"), phaseEl = $("gPhase");
    let shown = 0;
    const show = (v, u) => { shown = v; num.textContent = u === "ms" ? (isFinite(v) ? v.toFixed(0) : "—") : spdFmt(v); unit.textContent = u; spdArc(u === "ms" ? 0 : v); };
    let bytesUsed = 0;
    try {
      // ---------- 1. idle latency ----------
      spdStep("lat"); phaseEl.textContent = "空闲延迟";
      await spdPing(signal).catch((e) => { throw e; }); // warm-up (TLS / H2 connection)
      const idle = [];
      const tl = performance.now();
      while (idle.length < 20 && performance.now() - tl < PLAN.lat * 1000) {
        idle.push(await spdPing(signal));
        const med = pct(idle, 0.5); show(med, "ms"); spdSet("idle", med, null, 0);
        setProg("lat", (performance.now() - tl) / (PLAN.lat * 1000));
      }
      const idleMed = pct(idle, 0.5);
      let jit = 0; for (let i = 1; i < idle.length; i++) jit += Math.abs(idle[i] - idle[i - 1]);
      jit = idle.length > 1 ? jit / (idle.length - 1) : 0;
      spdSet("idle", idleMed, "最低 " + Math.min(...idle).toFixed(0) + " · P90 " + pct(idle, 0.9).toFixed(0) + " ms", 0);
      spdSet("jit", jit, idle.length + " 次采样", 1);
      // ---------- loaded latency sampler ----------
      const loaded = [];
      let loadOn = false;
      const loadLoop = async () => { while (loadOn && !signal.aborted) { try { loaded.push(await spdPing(signal)); } catch { break; } await new Promise((r) => setTimeout(r, 250)); } };
      // ---------- generic throughput phase ----------
      const phase = async (kind) => {
        const isDown = kind === "down";
        spdStep(kind); phaseEl.textContent = isDown ? "下载" : "上传";
        let total = 0, stop = false;
        const marks = []; // [t, bytes]
        const start = performance.now();
        const MAXT = PLAN[kind] * 1000, WARM = 900, WIN = 300;
        let size = isDown ? 256 * 1024 : 128 * 1024;
        const MAXSZ = 16 * 1024 * 1024;
        let streams = 1;
        const upBuf = isDown ? null : (() => { const b = new Uint8Array(MAXSZ); for (let o = 0; o < b.length; o += 65536) crypto.getRandomValues(b.subarray(o, Math.min(b.length, o + 65536))); return b; })();
        const xhrs = new Set();
        let fails = 0;
        const one = async () => {
          while (!stop && !signal.aborted) {
            const sz = size, t0 = performance.now();
            try {
            if (isDown) {
              const r = await fetch("/api/down?bytes=" + sz + "&r=" + Math.random().toString(36).slice(2), { cache: "no-store", signal });
              if (!r.ok) { try { r.body && r.body.cancel(); } catch { /* ignore */ } throw new Error(r.status === 429 ? "测速过于频繁，请稍后再试" : "下载测试失败"); }
              const rd = r.body.getReader();
              while (true) {
                const s = await rd.read();
                if (s.done) break;
                total += s.value.byteLength;
                if (stop) { try { rd.cancel(); } catch { /* ignore */ } break; }
              }
            } else {
              await new Promise((res, rej) => {
                const x = new XMLHttpRequest(); xhrs.add(x);
                let last = 0;
                x.open("POST", "/api/up?r=" + Math.random().toString(36).slice(2));
                x.setRequestHeader("Content-Type", "application/octet-stream");
                x.upload.onprogress = (e) => { total += e.loaded - last; last = e.loaded; };
                x.onload = () => { xhrs.delete(x); total += sz - last; last = sz; x.status === 200 ? res() : rej(new Error(x.status === 429 ? "测速过于频繁，请稍后再试" : "上传测试失败")); };
                x.onerror = () => { xhrs.delete(x); rej(new Error("上传测试失败")); };
                x.onabort = () => { xhrs.delete(x); res(); };
                x.send(upBuf.subarray(0, sz));
              });
            }
            fails = 0;
            } catch (e) {
              if (signal.aborted || stop || (e && e.name === "AbortError")) return;
              if (e && /频繁/.test(e.message || "")) throw e;
              /* transient error (proxy reset, 5xx): shrink the chunk and keep going */
              if (++fails > 6) throw e;
              size = Math.max(64 * 1024, size / 2);
              await new Promise((r) => setTimeout(r, 150));
              continue;
            }
            const dt = performance.now() - t0;
            if (dt < 400 && size < MAXSZ) size = Math.min(MAXSZ, size * 2);
            else if (dt > 1500 && size > 64 * 1024) size = Math.max(64 * 1024, size / 2);
          }
        };
        let pending = null;
        const workers = [one().catch((e) => { pending = e; })];
        const ticker = new Promise((resolve) => {
          const tick = () => {
            const now = performance.now(), el = now - start;
            marks.push([now, total]);
            // ramp up parallel streams once the first chunks are flowing
            if (streams < 4 && el > 250 * streams) { streams++; workers.push(one().catch((e) => { pending = e; })); }
            // current speed over the last WIN ms
            let k = marks.length - 1; while (k > 0 && now - marks[k][0] < WIN) k--;
            const cur = (total - marks[k][1]) * 8 / Math.max(1, now - marks[k][0]) / 1000;
            show(shown * 0.6 + cur * 0.4, "Mbps");
            setProg(kind, el / MAXT);
            // windowed samples after warm-up
            const samples = [];
            for (let i = 0; i < marks.length; i++) {
              if (marks[i][0] - start < WARM) continue;
              let j = i; while (j < marks.length - 1 && marks[j][0] - marks[i][0] < WIN) j++;
              if (marks[j][0] - marks[i][0] >= WIN * 0.8) samples.push((marks[j][1] - marks[i][1]) * 8 / (marks[j][0] - marks[i][0]) / 1000);
            }
            let stable = false;
            if (el > 3600 && samples.length > 14) {
              const recent = samples.slice(-8), m = pct(recent, 0.5), all = pct(samples, 0.5);
              stable = Math.abs(m - all) / Math.max(0.01, all) < 0.05 && (pct(recent, 0.9) - pct(recent, 0.1)) / Math.max(0.01, m) < 0.25;
            }
            if (pending || signal.aborted || el >= MAXT || stable) { stop = true; xhrs.forEach((x) => { try { x.abort(); } catch { /* ignore */ } }); resolve(samples); return; }
            setTimeout(tick, 100);
          };
          setTimeout(tick, 100);
        });
        const samples = await ticker;
        if (pending && samples.length < 4) throw pending;
        if (signal.aborted) throw new DOMException("aborted", "AbortError");
        await Promise.race([Promise.allSettled(workers), new Promise((r) => setTimeout(r, 400))]);
        bytesUsed += total;
        const elapsed = (performance.now() - start) / 1000;
        const med = samples.length ? pct(samples, 0.5) : total * 8 / Math.max(0.2, elapsed) / 1e6;
        return { mbps: med, p90: samples.length ? pct(samples, 0.9) : med, bytes: total, secs: elapsed, n: samples.length };
      };
      loadOn = true; const ll1 = loadLoop();
      const dn = await phase("down");
      spdSet("down", dn.mbps, "P90 " + spdFmt(dn.p90) + " · " + fmtBytes(dn.bytes));
      loadOn = false; await ll1;
      const loadedDown = loaded.slice();
      loadOn = true; const ll2 = loadLoop();
      const upr = await phase("up");
      spdSet("up", upr.mbps, "P90 " + spdFmt(upr.p90) + " · " + fmtBytes(upr.bytes));
      loadOn = false; await ll2;
      const loadedUp = loaded.slice(loadedDown.length);
      const ld = pct(loadedDown, 0.5), lu = pct(loadedUp, 0.5), lAll = pct(loaded, 0.5);
      spdSet("loaded", lAll, "下载时 " + (isFinite(ld) ? ld.toFixed(0) : "—") + " · 上传时 " + (isFinite(lu) ? lu.toFixed(0) : "—") + " ms", 0);
      const secs = (performance.now() - T0) / 1000;
      const r = { down: dn.mbps, up: upr.mbps, idle: idleMed, loaded: isFinite(lAll) ? lAll : idleMed, jit, secs, bytes: bytesUsed };
      renderSpeed.last = r;
      window.__lastSpeed = r;
      spdStep("done"); setProg("up", 1);
      phaseEl.textContent = "下载速度"; show(r.down, "Mbps");
      ["down", "up", "idle", "loaded", "jit"].forEach((k) => { const c = $("c-" + k); if (c) c.classList.add("ok"); });
      spdGrade(r);
      $("spdCopy").hidden = false;
      $("spdNote").textContent = "用时 " + secs.toFixed(1) + " 秒 · 传输 " + fmtBytes(bytesUsed) + " · 取预热后 300ms 窗口的中位数" + (renderSpeed.ip && renderSpeed.ip.colo ? " · 节点 " + renderSpeed.ip.colo : "");
    } finally {
      renderSpeed.running = false;
      spdIdle();
    }
  }
  function spdGrade(r) {
    const box = $("spdGrade"); if (!box) return;
    const lvl = (good, ok) => good ? ["good", "流畅"] : ok ? ["ok", "可用"] : ["bad", "吃力"];
    const rows = [
      ["4K 流媒体", lvl(r.down >= 25 && r.loaded < 250, r.down >= 15), "建议下载 ≥ 25 Mbps"],
      ["视频通话", lvl(r.down >= 6 && r.up >= 4 && r.idle < 100 && r.jit < 30, r.down >= 3 && r.up >= 1.5 && r.idle < 200), "上下行各几 Mbps，延迟与抖动要低"],
      ["在线游戏", lvl(r.idle < 50 && r.jit < 15 && r.loaded < 120, r.idle < 100 && r.jit < 30), "看延迟与抖动，而不是带宽"],
      ["网页与社交", lvl(r.down >= 10 && r.idle < 120, r.down >= 3), "日常浏览、图片与短视频"]
    ];
    const score = rows.reduce((s, x) => s + (x[1][0] === "good" ? 2 : x[1][0] === "ok" ? 1 : 0), 0);
    const overall = score >= 7 ? "优秀" : score >= 5 ? "良好" : score >= 3 ? "一般" : "较差";
    box.innerHTML = '<div class="gr-head"><div><p class="kicker">Summary · 结果</p><h2>网络质量：' + overall + '</h2></div><span class="gr-badge g' + score + '">' + overall + "</span></div>" +
      '<div class="gr-rows">' + rows.map((x) => '<div class="gr-row ' + x[1][0] + '"><i class="dot" aria-hidden="true"></i><b>' + x[0] + "</b><span>" + x[1][1] + '</span><small>' + x[2] + "</small></div>").join("") + "</div>" +
      '<p class="meta">结果反映浏览器到 Cloudflare 边缘的路径；访问境外或经由代理的站点时，实际体验可能不同。</p>';
    box.hidden = false;
  }
  async function loadIp() {
    const box = $("ipBox"); if (!box) return;
    let d;
    try { d = await api("/api/ipinfo"); } catch (e) { box.innerHTML = '<div class="ipq-head"><div><p class="kicker">IP Quality · IP 质量</p><h2>你的连接</h2></div></div><p class="meta">' + escapeHtml(e.message || "读取失败") + "</p>"; return; }
    renderSpeed.ip = d;
    let region = d.country || "";
    try { if (d.country && Intl.DisplayNames) region = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(d.country) || d.country; } catch { /* ignore */ }
    const btz = (() => { try { return Intl.DateTimeFormat().resolvedOptions().timeZone || ""; } catch { return ""; } })();
    const tzOff = (tz) => { try { const s = new Date().toLocaleString("en-US", { timeZone: tz, timeZoneName: "shortOffset" }); const m = /GMT([+-]\d+(?::\d+)?)?/.exec(s); return m ? (m[1] || "+0") : ""; } catch { return ""; } };
    const tzSame = !d.timezone || !btz ? null : (d.timezone === btz || tzOff(d.timezone) === tzOff(btz));
    const langs = (navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language || ""]).filter(Boolean);
    const LANG_OF = { CN: ["zh"], TW: ["zh"], HK: ["zh", "en"], MO: ["zh", "pt"], SG: ["en", "zh", "ms", "ta"], US: ["en", "es"], GB: ["en"], JP: ["ja"], KR: ["ko"], DE: ["de"], FR: ["fr"], RU: ["ru"], CA: ["en", "fr"], AU: ["en"], MY: ["ms", "en", "zh"] };
    const want = LANG_OF[d.country];
    const langOk = !want ? null : langs.some((l) => want.includes(String(l).toLowerCase().split("-")[0]));
    const checks = [];
    const add = (state, title, detail) => checks.push({ state, title, detail });
    add(d.net.type === "dc" ? "bad" : d.net.confidence === "低" ? "warn" : "good", "网络类型：" + d.net.label, d.net.reasons.join("；") + "（可信度" + d.net.confidence + "）");
    add(tzSame == null ? "na" : tzSame ? "good" : "warn", "时区一致性", "IP 所在时区 " + (d.timezone || "未知") + "，浏览器时区 " + (btz || "未知") + (tzSame === false ? "，两者不同（常见于代理 / VPN 或出差）" : ""));
    add(langOk == null ? "na" : langOk ? "good" : "warn", "浏览器语言", langs.slice(0, 3).join("、") + (langOk == null ? "（该地区不做判断）" : langOk ? "，与 IP 所在地区相符" : "，与 IP 所在地区的常用语言不符"));
    add("pending", "WebRTC 泄漏", "检测中…");
    if (d.botScore != null) add(d.botScore >= 30 ? "good" : "warn", "Cloudflare 机器人评分", d.botScore + " / 99（越高越像真人）");
    if (d.threatScore != null) add(d.threatScore < 10 ? "good" : "warn", "Cloudflare 威胁评分", String(d.threatScore));
    const facts = [
      ["IP 地址", d.ip + " · " + d.ipVersion, true],
      ["位置", [region, d.region, d.city].filter(Boolean).join(" · ") || "未知"],
      ["ASN", d.asn ? "AS" + d.asn : "未知"],
      ["运营商", d.asOrganization || "未知"],
      ["Cloudflare 节点", d.colo || "未知"],
      ["协议", [d.httpProtocol, d.tlsVersion].filter(Boolean).join(" · ") || "未知"],
      ["TCP 往返", d.clientTcpRtt != null && d.clientTcpRtt > 0 ? d.clientTcpRtt + " ms（边缘测得）" : "不可用"],
      ["时区", (d.timezone || "未知") + (btz && btz !== d.timezone ? " · 浏览器 " + btz : "")]
    ];
    const paint = () => {
      let score = 100;
      checks.forEach((c) => { if (c.state === "bad") score -= c.title.startsWith("网络类型") ? 45 : 25; else if (c.state === "warn") score -= c.title.startsWith("网络类型") ? 12 : c.title === "浏览器语言" ? 6 : 12; });
      score = Math.max(0, Math.min(100, score));
      const lab = score >= 85 ? "干净" : score >= 65 ? "一般" : "可疑";
      box.innerHTML = '<div class="ipq-head"><div><p class="kicker">IP Quality · IP 质量</p><h2 id="ipqT">你的连接</h2><p class="meta">' + escapeHtml(d.net.label) + " · " + escapeHtml(d.asOrganization || "") + '</p></div>' +
        '<div class="ipq-score" style="--p:' + score + '"><b>' + score + '</b><span>' + lab + '</span></div></div>' +
        '<p class="ipq-est"><i class="ic ic-info" aria-hidden="true"></i><span>综合分是根据以下检查得出的<b>估算</b>，不是权威信誉评分。</span></p>' +
        '<dl class="ipq-facts">' + facts.map((f) => '<div' + (f[2] ? ' class="wide"' : "") + '><dt>' + f[0] + "</dt><dd>" + escapeHtml(String(f[1])) + "</dd></div>").join("") + "</dl>" +
        '<ul class="ipq-checks">' + checks.map((c) => '<li class="' + c.state + '"><i class="dot" aria-hidden="true"></i><div><b>' + escapeHtml(c.title) + "</b><span>" + escapeHtml(c.detail) + "</span></div></li>").join("") + "</ul>" +
        '<p class="meta">数据来源：' + escapeHtml(d.source) + "；WebRTC、时区与语言检查在你的浏览器本地完成。</p>";
    };
    paint();
    detectRtc(d.ip).then((res) => { const c = checks.find((x) => x.title === "WebRTC 泄漏"); if (c) { c.state = res.state; c.detail = res.detail; } if ($("ipBox") === box) paint(); });
  }
  function detectRtc(pub) {
    return new Promise((resolve) => {
      if (!window.RTCPeerConnection) return resolve({ state: "na", detail: "浏览器不支持或已禁用 WebRTC，无泄漏风险" });
      const ips = new Set();
      let pc, done = false;
      const fin = () => {
        if (done) return; done = true;
        try { pc.close(); } catch { /* ignore */ }
        const list = [...ips];
        const isPriv = (ip) => /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|127\.|169\.254\.|100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|fd|fe80|::1)/i.test(ip);
        const pubs = list.filter((ip) => !isPriv(ip) && !/\.local$/i.test(ip) && ip !== "0.0.0.0");
        const other = pubs.filter((ip) => ip !== pub);
        if (!list.length) resolve({ state: "good", detail: "没有暴露任何地址" });
        else if (other.length) resolve({ state: "warn", detail: "WebRTC 暴露了另一个公网地址 " + other.join("、") + "，与出口 IP 不同（使用代理 / VPN 时可能泄漏真实地址）" });
        else resolve({ state: "good", detail: pubs.length ? "暴露的公网地址与出口 IP 一致" : "只暴露了内网或 mDNS 匿名地址" });
      };
      try {
        pc = new RTCPeerConnection({ iceServers: [{ urls: "stun:stun.cloudflare.com:3478" }] });
        pc.createDataChannel("x");
        pc.onicecandidate = (e) => {
          if (!e.candidate) return fin();
          const m = /candidate:\S+ \d+ \S+ \d+ (\S+) /.exec(e.candidate.candidate || "");
          if (m) ips.add(m[1]);
        };
        pc.createOffer().then((o) => pc.setLocalDescription(o)).catch(fin);
      } catch { return resolve({ state: "na", detail: "WebRTC 检测失败" }); }
      setTimeout(fin, 3000);
    });
  }

  async function renderAdmin() {
    document.title = "管理后台 · 项宏";
    if (!me) {
      try { me = await api("/api/auth/me?soft=1"); if (!me || !me.user) me = null; } catch { me = null; }
    }
    const q = new URLSearchParams(location.search);
    const tab = q.get("tab") || "posts";
    if (!me) {
      app.innerHTML = '<section class="glass strong pad"><p class="brandline">Powered by HONGUI</p><h1>登录后台</h1><p class="muted">开发者：项宏。密码只发到服务器，不会写进浏览器本地存储。</p><form id="loginForm" class="poster-form"><label>账号<input name="user" autocomplete="username" required></label><label>密码<input name="pass" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">登录</button></form><p id="loginErr" class="warn"></p></section>';
      $("loginForm").onsubmit = async (e) => {
        e.preventDefault();
        const fd = new FormData(e.target);
        try {
          await api("/api/auth/login", { method: "POST", body: JSON.stringify({ user: fd.get("user"), pass: fd.get("pass") }) });
          me = { user: fd.get("user") };
          navigate(safeNext(q.get("next") || "/admin"));
        } catch (err) { $("loginErr").textContent = err.message; }
      };
      return;
    }
    const tabs = [["posts", "文章"], ["edit", "写作"], ["images", "图片"], ["about", "关于"], ["values", "价值观"], ["bg", "背景"], ["ai", "AI 设置"], ["music", "音乐"], ["stats", "统计"]];
    app.innerHTML = '<section class="admin"><div class="row">' + tabs.map((t) => '<button type="button" data-tab="' + t[0] + '" aria-pressed="' + (tab === t[0] ? "true" : "false") + '">' + t[1] + "</button>").join("") + '<a class="btn" href="/drive">网盘</a><button type="button" id="logoutBtn">退出</button></div><div id="adminMain" class="glass strong pad"></div></section>';
    document.querySelectorAll("[data-tab]").forEach((b) => b.onclick = () => navigate("/admin?tab=" + b.getAttribute("data-tab")));
    $("logoutBtn").onclick = async () => { await api("/api/auth/logout", { method: "POST", body: "{}" }); me = null; navigate("/admin"); };
    const main = $("adminMain");
    if (tab === "posts") {
      const data = await api("/api/admin/posts");
      main.innerHTML = '<div class="row"><a class="btn primary" href="/admin?tab=edit">写新文章</a><button type="button" id="exportBtn">导出 JSON 备份</button><button type="button" id="importBtn">导入备份</button><input id="importFile" type="file" accept="application/json" hidden></div><div class="adm-posts">' +
        ((data.posts || []).length ? (data.posts || []).map((p) => '<div class="adm-post"><a class="adm-thumb" href="/admin?tab=edit&id=' + escapeHtml(p.id) + '" tabindex="-1" aria-hidden="true">' + (p.cover ? '<img src="' + escapeHtml(coverSrc(p.cover).replace(/-1600\.webp$/, "-800.webp")) + '" alt="" loading="lazy" decoding="async">' : '<i class="ic ic-image"></i>') + '</a><div class="adm-main"><b>' + escapeHtml(p.title) + '</b><span class="meta"><span class="st-dot ' + (p.status === "published" ? "on" : "") + '"></span>' + (p.status === "published" ? "已发布" : "草稿") + " · " + escapeHtml(p.category || "") + " · 阅读 " + (p.views || 0) + " · 赞 " + (p.likes || 0) + (p.publishedAt ? " · " + escapeHtml(fmtDate(p.publishedAt).slice(0, 10)) : "") + '</span></div><div class="adm-act">' + (p.status === "published" ? '<a class="btn ghost mini" href="/post/' + escapeHtml(p.id) + '" target="_blank" rel="noopener">查看</a>' : "") + '<a class="btn mini" href="/admin?tab=edit&id=' + escapeHtml(p.id) + '">编辑</a><button type="button" class="mini danger" data-del="' + escapeHtml(p.id) + '">删除</button></div></div>').join("") : '<p class="meta">还没有文章。</p>') +
        "</div>";
      $("exportBtn").onclick = async () => {
        const backup = await api("/api/admin/export");
        saveBlob(new Blob([JSON.stringify(backup.backup, null, 2)], { type: "application/json" }), "hongui-backup.json");
      };
      $("importBtn").onclick = () => $("importFile").click();
      $("importFile").onchange = async () => {
        const file = $("importFile").files[0];
        if (!file) return;
        const backup = JSON.parse(await file.text());
        const replace = confirm("确定用备份覆盖同编号文章？取消则合并。");
        const res = await api("/api/admin/import", { method: "POST", body: JSON.stringify({ backup, replace }) });
        toast("导入 " + res.imported + " 篇，跳过 " + res.skipped);
        postsCache = null;
        renderAdmin();
      };
      main.onclick = async (e) => {
        const id = e.target.getAttribute && e.target.getAttribute("data-del");
        if (!id) return;
        if (!confirm("删除这篇文章？")) return;
        await api("/api/admin/post/" + id, { method: "DELETE" });
        postsCache = null;
        renderAdmin();
      };
    } else if (tab === "edit") {
      let post = { title: "", category: CATS[0], cover: "", summary: "", content: "", status: "draft" };
      if (q.get("id")) post = (await api("/api/admin/post/" + encodeURIComponent(q.get("id")))).post;
      main.innerHTML = '<div class="grid-2"><div class="poster-form"><label>标题<input id="f-title" value="' + escapeHtml(post.title) + '"></label><label>分类<select id="f-cat">' + CATS.map((c) => '<option' + (c === post.category ? " selected" : "") + ">" + escapeHtml(c) + "</option>").join("") + '</select></label><div class="cov-ed"><div class="cov-prev" id="covPrev"></div><div class="cov-side"><label>封面 R2 Key<input id="f-cover" value="' + escapeHtml(post.cover || "") + '" placeholder="blog/..."></label><div class="row"><label class="btn ghost filebtn" for="coverFile2"><i class="ic ic-image" aria-hidden="true"></i>上传 / 更换封面</label><input id="coverFile2" type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden><button type="button" class="mini" id="covClear">移除封面</button></div><p class="meta">自动裁成 16:9 并生成 1600 / 800 两种 WebP 尺寸。</p></div></div><label>摘要<textarea id="f-sum">' + escapeHtml(post.summary || "") + '</textarea></label><label>Markdown 正文<textarea id="f-body" style="min-height:280px">' + escapeHtml(post.content || "") + '</textarea></label><div class="row"><button type="button" id="saveDraft">保存草稿</button><button type="button" class="primary" id="publishBtn">立即发布</button><button type="button" id="aiSum">AI 生成摘要</button><button type="button" id="aiPolish">AI 润色</button></div></div><div><h2>预览</h2><div class="md" id="preview"></div></div></div>';
      const paint = () => { $("preview").innerHTML = renderMarkdown($("f-body").value); };
      paint();
      $("f-body").oninput = paint;
      async function save(status) {
        const body = { id: post.id, title: $("f-title").value, category: $("f-cat").value, cover: $("f-cover").value, summary: $("f-sum").value, content: $("f-body").value };
        const path = status === "published" ? "/api/admin/publish" : "/api/admin/draft";
        const res = await api(path, { method: "POST", body: JSON.stringify(body) });
        post = res.post;
        postsCache = null;
        toast(status === "published" ? "已发布" : "草稿已保存");
        navigate("/admin?tab=edit&id=" + post.id);
      }
      $("saveDraft").onclick = () => save("draft").catch((e) => toast(e.message));
      $("publishBtn").onclick = () => save("published").catch((e) => toast(e.message));
      $("aiSum").onclick = async () => {
        try {
          const res = await api("/api/admin/ai", { method: "POST", body: JSON.stringify({ action: "summary", title: $("f-title").value, content: $("f-body").value }) });
          $("f-sum").value = res.text;
        } catch (e) { toast(e.message); }
      };
      $("aiPolish").onclick = async () => {
        try {
          const res = await api("/api/admin/ai", { method: "POST", body: JSON.stringify({ action: "polish", content: $("f-body").value }) });
          if (confirm("用润色结果替换正文？")) { $("f-body").value = res.text; paint(); }
        } catch (e) { toast(e.message); }
      };
      const covPaint = () => {
        const k = $("f-cover").value.trim();
        $("covPrev").innerHTML = k ? '<img src="' + escapeHtml(coverSrc(k)) + '" alt="封面预览">' : '<span class="meta">暂无封面</span>';
      };
      covPaint();
      $("f-cover").addEventListener("change", covPaint);
      $("covClear").onclick = () => { $("f-cover").value = ""; covPaint(); };
      $("coverFile2").onchange = async () => {
        const file = $("coverFile2").files[0];
        $("coverFile2").value = "";
        if (!file) return;
        try {
          toast("正在处理封面…");
          const bmp = await new Promise((res, rej) => { const u = URL.createObjectURL(file), im = new Image(); im.onload = () => { URL.revokeObjectURL(u); res(im); }; im.onerror = () => { URL.revokeObjectURL(u); rej(new Error("图片无法读取")); }; im.src = u; });
          const pair = [...crypto.getRandomValues(new Uint8Array(8))].map((b) => b.toString(16).padStart(2, "0")).join("");
          const W = bmp.naturalWidth, Hh = bmp.naturalHeight, ar = 16 / 9;
          let sw = W, sh = Math.round(W / ar); if (sh > Hh) { sh = Hh; sw = Math.round(Hh * ar); }
          const sx = Math.round((W - sw) / 2), sy = Math.round((Hh - sh) / 2);
          let okAll = true;
          for (const tw of [1600, 800]) {
            const cv = document.createElement("canvas"); cv.width = tw; cv.height = Math.round(tw / ar);
            const cx = cv.getContext("2d"); cx.imageSmoothingQuality = "high"; cx.drawImage(bmp, sx, sy, sw, sh, 0, 0, cv.width, cv.height);
            const blob = await new Promise((r) => cv.toBlob(r, "image/webp", tw === 1600 ? 0.82 : 0.8));
            if (!blob || blob.type !== "image/webp") { okAll = false; break; }
            await xhrSend("POST", "/api/admin/upload?name=cover&pair=" + pair + "&w=" + tw, blob, { "Content-Type": "image/webp" });
          }
          if (okAll) { $("f-cover").value = "blog/covers/" + pair + "-1600.webp"; covPaint(); toast("封面已上传，保存后生效"); return; }
          if (file.size > 5 * 1024 * 1024) return toast("浏览器不支持 WebP 转换，且原图超过 5MB");
          const res = await xhrSend("POST", "/api/admin/upload?name=" + encodeURIComponent(file.name), file, { "Content-Type": file.type || "application/octet-stream" });
          $("f-cover").value = res.key; covPaint(); toast("封面已上传，保存后生效");
        } catch (e) { toast(e.message || "封面上传失败"); }
      };
      if ($("coverFile")) $("coverFile").onchange = async () => {
        const file = $("coverFile").files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast("图片不能超过 5MB");
        try {
          const res = await xhrSend("POST", "/api/admin/upload?name=" + encodeURIComponent(file.name), file, { "Content-Type": file.type || "application/octet-stream" });
          $("f-cover").value = res.key;
          toast("封面已上传");
        } catch (e) { toast(e.message); }
      };
    } else if (tab === "images") {
      const data = await api("/api/admin/images");
      main.innerHTML = '<div class="drop" id="imgDrop">拖拽或选择 jpg、png、webp、gif，单张不超过 5MB<input id="imgUp" type="file" accept="image/png,image/jpeg,image/webp,image/gif"></div><div class="masonry" id="imgGrid">' +
        (data.images || []).map((img) => '<article class="card"><img src="' + escapeHtml(img.urlPath) + '" alt="' + escapeHtml(img.key) + '"><div class="body"><p class="meta">' + escapeHtml(img.key) + '</p><button type="button" data-copy-key="' + escapeHtml(img.key) + '">复制 Key</button> <button type="button" data-del-img="' + escapeHtml(img.key) + '">删除</button></div></article>').join("") +
        "</div>";
      async function upload(file) {
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return toast("图片不能超过 5MB");
        await xhrSend("POST", "/api/admin/upload?name=" + encodeURIComponent(file.name), file, { "Content-Type": file.type || "application/octet-stream" });
        toast("已上传");
        renderAdmin();
      }
      $("imgUp").onchange = () => upload($("imgUp").files[0]);
      $("imgDrop").addEventListener("dragover", (e) => e.preventDefault());
      $("imgDrop").addEventListener("drop", (e) => { e.preventDefault(); upload(e.dataTransfer.files[0]); });
      main.onclick = async (e) => {
        const key = e.target.getAttribute("data-copy-key");
        const del = e.target.getAttribute("data-del-img");
        if (key) { await navigator.clipboard.writeText(key); toast("已复制 Key"); }
        if (del) {
          if (!confirm("删除这张图片？")) return;
          await api("/api/admin/images?key=" + encodeURIComponent(del), { method: "DELETE" });
          renderAdmin();
        }
      };
    } else if (tab === "about") {
      const data = await api("/api/about");
      main.innerHTML = '<label>关于页 Markdown<textarea id="aboutBox" style="min-height:240px">' + escapeHtml(data.content || "") + '</textarea></label><button type="button" class="primary" id="saveAbout">保存</button><div class="md" id="aboutPrev"></div>';
      const paint = () => { $("aboutPrev").innerHTML = renderMarkdown($("aboutBox").value); };
      paint();
      $("aboutBox").oninput = paint;
      $("saveAbout").onclick = async () => { await api("/api/admin/about", { method: "POST", body: JSON.stringify({ content: $("aboutBox").value }) }); toast("已保存"); };
    } else if (tab === "values") {
      const data = await api("/api/values");
      const values = data.values || [];
      main.innerHTML = values.map((v, i) => '<label>标题<input data-vt="' + i + '" value="' + escapeHtml(v.title) + '"></label><label>正文<textarea data-vx="' + i + '">' + escapeHtml(v.text) + "</textarea></label>").join("") + '<button type="button" class="primary" id="saveValues">保存价值观</button>';
      $("saveValues").onclick = async () => {
        const next = values.map((_, i) => ({ title: main.querySelector('[data-vt="' + i + '"]').value, text: main.querySelector('[data-vx="' + i + '"]').value }));
        await api("/api/admin/values", { method: "POST", body: JSON.stringify({ values: next }) });
        toast("已保存");
      };
    } else if (tab === "bg") {
      const cur = (await api("/api/bg")).bg;
      const names = { preset: "预设", color: "纯色", img: "图片" };
      const H = window.HBG;
      main.innerHTML = '<p class="meta">设置全站默认背景：访客没有自己选过背景时使用。访客仍可在顶部“背景”按钮里自行切换（只保存在他们的浏览器里）。当前：' + (cur ? names[cur.k] + " " + escapeHtml(cur.id || cur.c || cur.url) : "未设置（内置默认）") + '</p>' +
        '<label>类型<select id="bgK"><option value="preset">预设</option><option value="color">纯色</option><option value="img">图片（站内 /image/ 路径）</option></select></label>' +
        '<label>预设<select id="bgId">' + H.order.map((id) => '<option value="' + id + '">' + H.presets[id].n + "</option>").join("") + '</select></label>' +
        '<label>颜色<input type="color" id="bgC" value="#4a90d9"></label>' +
        '<label>图片路径<input id="bgU" placeholder="/image/blog/xxx.jpg"></label>' +
        '<label>图片明暗<select id="bgT"><option value="light">偏亮（文字用深色）</option><option value="dark">偏暗（文字用浅色）</option></select></label>' +
        '<div class="row"><button type="button" class="primary" id="bgSave">保存为全站默认</button><button type="button" id="bgClr">清除默认</button></div>';
      if (cur) { $("bgK").value = cur.k; if (cur.id) $("bgId").value = cur.id; if (cur.c) $("bgC").value = cur.c; if (cur.url) $("bgU").value = cur.url; if (cur.tone) $("bgT").value = cur.tone; }
      $("bgSave").onclick = async () => {
        const k = $("bgK").value;
        const bg = k === "preset" ? { k, id: $("bgId").value } : k === "color" ? { k, c: $("bgC").value } : { k, url: $("bgU").value.trim(), tone: $("bgT").value };
        try { await api("/api/admin/bg", { method: "POST", body: JSON.stringify({ bg }) }); toast("已保存，刷新页面生效"); renderAdmin(); } catch (e) { toast(e.message); }
      };
      $("bgClr").onclick = async () => { await api("/api/admin/bg", { method: "POST", body: JSON.stringify({ bg: null }) }); toast("已清除"); renderAdmin(); };
    } else if (tab === "ai") {
      const cfg = await api("/api/admin/ai");
      const c = cfg.config;
      const ids = ["general", "image"];
      const chatIds = ["general"];
      const names = { general: "通用", image: "画图" };
      const st = {};
      ids.forEach((id) => { st[id] = Object.assign({}, c.tiers[id]); });
      let cur = "general";
      const opt = (v, sel) => '<option value="' + v + '"' + (sel === v ? " selected" : "") + ">" + names[v] + "</option>";
      main.innerHTML = '<p class="meta">两个档位：「通用」走 OpenAI 兼容的 /chat/completions（流式），「画图」走 NVIDIA genai 图像接口。密钥只放在 Cloudflare 加密 Worker Secret（AI_KEY_GENERAL / AI_KEY_IMAGE），不保存在 KV、不返回页面。模型的思考过程对任何人（包括管理员）都不展示。</p>' +
        '<div class="row" id="tierTabs">' + ids.map((id) => '<button type="button" data-t="' + id + '" aria-pressed="false">' + names[id] + "</button>").join("") + '</div>' +
        '<label>粘贴一段配置（JSON、Node / Python / curl 示例代码都可以），识别模型、地址与参数后填入当前档位（密钥不会从这里保存）<textarea id="paste" placeholder="例如包含 baseURL、model、temperature、max_tokens 的代码"></textarea></label><button type="button" id="parsePaste">识别并填入当前档位</button>' +
        '<div class="grid-2"><label>模型名称<input id="aiModel"></label><label id="baseLabel">API 地址<input id="aiBase"></label></div>' +
        '<p class="meta" id="keyState" role="status"></p>' +
        '<div id="chatFields"><div class="grid-2"><label>temperature<input id="aiTemp" type="number" min="0" max="2" step="0.1"></label><label>top_p（0 表示不传）<input id="aiTopP" type="number" min="0" max="1" step="0.05"></label><label>max_tokens<input id="aiMax" type="number" min="64" max="32768" step="64"></label></div>' +
        '<label class="row"><input id="aiImg" type="checkbox" style="width:auto"> 此档支持图片输入</label><label class="row"><input id="aiStream" type="checkbox" style="width:auto"> 此档使用流式输出</label></div>' +
        '<div id="imgFields"><div class="grid-2"><label>steps（1–100）<input id="aiSteps" type="number" min="1" max="100" step="1"></label></div><p class="meta">尺寸：1:1 = 1024×1024，16:9 = 1344×768，9:16 = 768×1344；seed 每次随机。只接受文字描述，每生成一张计 1 次。</p></div>' +
        '<hr><h2>全局设置</h2><div class="grid-2"><label>AI 页默认档位<select id="aiDefTier">' + ids.map((id) => opt(id, c.defaultTier)).join("") + '</select></label><label>后台「摘要 / 润色」使用档位<select id="aiAdminTier">' + chatIds.map((id) => opt(id, c.adminTier)).join("") + '</select></label></div>' +
        '<label class="row"><input id="aiGuest" type="checkbox"' + (c.allowGuest ? " checked" : "") + ' style="width:auto"> 允许游客使用 AI（可自选通用 / 画图，会消耗你的额度；画图每张计 1 次）</label><label class="row"><input id="aiGuestImg" type="checkbox"' + (c.guestImages ? " checked" : "") + ' style="width:auto"> 允许游客发送图片给模型看（通用）</label><div class="grid-2"><label>游客默认档位（游客仍可选全部档位）<select id="aiGuestTier">' + ids.map((id) => opt(id, c.guestTier)).join("") + '</select></label><label>游客每日次数上限（管理员无限制）<input id="aiLimit" type="number" min="1" max="200" value="' + escapeHtml(String(c.guestDailyLimit)) + '"></label></div>' +
        '<label>默认系统提示词<textarea id="aiSys">' + escapeHtml(c.systemPrompt || "") + "</textarea></label>" +
        MODES.map((m) => "<label>" + m.label + '提示词<textarea data-mode="' + m.id + '">' + escapeHtml((c.modePrompts && c.modePrompts[m.id]) || "") + "</textarea></label>").join("") +
        '<div class="row"><button type="button" class="primary" id="saveAi">保存全部档位</button><button type="button" id="testAi">测试当前档位连接</button></div><p id="aiOut" class="meta" role="status"></p>';
      const sv = (id) => $(id);
      const isImg = (id) => id === "image";
      function stash() {
        const t = st[cur];
        t.model = sv("aiModel").value.trim();
        t.baseUrl = sv("aiBase").value.trim();
        if (isImg(cur)) t.steps = sv("aiSteps").value;
        else {
          t.temperature = sv("aiTemp").value;
          t.topP = sv("aiTopP").value;
          t.maxTokens = sv("aiMax").value;
          t.supportsImages = sv("aiImg").checked;
          t.stream = sv("aiStream").checked;
        }
      }
      function load() {
        const t = st[cur];
        const img = isImg(cur);
        sv("aiModel").value = t.model || "";
        sv("aiBase").value = t.baseUrl || "";
        $("baseLabel").firstChild.textContent = img ? "API 地址（到 /genai 为止，后面自动接模型名）" : "API 地址（到 /v1 为止）";
        $("chatFields").hidden = img;
        $("imgFields").hidden = !img;
        if (img) sv("aiSteps").value = t.steps;
        else {
          sv("aiTemp").value = t.temperature;
          sv("aiTopP").value = t.topP;
          sv("aiMax").value = t.maxTokens;
          sv("aiImg").checked = !!t.supportsImages;
          sv("aiStream").checked = !!t.stream;
        }
        $("keyState").textContent = names[cur] + "档密钥：" + (t.hasKey ? "已配置 " + (t.apiKeyMasked || "") + "（加密 Worker Secret " + t.secretName + "）" : "未配置密钥 — 请在 Cloudflare 设置加密 Secret " + t.secretName + "（npx wrangler secret put " + t.secretName + "）");
        document.querySelectorAll("#tierTabs [data-t]").forEach((b) => b.setAttribute("aria-pressed", b.getAttribute("data-t") === cur ? "true" : "false"));
      }
      document.querySelectorAll("#tierTabs [data-t]").forEach((b) => { b.onclick = () => { stash(); cur = b.getAttribute("data-t"); load(); }; });
      load();
      $("parsePaste").onclick = () => {
        const p = parseAiPaste($("paste").value);
        const got = [];
        const img = isImg(cur);
        if (p.model) { sv("aiModel").value = p.model; got.push("模型"); }
        if (p.baseUrl) { sv("aiBase").value = p.baseUrl; got.push("地址"); }
        if (!img) {
          if (p.temperature != null) { sv("aiTemp").value = p.temperature; got.push("temperature"); }
          if (p.topP != null) { sv("aiTopP").value = p.topP; got.push("top_p"); }
          if (p.maxTokens != null) { sv("aiMax").value = p.maxTokens; got.push("max_tokens"); }
          if (p.stream != null) { sv("aiStream").checked = p.stream; got.push("stream"); }
          if (p.vision) { sv("aiImg").checked = true; got.push("图片输入"); }
        }
        $("paste").value = "";
        toast((got.length ? "已填入当前档位：" + got.join("、") + "（记得点保存）" : "没有识别到可用内容") + (p.apiKey ? "。密钥不会从这里保存，请用加密 Worker Secret" : ""));
      };
      $("saveAi").onclick = async () => {
        stash();
        const modePrompts = {};
        main.querySelectorAll("[data-mode]").forEach((el) => { modePrompts[el.getAttribute("data-mode")] = el.value; });
        const tiers = {};
        ids.forEach((id) => {
          const t = st[id];
          tiers[id] = isImg(id)
            ? { model: t.model, baseUrl: t.baseUrl, steps: t.steps }
            : { model: t.model, baseUrl: t.baseUrl, temperature: t.temperature, topP: t.topP, maxTokens: t.maxTokens, supportsImages: !!t.supportsImages, stream: !!t.stream };
        });
        try {
          const res = await api("/api/admin/ai/settings", { method: "POST", body: JSON.stringify({
            tiers, modePrompts,
            defaultTier: $("aiDefTier").value, adminTier: $("aiAdminTier").value, guestTier: $("aiGuestTier").value,
            allowGuest: $("aiGuest").checked, guestImages: $("aiGuestImg").checked, guestDailyLimit: Number($("aiLimit").value), systemPrompt: $("aiSys").value
          }) });
          ids.forEach((id) => { st[id] = Object.assign({}, res.config.tiers[id]); });
          load();
          $("aiOut").textContent = "已保存。" + ids.map((id) => names[id] + (res.config.tiers[id].hasKey ? " 密钥已配置" : " 未配置密钥")).join(" · ");
        } catch (e) { $("aiOut").textContent = e.message; }
      };
      $("testAi").onclick = async () => {
        stash();
        const t = st[cur];
        $("aiOut").textContent = isImg(cur) ? "正在测试（会生成一张小测试图，约 10–60 秒）…" : "正在测试…";
        try {
          const res = await api("/api/admin/ai/test", { method: "POST", body: JSON.stringify({ tier: cur, override: { model: t.model, baseUrl: t.baseUrl } }) });
          $("aiOut").textContent = names[cur] + "档：" + res.message + " · " + (res.model || "") + (res.reply ? " · " + (isImg(cur) ? "" : "回复：") + res.reply : "");
        } catch (e) { $("aiOut").textContent = names[cur] + "档：" + e.message; }
      };
    } else if (tab === "music") {
      const data = await api("/api/admin/music");
      const cfg = data.config || { enabled: false, autoplay: true, loop: true, volume: 0.35, current: "" };
      const tracks = data.tracks || [];
      main.innerHTML = '<p class="meta">上传一首或多首背景音乐（mp3 / m4a / ogg / wav，单文件 ≤15MB）。设为默认会自动启用。访客可静音，偏好保存在浏览器。</p>' +
        '<div class="row"><label class="row">启用站点音乐 <input id="mEn" type="checkbox"' + (cfg.enabled ? " checked" : "") + ' style="width:auto"></label>' +
        '<label class="row">开屏进入后尝试自动播放 <input id="mAp" type="checkbox"' + (cfg.autoplay !== false ? " checked" : "") + ' style="width:auto"></label>' +
        '<label class="row">循环播放 <input id="mLoop" type="checkbox"' + (cfg.loop !== false ? " checked" : "") + ' style="width:auto"></label>' +
        '<label>音量（0–1）<input id="mVol" type="number" min="0" max="1" step="0.05" value="' + escapeHtml(String(cfg.volume != null ? cfg.volume : 0.35)) + '" style="width:100px"></label>' +
        '<button type="button" class="primary" id="mSave">保存设置</button></div>' +
        '<div class="drop" id="mDrop">拖放音频到这里，或 <label class="filebtn" style="display:inline">选择文件<input id="mUp" type="file" accept="audio/mpeg,audio/mp4,audio/ogg,audio/wav,.mp3,.m4a,.ogg,.wav" hidden></label></div>' +
        '<p id="mProg" class="meta" hidden></p>' +
        '<table class="table"><thead><tr><th>曲目</th><th>大小</th><th>默认</th><th></th></tr></thead><tbody>' +
        (tracks.length ? tracks.map((t) => "<tr><td>" + escapeHtml(t.name) + '</td><td>' + fmtBytes(t.size) + '</td><td><button type="button" data-cur="' + escapeHtml(t.key) + '"' + (t.current ? ' aria-pressed="true"' : "") + '>' + (t.current ? "正在播放" : "设为默认") + '</button></td><td><button type="button" class="danger" data-mdel="' + escapeHtml(t.key) + '">删除</button> <a href="' + escapeHtml(t.url) + '" target="_blank" rel="noopener">试听</a></td></tr>').join("") : '<tr><td colspan="4">还没有上传音乐</td></tr>') +
        "</tbody></table>";
      async function saveCfg(extra) {
        const body = {
          enabled: (extra && extra.enableOnCurrent) ? true : $("mEn").checked,
          autoplay: $("mAp").checked,
          loop: $("mLoop").checked,
          volume: Number($("mVol").value),
          current: (extra && extra.current != null) ? extra.current : (cfg.current || ""),
          enableOnCurrent: !!(extra && extra.enableOnCurrent)
        };
        if (extra && extra.enableOnCurrent) body.enabled = true;
        const res = await api("/api/admin/music/settings", { method: "POST", body: JSON.stringify(body) });
        Object.assign(cfg, res.config || body);
        if ($("mEn") && cfg.enabled) $("mEn").checked = true;
        toast("已保存");
        if (window.__honguiMusic && window.__honguiMusic.reload) window.__honguiMusic.reload();
      }
      $("mSave").onclick = () => saveCfg().then(() => renderAdmin()).catch((e) => toast(e.message));
      async function uploadMusic(file) {
        if (!file) return;
        const prog = $("mProg");
        prog.hidden = false;
        prog.textContent = "上传中…";
        try {
          await xhrSend("POST", "/api/admin/music/upload?name=" + encodeURIComponent(file.name), file, { "Content-Type": file.type || "application/octet-stream" }, (loaded, total) => {
            prog.textContent = "上传中 " + Math.round(loaded / Math.max(1, total) * 100) + "%";
          });
          toast("已上传");
          renderAdmin();
          if (window.__honguiMusic && window.__honguiMusic.reload) window.__honguiMusic.reload();
        } catch (e) { toast(e.message || "上传失败"); prog.hidden = true; }
      }
      $("mUp").onchange = () => { uploadMusic($("mUp").files[0]); $("mUp").value = ""; };
      const drop = $("mDrop");
      drop.addEventListener("dragover", (e) => { e.preventDefault(); drop.style.outline = "2px solid var(--accent)"; });
      drop.addEventListener("dragleave", () => { drop.style.outline = ""; });
      drop.addEventListener("drop", (e) => { e.preventDefault(); drop.style.outline = ""; uploadMusic(e.dataTransfer.files[0]); });
      main.onclick = async (e) => {
        const cur = e.target.getAttribute && e.target.getAttribute("data-cur");
        const del = e.target.getAttribute && e.target.getAttribute("data-mdel");
        if (cur) {
          try { await saveCfg({ current: cur, enableOnCurrent: true }); renderAdmin(); } catch (err) { toast(err.message); }
        }
        if (del) {
          if (!confirm("删除这首音乐？")) return;
          try {
            await api("/api/admin/music?key=" + encodeURIComponent(del), { method: "DELETE" });
            toast("已删除");
            renderAdmin();
            if (window.__honguiMusic && window.__honguiMusic.reload) window.__honguiMusic.reload();
          } catch (err) { toast(err.message); }
        }
      };
    } else if (tab === "stats") {
      const s = await api("/api/admin/stats");
      main.innerHTML = '<div class="stats"><p>总访问量 ' + s.visits + "</p><p>文章 " + s.posts + " · 已发布 " + s.published + "</p><p>阅读合计 " + s.views + " · 点赞合计 " + s.likes + "</p><p class=\"meta\">" + escapeHtml(s.note || "") + "</p><h2>热门文章</h2><ul>" +
        (s.top || []).map((p) => "<li><a href=\"/post/" + escapeHtml(p.id) + "\">" + escapeHtml(p.title) + "</a> · 阅读 " + p.views + " · 赞 " + p.likes + "</li>").join("") +
        "</ul></div>";
    }
  }
  function parseAiPaste(text) {
    const raw = String(text || "").trim();
    const out = { model: "", baseUrl: "", apiKey: "", temperature: null, topP: null, maxTokens: null, reasoningEffort: "", stream: null, vision: false };
    if (!raw) return out;
    const isPlaceholder = (v) => !v || /^\$|^<|^your[-_ ]|^xxx|\{\{|process\.env|os\.environ/i.test(v);
    const fixBase = (u) => String(u || "").trim().replace(/\/+$/, "").replace(/\/chat\/completions$/i, "");
    let j = null;
    try { j = JSON.parse(raw); } catch { j = null; }
    if (j && typeof j === "object" && !Array.isArray(j)) {
      out.model = String(j.model || j.AI_MODEL || j.modelName || "");
      out.baseUrl = fixBase(j.baseUrl || j.baseURL || j.base_url || j.AI_BASE_URL || j.apiBase || j.url || "");
      out.apiKey = String(j.apiKey || j.api_key || j.AI_API_KEY || j.key || "");
      if (isPlaceholder(out.apiKey)) out.apiKey = "";
      if (j.temperature != null) out.temperature = Number(j.temperature);
      if (j.top_p != null) out.topP = Number(j.top_p);
      if (j.max_tokens != null) out.maxTokens = Number(j.max_tokens);
      if (j.reasoning_effort) out.reasoningEffort = String(j.reasoning_effort).toLowerCase();
      if (typeof j.stream === "boolean") out.stream = j.stream;
      out.vision = /image_url/.test(raw);
      return out;
    }
    const pick = (re) => { const m = re.exec(raw); return m ? m[1] : ""; };
    let base = pick(/base_?url["']?\s*[:=]\s*["'`]([^"'`]+)["'`]/i) || pick(/invokeUrl\s*=\s*["'`]([^"'`]+)["'`]/i);
    if (!base) {
      const urls = raw.match(/https?:\/\/[^\s"'`,)\\]+/gi) || [];
      base = urls.find((u) => /chat\/completions/i.test(u)) || urls.find((u) => !/\.(png|jpe?g|gif|webp|svg)(\?|$)/i.test(u)) || "";
    }
    out.baseUrl = fixBase(base);
    out.model = pick(/["']?\bmodel["']?\s*[:=]\s*["'`]([^"'`]+)["'`]/i) || pick(/(?:model|模型)\s*[:：=]\s*([^\s,;"']+)/i);
    let key = pick(/\b((?:nvapi|sk|sk-ant|gsk)-[A-Za-z0-9_\-]{10,})/) || pick(/Bearer\s+([A-Za-z0-9_\-.]{16,})/) || pick(/api_?key["']?\s*[:=]\s*["'`]([^"'`]+)["'`]/i);
    if (isPlaceholder(key)) key = "";
    out.apiKey = key;
    const num = (re) => { const v = pick(re); return v === "" ? null : Number(v); };
    out.temperature = num(/["']?temperature["']?\s*[:=]\s*([0-9.]+)/i);
    out.topP = num(/["']?top_p["']?\s*[:=]\s*([0-9.]+)/i);
    out.maxTokens = num(/["']?max_tokens["']?\s*[:=]\s*(\d+)/i);
    out.reasoningEffort = pick(/["']?reasoning_effort["']?\s*[:=]\s*["'`](\w+)["'`]/i).toLowerCase();
    const sm = pick(/["']?\bstream["']?\s*[:=]\s*(true|false)/i);
    out.stream = sm ? sm === "true" : null;
    out.vision = /image_url/.test(raw);
    return out;
  }

  function bootSplash() {
    const el = $("splash");
    if (!el) return;
    if (document.documentElement.classList.contains("splash-done")) {
      el.hidden = true;
      if (window.__honguiMusic && window.__honguiMusic.onEntered) window.__honguiMusic.onEntered();
      return;
    }
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      try { sessionStorage.setItem("hongui_splash_done", "1"); } catch { /* ignore */ }
      document.documentElement.classList.add("splash-done");
      el.classList.add("out");
      pageEnter();
      requestAnimationFrame(() => { moveInd(document.querySelector(".top .nav"), true); moveInd($("chips"), true); });
      setTimeout(() => { el.hidden = true; }, 750);
      try { window.dispatchEvent(new Event("hongui-splash-done")); } catch (e) { /* ignore */ }
      if (window.__honguiMusic && window.__honguiMusic.onEntered) window.__honguiMusic.onEntered();
    };
    const enter = $("enterSplash");
    const skip = $("skipSplash");
    if (enter) enter.onclick = finish;
    if (skip) skip.onclick = finish;
    fetch("/api/visitor").then((r) => r.json()).then((d) => {
      if ($("sp-ip")) $("sp-ip").textContent = d.ip || "未知";
      if ($("sp-city")) $("sp-city").textContent = d.city || "未知";
      if ($("sp-region")) $("sp-region").textContent = d.region || "未知";
      if ($("sp-country")) { let c = d.country || ""; try { if (/^[A-Z]{2}$/.test(c)) c = new Intl.DisplayNames(["zh-CN"], { type: "region" }).of(c) + "（" + c + "）"; } catch { /* keep code */ } $("sp-country").textContent = c || "未知"; }
    }).catch(() => {});
  }
  (function initSiteMusic() {
    if (AIHOST) return;
    const MUTE_KEY = "hongui_music_mute";
    let audio = null;
    let cfg = null;
    let tracks = [];
    let trackIdx = 0;
    let ctl = null;
    let playBtn = null;
    let muteBtn = null;
    let nextBtn = null;
    let label = null;
    let entered = false;
    let wantPlay = false;
    let unlockBound = false;
    function muted() {
      try { return localStorage.getItem(MUTE_KEY) === "1"; } catch { return false; }
    }
    function setMuted(v) {
      try { localStorage.setItem(MUTE_KEY, v ? "1" : "0"); } catch { /* ignore */ }
      if (audio) audio.muted = !!v;
      if (muteBtn) { muteBtn.textContent = v ? "🔇" : "🔊"; muteBtn.setAttribute("data-s", v ? "off" : "on"); }
      if (muteBtn) muteBtn.setAttribute("aria-label", v ? "取消静音" : "静音");
    }
    function prettyTrackName(n) {
      let s = String(n || "").replace(/^.*\//, "").replace(/\.[a-z0-9]+$/i, "");
      s = s.replace(/^[0-9a-f]{8,}[-_]?/i, "").replace(/^obj_[^\s._-]+[_-]?/i, "");
      s = s.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
      if (!s || /^[0-9a-f\s-]{12,}$/i.test(s)) return "背景音乐";
      if (s.length > 16) s = s.slice(0, 14) + "…";
      return s;
    }
    function syncPlayUi() {
      const on = !!(audio && !audio.paused);
      if (playBtn) {
        playBtn.textContent = on ? "❚❚" : "▶";
        playBtn.setAttribute("data-s", on ? "pause" : "play");
        playBtn.setAttribute("aria-label", on ? "暂停音乐" : "播放音乐");
      }
      if (nextBtn) nextBtn.hidden = tracks.length < 2;
      if (ctl) ctl.classList.toggle("need-tap", !!(cfg && cfg.enabled && cfg.url && audio && audio.paused && wantPlay));
      if (label && cfg && cfg.enabled) {
        if (audio && audio.paused && wantPlay) label.textContent = "点按播放";
        else label.textContent = prettyTrackName(cfg.name) || "背景音乐";
      }
    }
    function applyTrack(t, autoPlay) {
      if (!t || !audio || !cfg) return;
      cfg.current = t.key || "";
      cfg.url = t.url || "";
      cfg.name = t.name || "";
      audio.dataset.key = cfg.current;
      audio.src = cfg.url;
      audio.loop = cfg.loop !== false;
      audio.muted = muted();
      syncPlayUi();
      if (autoPlay && wantPlay && !muted()) {
        audio.play().catch(() => bindUnlock());
      }
    }
    function playNext() {
      if (!tracks.length || !audio || !cfg || !cfg.enabled) return;
      trackIdx = (trackIdx + 1) % tracks.length;
      applyTrack(tracks[trackIdx], true);
      wantPlay = true;
      syncPlayUi();
    }
    function bindUnlock() {
      if (unlockBound) return;
      unlockBound = true;
      const unlock = async () => {
        if (!wantPlay || !audio || !cfg || !cfg.enabled || muted()) return;
        if (!audio.paused) return;
        try {
          await audio.play();
          syncPlayUi();
        } catch { /* still blocked */ }
      };
      ["pointerdown", "touchstart", "click", "keydown"].forEach((ev) => {
        document.addEventListener(ev, unlock, { capture: true, passive: true });
      });
    }
    function ensureCtl() {
      if (ctl) return;
      ctl = document.createElement("div");
      ctl.id = "musicCtl";
      ctl.hidden = true;
      ctl.innerHTML = '<button type="button" id="musicPlay" aria-label="播放音乐">▶</button><button type="button" id="musicMute" aria-label="静音">🔊</button><button type="button" id="musicNext" aria-label="下一首">⏭</button><span class="mlbl" id="musicLbl"></span>';
      const slot = document.getElementById("musicSlot") || document.querySelector(".top-mid");
      const splashOn = !document.documentElement.classList.contains("splash-done") && document.getElementById("splash") && !document.getElementById("splash").hidden;
      const mountCtl = () => {
        if (ctl.parentNode) return;
        const mid = document.getElementById("musicSlot") || document.querySelector(".top-mid");
        if (mid) mid.appendChild(ctl);
        else {
          const a = document.querySelector(".top .wrap .actions");
          if (a && a.parentNode) a.parentNode.insertBefore(ctl, a); else document.body.appendChild(ctl);
        }
      };
      if (splashOn) {
        ctl.style.visibility = "hidden";
        const place = () => { ctl.style.visibility = ""; mountCtl(); };
        window.addEventListener("hongui-splash-done", place, { once: true });
        /* keep node detached until splash ends */
      } else mountCtl();
      playBtn = ctl.querySelector("#musicPlay");
      muteBtn = ctl.querySelector("#musicMute");
      nextBtn = ctl.querySelector("#musicNext");
      label = ctl.querySelector("#musicLbl");
      playBtn.onclick = async () => {
        if (!audio) return;
        try {
          if (audio.paused) { await audio.play(); wantPlay = true; }
          else { audio.pause(); wantPlay = false; }
        } catch {
          wantPlay = true;
          bindUnlock();
        }
        syncPlayUi();
        ctl.hidden = false;
      };
      muteBtn.onclick = () => setMuted(!muted());
      nextBtn.onclick = () => playNext();
      setMuted(muted());
    }
    function showCtl() {
      ensureCtl();
      if (!cfg || !cfg.enabled || !cfg.url) { ctl.hidden = true; return; }
      const splashOn = !document.documentElement.classList.contains("splash-done") && document.getElementById("splash") && !document.getElementById("splash").hidden;
      if (splashOn) {
        ctl.hidden = true;
        window.addEventListener("hongui-splash-done", () => { if (cfg && cfg.enabled && cfg.url) { ctl.hidden = false; syncPlayUi(); } }, { once: true });
        return;
      }
      ctl.hidden = false;
      syncPlayUi();
    }
    async function tryAutoplay() {
      if (!audio || !cfg || !cfg.enabled || !cfg.url) {
        syncPlayUi();
        return;
      }
      if (!cfg.autoplay || muted()) {
        wantPlay = !!cfg.autoplay && !muted();
        showCtl();
        if (wantPlay) bindUnlock();
        syncPlayUi();
        return;
      }
      wantPlay = true;
      bindUnlock();
      try {
        await audio.play();
      } catch {
        /* autoplay blocked — control visible, first tap retries */
      }
      showCtl();
      syncPlayUi();
    }
    async function load() {
      try {
        const res = await api("/api/music");
        cfg = res && res.config ? res.config : null;
        tracks = Array.isArray(res && res.tracks) ? res.tracks.filter((t) => t && t.url && t.key) : [];
        trackIdx = 0;
        if (cfg && cfg.current) {
          const found = tracks.findIndex((t) => t.key === cfg.current);
          trackIdx = found >= 0 ? found : 0;
        }
        if (!cfg || !cfg.enabled || !cfg.url) {
          if (ctl) ctl.hidden = true;
          if (audio) { audio.pause(); audio.removeAttribute("src"); }
          wantPlay = false;
          return;
        }
        ensureCtl();
        if (!audio) {
          audio = new Audio();
          audio.preload = "auto";
          audio.addEventListener("play", syncPlayUi);
          audio.addEventListener("pause", syncPlayUi);
          audio.addEventListener("ended", () => {
            if (cfg && cfg.loop !== false && wantPlay) {
              audio.currentTime = 0;
              audio.play().catch(() => bindUnlock());
            }
            syncPlayUi();
          });
        }
        audio.loop = cfg.loop !== false;
        const next = cfg.url;
        if (audio.dataset.key !== cfg.current) {
          audio.dataset.key = cfg.current || "";
          audio.src = next;
        }
        audio.volume = Math.min(1, Math.max(0, Number(cfg.volume) || 0.35));
        audio.muted = muted();
        showCtl();
        if (entered) tryAutoplay();
      } catch {
        if (ctl) ctl.hidden = true;
      }
    }
    window.__honguiMusic = {
      onEntered() {
        entered = true;
        tryAutoplay();
      },
      reload: load
    };
    load();
  })();
  document.addEventListener("click", async (e) => {
    if (e.target && e.target.id === "modalClose") { closeModal(); return; }
    const copy = e.target.closest && e.target.closest("[data-copy]");
    if (copy) {
      const code = copy.closest(".codewrap") && copy.closest(".codewrap").querySelector("code");
      if (code) {
        try { await navigator.clipboard.writeText(code.textContent || ""); toast("已复制"); }
        catch { toast("复制失败"); }
      }
      return;
    }
    const theme = e.target.closest && e.target.closest("#themeBtn");
    if (theme) {
      const next = document.documentElement.getAttribute("data-theme") === "dark" ? "light" : "dark";
      const applyTheme = () => {
        document.documentElement.setAttribute("data-theme", next);
        try { localStorage.setItem("hongui_theme", next); } catch { /* ignore */ }
        theme.setAttribute("aria-pressed", next === "dark" ? "true" : "false");
        if (window.HBG) window.HBG.refresh();
      };
      if (document.startViewTransition && !reducedMotion() && !ROOT.getAttribute("data-vt")) {
        const r = theme.getBoundingClientRect();
        ROOT.style.setProperty("--vx", Math.round(r.left + r.width / 2) + "px");
        ROOT.style.setProperty("--vy", Math.round(r.top + r.height / 2) + "px");
        ROOT.setAttribute("data-vt", "theme");
        try {
          const tr = document.startViewTransition(applyTheme);
          tr.finished.catch(() => {}).finally(() => { if (ROOT.getAttribute("data-vt") === "theme") ROOT.removeAttribute("data-vt"); });
        } catch (err) { ROOT.removeAttribute("data-vt"); applyTheme(); }
      } else applyTheme();
      return;
    }
    const a = e.target.closest && e.target.closest("a");
    if (!a || a.target || a.hasAttribute("download")) return;
    if (a.origin !== location.origin) return;
    const path = a.pathname || "";
    if (path.startsWith("/api/") || path.startsWith("/image/") || path.startsWith("/music/") || path.startsWith("/bg/") || path.startsWith("/s/") || path === "/sitemap.xml" || path === "/robots.txt" || path === "/favicon.svg" || path === "/manifest.webmanifest") return;
    e.preventDefault();
    navSource = a;
    navigate(a.pathname + a.search);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "/" && !e.metaKey && !e.ctrlKey && !e.altKey) {
      const tg = e.target && e.target.tagName;
      if (tg !== "INPUT" && tg !== "TEXTAREA" && tg !== "SELECT" && !(e.target && e.target.isContentEditable)) {
        const q = $("q") || $("driveQ");
        if (q) { e.preventDefault(); q.focus(); q.select && q.select(); }
      }
    }
    if (e.key === "Escape") {
      closeModal();
      if (window.speechSynthesis) window.speechSynthesis.cancel();
    }
  });
  window.addEventListener("popstate", () => { runRoute("back"); });
  window.addEventListener("scroll", () => {
    const bar = $("progress");
    if (!bar || !location.pathname.startsWith("/post/")) { if (bar) bar.style.width = "0"; return; }
    const el = document.querySelector("#articleMd");
    if (!el) return;
    const total = Math.max(1, el.offsetHeight - window.innerHeight * 0.2);
    const seen = Math.min(Math.max(-el.getBoundingClientRect().top, 0), total);
    bar.style.width = (seen / total * 100) + "%";
  }, { passive: true });
  (function initHeaderCollapse() {
    const top = document.querySelector("header.top");
    const slot = top && top.parentNode;
    if (!top || !slot || !slot.classList.contains("topslot")) return;
    const COLLAPSE_Y = 120, COLLAPSE_DOWN = 8, EXPAND_Y = 20, EXPAND_UP = 24, MIN_DELTA = 4, LOCK_MS = 250;
    const CAP = 72, PAD = window.matchMedia("(max-width: 720px)").matches ? 14 : 18;
    let lastY = Math.max(0, window.scrollY || 0), accDown = 0, accUp = 0, ticking = false, slim = false, lockUntil = 0, lockTimer = 0, resizeTimer = 0, measuring = false, ro = null;
    function measure() {
      if (measuring || slim || top.classList.contains("slim") || performance.now() < lockUntil) return;
      if (!document.documentElement.classList.contains("splash-done") && document.getElementById("splash") && !document.getElementById("splash").hidden) {
        slot.style.height = "66px";
        slot.style.maxHeight = (CAP + PAD) + "px";
        slot.style.removeProperty("--topH");
        return;
      }
      measuring = true;
      try {
        /* Never write --topH onto .topslot: it inherits into .top .wrap min-height and
           creates a Safari (esp. iPad) ResizeObserver feedback loop that grows the header
           until it fills the screen. Spacer height is set directly and capped. */
        slot.style.removeProperty("--topH");
        const raw = Math.round(top.getBoundingClientRect().height);
        const h = Math.min(CAP, Math.max(40, raw > 20 ? raw : CAP));
        const slotH = Math.min(CAP + PAD, h + PAD);
        if (slot.dataset.h !== String(h)) {
          slot.dataset.h = String(h);
          slot.style.height = slotH + "px";
          slot.style.maxHeight = (CAP + PAD) + "px";
        }
      } finally {
        measuring = false;
      }
    }
    function setSlim(v) {
      slim = v; accDown = 0; accUp = 0;
      lockUntil = performance.now() + LOCK_MS;
      top.classList.toggle("slim", v);
      clearTimeout(lockTimer);
      lockTimer = setTimeout(() => { lastY = Math.max(0, window.scrollY || 0); accDown = 0; accUp = 0; measure(); }, LOCK_MS + 20);
    }
    function update() {
      ticking = false;
      const raw = window.scrollY || window.pageYOffset || 0;
      const maxY = Math.max(0, document.documentElement.scrollHeight - window.innerHeight);
      if (raw < 0 || raw > maxY + 1) { accDown = 0; accUp = 0; return; }
      const y = raw;
      if (performance.now() < lockUntil) { lastY = y; accDown = 0; accUp = 0; return; }
      if (slim && y < EXPAND_Y) { lastY = y; setSlim(false); return; }
      const dy = y - lastY;
      if (Math.abs(dy) < MIN_DELTA) return;
      lastY = y;
      if (y <= 0 || (maxY > 0 && y >= maxY)) { accDown = 0; accUp = 0; return; }
      if (dy > 0) { accDown += dy; accUp = 0; } else { accUp -= dy; accDown = 0; }
      if (!slim && y > COLLAPSE_Y && accDown >= COLLAPSE_DOWN) setSlim(true);
      else if (slim && accUp > EXPAND_UP) setSlim(false);
    }
    window.addEventListener("scroll", () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
    window.addEventListener("resize", () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(measure, 120); }, { passive: true });
    /* Observe wrap once for font/layout changes; ignore self-driven slot height writes. */
    if (window.ResizeObserver) {
      const wrap = top.querySelector(".wrap") || top;
      let lastW = 0;
      ro = new ResizeObserver((entries) => {
        if (measuring) return;
        const w = entries[0] && entries[0].contentRect ? Math.round(entries[0].contentRect.width) : 0;
        if (w && w === lastW) return;
        lastW = w;
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(measure, 80);
      });
      ro.observe(wrap);
    }
    measure();
    update();
    window.addEventListener("hongui-splash-done", () => {
      slot.style.removeProperty("height");
      slot.style.removeProperty("max-height");
      slot.style.removeProperty("--topH");
      slot.dataset.h = "";
      setTimeout(measure, 30);
      setTimeout(measure, 320);
    });
  })();
  (function initBgUi() {
    const btn = $("bgBtn");
    if (!btn || !window.HBG) return;
    const H = window.HBG;
    window.HBG_onerr = (m) => toast(m);
    H.init();
    let pop = null;
    function swatch(id) {
      const p = H.presets[id];
      const th = p.ph ? '<img src="/bg/' + id + '-t.webp" alt="" loading="lazy" decoding="async" width="160" height="100">' : '<i style="background:linear-gradient(135deg,' + p.a[0] + "," + p.a[1] + ')"></i>';
      return '<button type="button" class="bgsw" data-bgp="' + id + '" aria-pressed="false" title="' + p.n + '">' + th + "<span>" + p.n + "</span></button>";
    }
    function build() {
      pop = document.createElement("div");
      pop.id = "bgpop"; pop.className = "glass strong"; pop.setAttribute("role", "dialog"); pop.setAttribute("aria-label", "背景设置"); pop.hidden = true;
      pop.innerHTML = '<div class="bgh"><strong>背景</strong><button type="button" class="mini" id="bgClose" aria-label="关闭">✕</button></div>' +
        '<div class="bggrid">' + H.order.map(swatch).join("") + "</div>" +
        '<button type="button" class="mini bgreset" data-bgp="__site">恢复站点默认</button>' +
        '<label class="bgrow">自定义颜色<input type="color" id="bgColor" value="#4a90d9" aria-label="自定义背景颜色"></label>' +
        '<div class="bgrow2"><label>自定义图片（路径如 /image/blog/xx.jpg）<input id="bgUrl" placeholder="/image/blog/xxx.jpg" autocomplete="off"></label><button type="button" class="mini" id="bgUrlGo">应用</button></div>' +
        '<div class="bgrow2"><label class="filebtn">选择本地图片<input type="file" id="bgFile" accept="image/*" hidden></label><span class="meta">只保存在你自己的浏览器里，不会上传</span></div>' +
        '<label class="bgrow"><span>自动轮换风景（每 30 秒，渐变过渡）</span><input type="checkbox" id="bgAuto" class="switch" role="switch"></label>' +
        '<p class="meta">风景照片来自 Wikimedia Commons，遵循各自的 CC 许可，<a href="/about#credits">查看来源</a>。</p>' +
        '<p class="meta" id="bgNote"></p>';
      document.body.appendChild(pop);
      pop.addEventListener("click", (e) => {
        const t = e.target.closest("button, label.filebtn");
        if (!t) return;
        if (t.id === "bgClose") return close();
        const id = t.getAttribute("data-bgp");
        if (id) { id === "__site" ? H.reset() : H.preset(id); sync(); }
        if (t.id === "bgUrlGo") { const u = $("bgUrl").value.trim(); if (!H.url(u)) toast("请填写 /image/ 开头的路径"); else setTimeout(sync, 400); }
      });
      $("bgColor").addEventListener("input", (e) => { H.color(e.target.value); });
      $("bgColor").addEventListener("change", () => sync());
      $("bgFile").addEventListener("change", async (e) => {
        const f = e.target.files && e.target.files[0];
        e.target.value = "";
        if (!f) return;
        try { await H.file(f); toast("背景已更换"); sync(); } catch (err) { toast(err.message || "图片处理失败"); }
      });
      $("bgAuto").addEventListener("change", (e) => { H.auto(e.target.checked); sync(); });
    }
    function sync() {
      if (!pop) return;
      const c = H.cfg();
      pop.querySelectorAll("[data-bgp]").forEach((b) => {
        const id = b.getAttribute("data-bgp");
        if (id === "__site") return;
        const eff = c || H.effective();
        b.setAttribute("aria-pressed", (!!eff && eff.k === "preset" && (eff.id === id || (!H.presets[eff.id] && id === "default"))) ? "true" : "false");
      });
      $("bgAuto").checked = !!(c && c.auto);
      $("bgAuto").disabled = H.reduced();
      if (c && c.k === "color") $("bgColor").value = c.c;
      $("bgNote").textContent = H.reduced() ? "系统已开启“减少动态效果”，自动切换已停用。" : (c ? "当前为你自己选择的背景。" : "当前使用站点默认背景。");
    }
    function place() {
      const h = document.querySelector("header.top");
      pop.style.top = (h ? Math.round(h.getBoundingClientRect().bottom) + 8 : 60) + "px";
    }
    window.__openBgPop = () => open();
    function open() {
      if (!pop) build();
      sync(); place(); pop.hidden = false; btn.setAttribute("aria-expanded", "true");
      const f = pop.querySelector('[aria-pressed="true"]') || pop.querySelector("button");
      if (f) f.focus();
    }
    function close() {
      if (!pop || pop.hidden) return;
      pop.hidden = true; btn.setAttribute("aria-expanded", "false"); btn.focus();
    }
    btn.addEventListener("click", () => { pop && !pop.hidden ? close() : open(); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") close(); });
    document.addEventListener("click", (e) => {
      if (!pop || pop.hidden) return;
      if (e.target.closest("#bgpop") || e.target.closest("#bgBtn")) return;
      pop.hidden = true; btn.setAttribute("aria-expanded", "false");
    });
    window.addEventListener("resize", () => { if (pop && !pop.hidden) place(); }, { passive: true });
    new MutationObserver(() => { if (pop && !pop.hidden) { pop.hidden = true; btn.setAttribute("aria-expanded", "false"); } }).observe(document.querySelector("header.top"), { attributes: true, attributeFilter: ["class"] });
  })();
  const themeBtn = $("themeBtn");
  if (themeBtn) themeBtn.setAttribute("aria-pressed", document.documentElement.getAttribute("data-theme") === "dark" ? "true" : "false");
  document.addEventListener("paste", (e) => { if (renderAi.paste && onAiView()) renderAi.paste(e); });
  document.addEventListener("click", (e) => {
    const t = e.target && e.target.closest ? e.target : null;
    if (!t) return;
    const j = t.closest("[data-jump]");
    if (j) {
      const el = $(j.getAttribute("data-jump"));
      if (el) { e.preventDefault(); e.stopPropagation(); el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" }); }
      return;
    }
    const cj = t.closest("[data-cat-jump]");
    if (cj && location.pathname === "/" && $("chips")) {
      e.preventDefault();
      e.stopPropagation();
      const c = cj.getAttribute("data-cat-jump") || "";
      const params = new URLSearchParams(location.search);
      params.set("cat", c);
      history.replaceState({}, "", "/?" + params.toString());
      syncHomeFilterUi(c, params.get("q") || "", { keepScroll: true });
      const el = $("posts");
      if (el) el.scrollIntoView({ behavior: reducedMotion() ? "auto" : "smooth", block: "start" });
      return;
    }
    if (t.closest("#menuBtn")) { e.preventDefault(); e.stopPropagation(); toggleDrawer(); return; }
    if (t.closest("#drawerClose") || t.closest("#drawerBd")) { e.preventDefault(); toggleDrawer(false); return; }
    const dbg = t.closest("[data-dbg]");
    if (dbg && window.HBG) { e.preventDefault(); window.HBG.preset(dbg.getAttribute("data-dbg")); syncDrawer(); return; }
    if (t.closest("#drawerBgMore")) { e.preventDefault(); e.stopPropagation(); toggleDrawer(false); setTimeout(() => { const b = $("bgBtn"); if (b) b.click(); }, 200); return; }
    if (t.closest("#navDrawer a")) toggleDrawer(false);
  }, true);
  document.addEventListener("change", (e) => {
    if (e.target && e.target.id === "drawerDark") {
      const want = e.target.checked ? "dark" : "light";
      if ((ROOT.getAttribute("data-theme") === "dark" ? "dark" : "light") !== want) { const tb = $("themeBtn"); if (tb) tb.click(); }
    }
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") toggleDrawer(false);
    if (e.key === "Tab" && ROOT.classList.contains("drawer-open")) {
      const dr = $("navDrawer"); const f = [...dr.querySelectorAll("a,button,input")].filter((x) => x.offsetParent !== null);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    }
  });
  window.addEventListener("resize", () => {
    clearTimeout(window.__indT);
    window.__indT = setTimeout(() => { moveInd(document.querySelector(".top .nav"), true); moveInd($("chips"), true); if (window.innerWidth >= 1100) toggleDrawer(false); }, 80);
  }, { passive: true });
  bootSplash();
  if (document.documentElement.classList.contains("splash-done") && window.__honguiMusic && window.__honguiMusic.onEntered) {
    window.__honguiMusic.onEntered();
  }
  api("/api/auth/me?soft=1").then((d) => { me = d && d.user ? d : null; }).catch(() => { me = null; }).finally(() => { renderRoute().then(() => { pageEnter(); requestAnimationFrame(() => { moveInd(document.querySelector(".top .nav"), true); }); }); });
}

function renderShell(meta) {
  const headers = baseHeaders();
  headers.set("Content-Type", "text/html; charset=utf-8");
  headers.set("Cache-Control", "no-store");
  const title = escapeHtml(meta.title);
  const desc = escapeHtml(meta.description);
  const canonical = escapeHtml(meta.origin + meta.path);
  const image = escapeHtml(meta.image || meta.origin + "/icon-512.png");
  const ld = meta.jsonLd ? '<script type="application/ld+json">' + JSON.stringify(meta.jsonLd).replace(/</g, "\\u003c") + "</script>" : "";
  const nonce = newNonce();
  const bgJson = JSON.stringify(meta.bg || null).replace(/</g, "\\u003c");
  headers.set("Content-Security-Policy", pageCsp(nonce));
  const aiHost = !!meta.aiHost;
  const aiO = escapeHtml(meta.aiOrigin || "https://ai.hongspaces.com");
  const mainO = escapeHtml(meta.mainOrigin || meta.origin);
  const htmlClass = aiHost ? "ai-route ai-host splash-done" : "";
  const year = Math.max(2026, new Date().getFullYear());
  const mark = LOGO_MARK_SVG.replace("<svg ", '<svg class="mark" role="img" aria-label="HONGUI 标志" ');
  const markDeco = LOGO_MARK_SVG.replace("<svg ", '<svg class="mark" aria-hidden="true" focusable="false" ');
  const headHtml = '<!DOCTYPE html><html lang="zh-CN"' + (htmlClass ? ' class="' + htmlClass + '"' : "") + (aiHost ? ' data-host="ai"' : "") + ' data-ai-origin="' + aiO + '" data-main-origin="' + mainO + '"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"><title>' + title + '</title><meta name="description" content="' + desc + '"><link rel="canonical" href="' + canonical + '"><meta property="og:title" content="' + title + '"><meta property="og:description" content="' + desc + '"><meta property="og:type" content="' + escapeHtml(meta.ogType || "website") + '"><meta property="og:url" content="' + canonical + '"><meta property="og:image" content="' + image + '"><meta property="og:site_name" content="HONGUI"><meta name="twitter:card" content="summary"><meta name="twitter:title" content="' + title + '"><meta name="twitter:description" content="' + desc + '"><link rel="icon" href="/favicon.svg" type="image/svg+xml"><link rel="icon" href="/icon-192.png" type="image/png" sizes="192x192"><link rel="apple-touch-icon" href="/apple-touch-icon.png" sizes="180x180"><link rel="manifest" href="/manifest.webmanifest"><meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes"><meta name="apple-mobile-web-app-title" content="HONGUI"><meta name="apple-mobile-web-app-status-bar-style" content="default"><meta name="theme-color" content="#F2F2F4" media="(prefers-color-scheme: light)"><meta name="theme-color" content="#0B0C10" media="(prefers-color-scheme: dark)">' + ld + '<script nonce="' + nonce + '">try{var t=localStorage.getItem("hongui_theme");if(!t&&matchMedia("(prefers-color-scheme: dark)").matches)t="dark";if(t)document.documentElement.setAttribute("data-theme",t);if(sessionStorage.getItem("hongui_splash_done"))document.documentElement.classList.add("splash-done");}catch(e){}<\/script><script nonce="' + nonce + '">' + BG_CORE + ';try{HBG.boot(' + bgJson + ');}catch(e){}<\/script><style>' + CSS + '</style></head>';
  const tail = '<template id="tplMark">' + markDeco + '</template><script nonce="' + nonce + '">' + clientBundle() + "</script></body></html>";
  let html;
  if (aiHost) {
    html = headHtml + '<body><a class="skip" href="#app">跳到主要内容</a><div id="progress" hidden></div><main id="app" class="ai-app"></main><div id="toast" class="glass strong" role="status" hidden></div><div id="modal" class="modal" hidden></div><noscript>请启用 JavaScript。HONGUI AI · Powered by HONGUI，开发者：项宏。</noscript>' + tail;
  } else {
    html = headHtml + '<body><a class="skip" href="#app">跳到主要内容</a><div id="progress"></div>' +
      '<div class="topslot"><header class="top"><div class="wrap"><div class="top-left"><a class="brand" href="/" aria-label="HONGUI 首页">' + mark + '<span class="btxt"><b>HONGUI</b><small>开发者：项宏</small></span></a><nav class="nav" aria-label="主导航"><a data-nav="/" href="/">首页</a><a data-nav="/values" href="/values">价值观</a><a data-nav="/about" href="/about">关于</a><a data-nav="/drive" href="/drive">网盘</a><a data-nav="/ai" href="' + aiO + '/">AI 对话</a><a data-nav="/speed" href="/speed">测速</a></nav></div>' +
      '<div class="top-mid" id="musicSlot"></div><div class="actions"><button type="button" id="bgBtn" class="icon-btn" aria-haspopup="dialog" aria-expanded="false" aria-label="切换背景" title="切换背景"><i class="ic ic-palette" aria-hidden="true"></i><span class="lbl">背景</span></button><button type="button" id="themeBtn" class="icon-btn" aria-pressed="false" aria-label="切换深色模式" title="切换深色模式"><i class="ic ic-moon" aria-hidden="true"></i><i class="ic ic-sun" aria-hidden="true"></i><span class="lbl">深色模式</span></button><a class="btn primary adminbtn" href="/admin?tab=edit" aria-label="管理后台"><span class="long">管理后台</span><span class="short">后台</span></a><button type="button" id="menuBtn" class="icon-btn menu-btn" aria-haspopup="dialog" aria-expanded="false" aria-controls="navDrawer" aria-label="打开菜单"><span class="hb" aria-hidden="true"><i></i><i></i><i></i></span></button></div></div></header></div>' +
      '<main id="app" class="wrap"><h1 class="sr-only">项宏 · 个人网站 · Powered by HONGUI</h1><div class="sk-page" aria-hidden="true"><div class="sk sk-hero"></div><div class="sk-grid"><div class="sk sk-card"></div><div class="sk sk-card"></div><div class="sk sk-card"></div></div></div></main>' +
      '<footer class="foot"><div class="wrap"><div class="f-brand">' + markDeco + '<div><strong>Powered by HONGUI</strong><small>开发者：项宏</small><small>版权所有 项宏 © ' + year + '</small></div></div><nav class="f-col" aria-label="站点"><span class="f-h">站点</span><a href="/">首页</a><a href="/values">价值观</a><a href="/about">关于</a><a href="/speed">测速</a></nav><nav class="f-col" aria-label="更多"><span class="f-h">更多</span><a href="' + aiO + '/">HONGUI AI</a><a href="/drive">网盘</a><a href="/admin?tab=edit">管理后台</a><a href="/about#credits">图片来源</a></nav><div class="f-col"><span class="f-h">联系</span><a href="https://t.me/your_telegram" rel="noopener noreferrer" target="_blank">Telegram @your_telegram</a><span>微信 your_wechat</span></div></div></footer>' +
      '<div id="toast" class="glass strong" role="status" hidden></div><div id="modal" class="modal" hidden></div>' +
      '<div id="splash"><div class="panel"><div class="sp-mark" aria-hidden="true">' + markDeco + '</div><h1 class="grad-text">Powered by HONGUI</h1><p class="splash-sub">开发者：项宏 · 个人空间</p><div class="netcard"><div class="nc wide"><span>真实 IP</span><b id="sp-ip">获取中</b></div><div class="nc"><span>城市</span><b id="sp-city">获取中</b></div><div class="nc"><span>地区</span><b id="sp-region">获取中</b></div><div class="nc wide"><span>国家</span><b id="sp-country">获取中</b></div></div><button type="button" class="primary enter" id="enterSplash">开启探索 <i class="ic ic-arrow-right" aria-hidden="true"></i></button><button type="button" class="skip-link" id="skipSplash">跳过</button></div></div>' +
      '<div class="drawer-bd" id="drawerBd" hidden></div><aside id="navDrawer" class="drawer" role="dialog" aria-modal="true" aria-label="菜单" hidden><div class="dr-head"><span class="dr-brand">' + markDeco + '<b>HONGUI</b></span><button type="button" class="icon-btn" id="drawerClose" aria-label="关闭菜单"><i class="ic ic-x" aria-hidden="true"></i></button></div>' +
      '<nav class="dr-nav" aria-label="菜单导航"><a data-nav="/" href="/"><i class="ic ic-home" aria-hidden="true"></i>首页</a><a data-nav="/values" href="/values"><i class="ic ic-sparkles" aria-hidden="true"></i>价值观</a><a data-nav="/about" href="/about"><i class="ic ic-user" aria-hidden="true"></i>关于</a><a data-nav="/ai" href="' + aiO + '/"><i class="ic ic-ai" aria-hidden="true"></i>AI 对话<i class="ic ic-arrow-up-right ext" aria-hidden="true"></i></a><a data-nav="/drive" href="/drive"><i class="ic ic-cloud" aria-hidden="true"></i>网盘</a><a data-nav="/speed" href="/speed"><i class="ic ic-gauge" aria-hidden="true"></i>测速</a><a data-nav="/admin" href="/admin?tab=edit"><i class="ic ic-pen" aria-hidden="true"></i>后台</a></nav>' +
      '<div class="dr-sec"><div class="dr-h"><span>背景</span><button type="button" class="linkish" id="drawerBgMore">更多设置</button></div><div class="dr-bgs" id="drawerBgs"></div></div>' +
      '<div class="dr-sec"><label class="dr-row" for="drawerDark"><span><i class="ic ic-moon" aria-hidden="true"></i>深色模式</span><input type="checkbox" id="drawerDark" class="switch" role="switch"></label></div>' +
      '<p class="dr-foot">Powered by HONGUI · 开发者：项宏</p></aside>' +
      '<noscript>请启用 JavaScript。Powered by HONGUI，开发者：项宏。</noscript>' + tail;
  }
  return new Response(html, { status: meta.status || 200, headers });
}

async function pageMeta(request, env, path) {
  const url = new URL(request.url);
  const meta = {
    status: 200,
    title: "项宏 · 个人网站",
    description: "项宏的个人网站：博客、价值观、网盘、AI 对话与网络测速。Powered by HONGUI。开发者：项宏。",
    path,
    origin: url.origin,
    ogType: "website",
    image: url.origin + "/icon-512.png"
  };
  try {
    if (path.startsWith("/post/")) {
      const post = await getPost(env, decodeURIComponent(path.slice("/post/".length)));
      if (!post || post.status !== "published") {
        meta.status = 404;
        meta.title = "页面不存在 · 项宏";
        meta.description = "没有找到这个页面。";
        return meta;
      }
      meta.title = post.title + " · 项宏";
      meta.description = post.summary || meta.description;
      meta.ogType = "article";
      if (validBlogKey(post.cover || "")) meta.image = imagePublicUrl(url.origin, post.cover);
      meta.jsonLd = {
        "@context": "https://schema.org",
        "@type": "BlogPosting",
        headline: post.title,
        datePublished: post.publishedAt,
        dateModified: post.updatedAt,
        description: post.summary,
        author: { "@type": "Person", name: "项宏" },
        mainEntityOfPage: url.origin + path
      };
    } else if (path === "/about") {
      meta.title = "关于 · 项宏";
      meta.description = "项宏，浙江省宁波市鄞州区的高中生开发者。联系 Telegram @your_telegram，微信 your_wechat。";
    } else if (path === "/values") {
      meta.title = "价值观 · 项宏";
      meta.description = "项宏写下的六则价值观。";
    } else if (path === "/ai") {
      meta.title = "AI 对话 · 项宏";
      meta.description = "在项宏的个人网站里与 AI 助手对话。";
    } else if (path === "/speed") {
      meta.title = "测速与 IP 质量 · 项宏";
      meta.description = "检测浏览器到 Cloudflare 边缘节点的延迟、下载、上传与 IP 质量。";
    } else if (path === "/drive") {
      meta.title = "网盘 · 项宏";
      meta.description = "仅管理员可使用的个人网盘。";
    } else if (path === "/admin") {
      meta.title = "管理后台 · 项宏";
      meta.description = "发布文章、管理图片、网盘与 AI 设置。";
    } else if (path !== "/") {
      meta.status = 404;
      meta.title = "页面不存在 · 项宏";
      meta.description = "没有找到这个页面。";
    }
  } catch {
    meta.description = meta.description;
  }
  return meta;
}

async function route(request, env, ctx) {
  const url = new URL(request.url);
  let path = url.pathname;
  if (path.length > 1 && path.endsWith("/")) return redirect(url.origin + path.slice(0, -1) + url.search, 301);
  const method = request.method;
  try { await ensureSeeded(env); } catch { /* ignore */ }
  if (path === "/api/gate/verify" && method === "POST") return handleGateVerify(request, env, url);
  if (path === "/api/gate/fallback" && method === "POST") return handleGateFallback(request, env, url);
  if (gateEnabled(env) && !gateExempt(path)) {
    const gate = await readGate(request, env);
    if (!gate) {
      if (path.startsWith("/api/")) return json({ ok: false, error: "请先完成人机验证（刷新页面即可）", code: 403, gate: true }, 403);
      if (method !== "GET" && method !== "HEAD") return fail(403, "请先完成人机验证");
      return renderGate(request, env, url);
    }
    GATE_OF.set(request, gate);
  }
  if (path.startsWith("/bg/")) return handleBgAsset(request, env, path.slice(4));
  if (isAiHost(url)) {
    if (path === "/favicon.svg") return handleFavicon();
    { const ic = handleIconAsset(path); if (ic) return ic; }
    if (path === "/robots.txt") return handleRobots(request);
    if (path.startsWith("/api/")) {
      if (!AI_HOST_API.some((p) => path === p || path.startsWith(p))) return fail(404, "接口不存在");
      return routeApi(request, env, ctx, url, path, method);
    }
    if (path !== "/") return redirect(mainOriginFor(url) + path + url.search, 302);
    const aiMeta = {
      status: 200, title: "HONGUI AI · 项宏", description: "HONGUI AI：项宏的独立 AI 对话站点。游客每日限次体验，管理员不限次数。Powered by HONGUI。",
      path: "/", origin: url.origin, ogType: "website", image: url.origin + "/icon-512.png",
      aiHost: true, aiOrigin: url.origin, mainOrigin: mainOriginFor(url)
    };
    try { aiMeta.bg = await getSiteBg(env); } catch { aiMeta.bg = null; }
    return renderShell(aiMeta);
  }
  if (path === "/ai") return redirect(aiOriginFor(url) + "/", 302);
  if (path === "/favicon.svg") return handleFavicon();
  { const ic = handleIconAsset(path); if (ic) return ic; }
  if (path === "/robots.txt") return handleRobots(request);
  if (path === "/rss.xml" || path === "/feed" || path === "/rss") return textResponse("RSS 订阅已停止提供。\n", "text/plain; charset=utf-8", 410, { "Cache-Control": "public, max-age=3600" });
  if (path === "/sitemap.xml") return handleSitemap(request, env);
  if (path.startsWith("/image/")) {
    if (method !== "GET" && method !== "HEAD") return fail(405, "方法不被允许");
    let key = path.slice("/image/".length);
    try { key = decodeURIComponent(key); } catch { return fail(400, "路径无效"); }
    return handleImage(request, env, key, url);
  }
  if (path.startsWith("/music/")) {
    if (method !== "GET" && method !== "HEAD") return fail(405, "方法不被允许");
    let key = path.slice("/music/".length);
    try { key = decodeURIComponent(key); } catch { return fail(400, "路径无效"); }
    return handleMusicAsset(request, env, key);
  }
  if (path.startsWith("/api/")) return routeApi(request, env, ctx, url, path, method);
  if (path.startsWith("/s/")) return handleShareGet(request, env, url, path.slice(3));
  if (path === "/drive") {
    const me = await readSession(request, env);
    if (!me) return redirect(url.origin + "/admin?next=/drive");
  }
  const pages = path === "/" || path === "/about" || path === "/values" || path === "/drive" || path === "/ai" || path === "/speed" || path === "/admin" || path.startsWith("/post/");
  const meta = await pageMeta(request, env, path);
  try { meta.bg = await getSiteBg(env); } catch { meta.bg = null; }
  if (!pages) meta.status = 404;
  meta.aiOrigin = aiOriginFor(url);
  meta.mainOrigin = url.origin;
  const res = renderShell(meta);
  if (ctx) recordVisit(env, ctx, clientIp(request));
  return res;
}

async function routeApi(request, env, ctx, url, path, method) {
  globalThis.__honguiReqMethod = method;
  if (method === "OPTIONS") return new Response(null, { status: 204, headers: baseHeaders() });
  const isRead = method === "GET" || method === "HEAD";
  const write = method !== "GET" && method !== "HEAD";
  if (path.startsWith("/api/admin/") || path.startsWith("/api/drive/")) await requireUser(request, env);
  if (write) requireOrigin(request);
  const gateInfo = GATE_OF.get(request);
  if (gateInfo && gateInfo.mode === "soft" && path !== "/api/down" && path !== "/api/up" && path !== "/api/ping") {
    if (await tooMany("soft/" + await shortHash(clientIp(request)), 150, 300)) return fail(429, "受限模式下请求过于频繁，请稍后再试");
  }
  if (path === "/api/gate/status" && isRead) return json({ ok: true, mode: gateInfo ? gateInfo.mode : "off", expires: gateInfo ? new Date(gateInfo.exp).toISOString() : null });
  if (path === "/api/visitor" && isRead) return handleVisitor(request);
  if (path === "/api/posts" && isRead) { try { await ensureSeeded(env); } catch {} return handlePosts(url, env); }
  if (path === "/api/about" && isRead) return json({ ok: true, content: await getAbout(env) });
  if (path === "/api/bg" && isRead) return json({ ok: true, bg: await getSiteBg(env) });
  if (path === "/api/values" && isRead) return json({ ok: true, values: await getValues(env) });
  if (path === "/api/music" && isRead) {
    const cfg = await getMusicCfg(env);
    const origin = url.origin;
    let name = "";
    if (cfg.current && validMusicKey(cfg.current)) {
      name = cfg.current.split("/").pop() || "";
      const head = await bucket(env).head(cfg.current);
      if (!head) {
        const objectsMissing = await listAll(env, "music/");
        const tracksMissing = objectsMissing.filter((o) => validMusicKey(o.key)).map((o) => ({
          key: o.key,
          name: o.key.split("/").pop(),
          url: musicPublicUrl(origin, o.key)
        }));
        return json({ ok: true, config: { enabled: false, autoplay: cfg.autoplay, volume: cfg.volume, current: "", url: "", name: "" }, tracks: tracksMissing });
      }
    }
    const objects = await listAll(env, "music/");
    const tracks = objects.filter((o) => validMusicKey(o.key)).map((o) => ({
      key: o.key,
      name: o.key.split("/").pop(),
      url: musicPublicUrl(origin, o.key)
    }));
    return json({
      ok: true,
      config: {
        enabled: !!(cfg.enabled && cfg.current),
        autoplay: cfg.autoplay,
        loop: cfg.loop !== false,
        volume: cfg.volume,
        current: cfg.current || "",
        url: cfg.current ? musicPublicUrl(origin, cfg.current) : "",
        name
      },
      tracks
    });
  }
  if (path === "/api/ipinfo" && isRead) return handleIpInfo(request);
  if (path === "/api/ping" && isRead) {
    if (await tooMany("ping/" + await shortHash(clientIp(request)), 400, 600)) return fail(429, "请求过于频繁，请稍后再试");
    return json({ ok: true, t: Date.now() });
  }
  if (path === "/api/down" && (method === "GET" || method === "HEAD")) return handleDown(request, url);
  if (path === "/api/up" && method === "POST") return handleUp(request);
  if (path === "/api/auth/login" && method === "POST") return handleLogin(request, env);
  if (path === "/api/auth/logout" && method === "POST") return handleLogout(request);
  if (path === "/api/auth/me" && isRead) {
    const me = await readSession(request, env);
    if (!me) return url.searchParams.get("soft") === "1" ? json({ ok: true, user: null }, 200, { "Cache-Control": "no-store" }) : fail(401, "请先登录");
    return json({ ok: true, user: me.user });
  }
  if (path === "/api/ai/config" && isRead) {
    const saved = await getAiSaved(env);
    if (saved && !(saved.v >= 5)) {
      try { await migrateAiSaved(env, saved); } catch (e) { console.error("ai cfg migrate failed", e && e.message); }
    }
    const cfg = mergeAi(saved, env);
    const me = await readSession(request, env);
    const isAdmin = !!me;
    const tiers = briefTiers(cfg, isAdmin);
    const usage = isAdmin ? null : await guestUsageToday(request, env, cfg);
    return json({
      ok: true,
      allowGuest: cfg.allowGuest,
      guestImages: cfg.guestImages,
      guestDailyLimit: usage ? usage.limit : cfg.guestDailyLimit,
      restricted: !!(GATE_OF.get(request) && GATE_OF.get(request).mode === "soft"),
      defaultTier: cfg.defaultTier,
      isAdmin,
      guestUsed: usage ? usage.used : 0,
      guestRemaining: usage ? usage.remaining : null,
      unlimited: isAdmin,
      tiers,
      modes: [
        { id: "general", label: "通用助手" },
        { id: "polish", label: "写作润色" },
        { id: "code", label: "代码助手" },
        { id: "translate", label: "翻译" },
        { id: "study", label: "学习辅导" }
      ]
    });
  }
  if (path === "/api/ai/chat" && method === "POST") return handleAiChat(request, env, ctx);
  const postId = path.startsWith("/api/post/") ? decodeURIComponent(path.slice("/api/post/".length)) : "";
  if (postId && isRead) return handlePost(request, env, ctx, postId);
  const likeId = path.startsWith("/api/like/") ? decodeURIComponent(path.slice("/api/like/".length)) : "";
  if (likeId && method === "POST") return handleLike(request, env, likeId);
  if (path === "/api/admin/posts" && method === "GET") {
    const posts = (await getIndex(env)).slice().sort((a, b) => String(b.updatedAt || "").localeCompare(String(a.updatedAt || "")));
    return json({ ok: true, posts });
  }
  if (path === "/api/admin/publish" && method === "POST") return json({ ok: true, post: await savePost(env, await readJson(request, 300000), "published") });
  if (path === "/api/admin/draft" && method === "POST") return json({ ok: true, post: await savePost(env, await readJson(request, 300000), "draft") });
  if (path === "/api/admin/upload" && method === "POST") return handleAdminUpload(request, env, url);
  if (path === "/api/admin/images" && method === "GET") return handleAdminImages(env);
  if (path === "/api/admin/images" && method === "DELETE") {
    let key = url.searchParams.get("key") || "";
    try { key = decodeURIComponent(key); } catch { /* keep */ }
    if (!validBlogKey(key)) return fail(400, "Key 不正确");
    await bucket(env).delete(key);
    return json({ ok: true });
  }
  if (path === "/api/admin/about" && method === "POST") {
    const body = await readJson(request, 20000);
    await kvStore(env).put("cfg:about", String(body.content || "").slice(0, 8000));
    return json({ ok: true });
  }
  if (path === "/api/admin/bg" && method === "POST") {
    const body = await readJson(request, 2000);
    const bg = body.bg == null ? null : cleanBg(body.bg);
    if (body.bg != null && !bg) return fail(400, "背景设置格式不正确");
    if (bg) await kvStore(env).put("cfg:bg", JSON.stringify(bg)); else await kvStore(env).delete("cfg:bg");
    BG_MEM = { at: Date.now(), v: bg };
    return json({ ok: true, bg });
  }
  if (path === "/api/admin/values" && method === "POST") {
    const body = await readJson(request, 30000);
    if (!Array.isArray(body.values)) return fail(400, "格式不正确");
    const values = body.values.slice(0, 12).map((item, i) => ({
      title: cleanLine(item.title, 40) || "第 " + (i + 1) + " 则",
      text: cleanLine(item.text, 800)
    })).filter((item) => item.text);
    await kvStore(env).put("cfg:values", JSON.stringify(values));
    return json({ ok: true, values });
  }
  if (path === "/api/admin/export" && method === "GET") return handleExport(env);
  if (path === "/api/admin/import" && method === "POST") return handleImport(request, env);
  if (path === "/api/admin/stats" && method === "GET") return handleStats(env);
  if (path === "/api/admin/music" && method === "GET") return handleMusicList(env, request);
  if (path === "/api/admin/music/upload" && method === "POST") return handleMusicUpload(request, env, url);
  if (path === "/api/admin/music/settings" && method === "POST") {
    const body = await readJson(request, 4000);
    const prev = await getMusicCfg(env);
    const next = cleanMusicCfg({
      enabled: body.enabled != null ? !!body.enabled : prev.enabled,
      autoplay: body.autoplay != null ? !!body.autoplay : prev.autoplay,
      loop: body.loop != null ? !!body.loop : prev.loop,
      volume: body.volume != null ? body.volume : prev.volume,
      current: body.current != null ? body.current : prev.current,
      v: 1
    });
    next.v = 1;
    if (next.current && !validMusicKey(next.current)) return fail(400, "曲目 Key 不正确");
    if (next.current) {
      const head = await bucket(env).head(next.current);
      if (!head) return fail(404, "曲目不存在");
    }
    if (body.enableOnCurrent && next.current) next.enabled = true;
    await kvStore(env).put("cfg:music", JSON.stringify({
      enabled: next.enabled,
      autoplay: next.autoplay,
      loop: next.loop,
      volume: next.volume,
      current: next.current,
      v: 1
    }));
    return json({ ok: true, config: next });
  }
  if (path === "/api/admin/music" && method === "DELETE") {
    let key = url.searchParams.get("key") || "";
    try { key = decodeURIComponent(key); } catch { /* keep */ }
    if (!validMusicKey(key)) return fail(400, "Key 不正确");
    await bucket(env).delete(key);
    const cfg = await getMusicCfg(env);
    if (cfg.current === key) {
      cfg.current = "";
      await kvStore(env).put("cfg:music", JSON.stringify(cfg));
    }
    return json({ ok: true });
  }
  if (path === "/api/admin/ai" && method === "GET") return json({ ok: true, config: publicAi(mergeAi(await getAiSaved(env), env)) });
  if (path === "/api/admin/ai/settings" && method === "POST") return handleAiSave(request, env);
  if (path === "/api/admin/ai/test" && method === "POST") return handleAiTest(request, env);
  if (path === "/api/admin/ai" && method === "POST") return handleAdminAiCall(request, env);
  if (path === "/api/admin/ai-chats" || path.startsWith("/api/admin/ai-chats/")) {
    const r = await handleAdminAiChats(request, env, url, path, method);
    if (r) return r;
  }
  const adminPost = path.startsWith("/api/admin/post/") ? decodeURIComponent(path.slice("/api/admin/post/".length)) : "";
  if (adminPost && method === "GET") {
    const post = await getPost(env, adminPost);
    if (!post) return fail(404, "文章不存在");
    return json({ ok: true, post });
  }
  if (adminPost && method === "DELETE") {
    const post = await getPost(env, adminPost);
    if (!post) return fail(404, "文章不存在");
    await kvStore(env).delete("post:" + adminPost);
    const idx = (await getIndex(env)).filter((x) => x.id !== adminPost);
    await kvStore(env).put("idx", JSON.stringify(idx));
    return json({ ok: true });
  }
  if (path === "/api/drive/list" && method === "GET") return handleDriveList(env, url);
  if (path === "/api/drive/search" && method === "GET") return handleDriveSearch(env, url);
  if (path === "/api/drive/usage" && method === "GET") return json({ ok: true, usage: await driveUsage(env) });
  if (path === "/api/drive/file" && (method === "GET" || method === "HEAD")) return handleDriveFile(request, env, url);
  if (path === "/api/drive/mkdir" && method === "POST") return handleMkdir(request, env);
  if (path === "/api/drive/upload" && method === "POST") return handleSimpleUpload(request, env, url);
  if (path === "/api/drive/multipart/create" && method === "POST") return handleMpuCreate(request, env);
  if (path === "/api/drive/multipart/part" && method === "PUT") return handleMpuPart(request, env, url);
  if (path === "/api/drive/multipart/complete" && method === "POST") return handleMpuComplete(request, env);
  if (path === "/api/drive/multipart/abort" && method === "POST") return handleMpuAbort(request, env);
  if (path === "/api/drive/delete" && method === "POST") return handleDriveDelete(request, env);
  if (path === "/api/drive/rename" && method === "POST") return handleDriveRename(request, env);
  if (path === "/api/drive/move" && method === "POST") return handleDriveMove(request, env);
  if (path === "/api/drive/share" && method === "POST") return handleDriveShare(request, env, url);
  if (path === "/api/drive/share/revoke-all" && method === "POST") return handleShareRevokeAll(env);
  return fail(path.startsWith("/api/") ? 404 : 405, path.startsWith("/api/") ? "接口不存在" : "方法不被允许");
}

const worker = {
  async fetch(request, env, ctx) {
    try {
      return await route(request, env || {}, ctx || { waitUntil() {} });
    } catch (e) {
      const status = e && e.status ? e.status : 500;
      if (status === 500) console.error(e);
      return fail(status, status === 500 ? "服务器繁忙，请稍后再试" : (e.message || "请求失败"));
    }
  }
};

export default worker;
export { renderMarkdown, escapeHtml, worker };
