/* 从全部攻略正文里抽候选名词（无依赖）
   思路：已知实体（表格首列 / 标题 / 引号内）优先，n-gram + 左右熵 + 内部凝固度补充。
   用法：node tools/extract-terms.mjs [--top N]                        */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const ROOT = path.resolve(import.meta.dirname, '..');
const src = fs.readFileSync(path.join(ROOT, 'data.js'), 'utf8');
const sandbox = { window: {} };
vm.createContext(sandbox);
vm.runInContext(src, sandbox);
const DATA = sandbox.window.WX_DATA;

/* ---------- 1. 语料 ---------- */
const texts = [];
const known = new Map();   // 高置信实体 -> 权重

function addKnown(w, wgt) {
  w = String(w || '').trim();
  if (w.length < 2 || w.length > 12) return;
  if (!/^[\u4e00-\u9fa5A-Za-z0-9·]+$/.test(w)) return;
  known.set(w, Math.max(known.get(w) || 0, wgt));
}

for (const g of DATA.guides) {
  addKnown(g.title, 3);
  for (const t of (g.tags || [])) addKnown(t, 2);
  for (const b of g.blocks) {
    if (b.t === 'p') texts.push(b.text);
    else if (b.t === 'h') { texts.push(b.text); addKnown(b.text, 2); }
    else if (b.t === 'table') {
      for (const row of b.rows) {
        texts.push(row.join(' '));
        addKnown(row[0], 2);          // 首列多为实体名
        if (row.length > 1) addKnown(row[1], 1);
      }
    } else if (b.t === 'sep') texts.push(b.text);
  }
}

const raw = texts.join('\n');
// 引号/书名号内的词也当作高置信
for (const m of raw.matchAll(/[「『"“]([^」』"”]{2,12})[」』"”]/g)) addKnown(m[1], 2);

/* ---------- 2. n-gram 统计 ---------- */
// 只保留中文与字母，按标点切块
const chunks = raw
  .replace(/[^\u4e00-\u9fa5A-Za-z0-9]+/g, ' ')
  .split(/\s+/)
  .filter(s => s.length >= 2);

const totalChar = chunks.reduce((a, s) => a + s.length, 0);
const freq = new Map();
const MAXN = 6, MINN = 2;
const docCount = new Map();   // 词 -> 出现在多少篇攻略里
for (const g of DATA.guides) {
  const t = [];
  for (const b of g.blocks) {
    if (b.t === 'p' || b.t === 'h' || b.t === 'sep') t.push(b.text);
    else if (b.t === 'table') for (const row of b.rows) t.push(row.join(' '));
  }
  const seen = new Set();
  const txt = t.join(' ');
  for (let n = MINN; n <= MAXN; n++) {
    for (let i = 0; i + n <= txt.length; i++) {
      const w = txt.slice(i, i + n);
      if (/^[\u4e00-\u9fa5]+$/.test(w)) seen.add(w);
    }
  }
  for (const w of seen) docCount.set(w, (docCount.get(w) || 0) + 1);
}

for (const s of chunks) {
  const L = s.length;
  for (let n = MINN; n <= MAXN; n++) {
    for (let i = 0; i + n <= L; i++) {
      const w = s.slice(i, i + n);
      freq.set(w, (freq.get(w) || 0) + 1);
    }
  }
}

/* ---------- 3. 左/右邻字多样性 ---------- */
const leftSet = new Map(), rightSet = new Map();

// 更省内存的做法：只对达到频次阈值的词收集邻居
const CAND_MIN_FREQ = 4;
const cands = new Set();
for (const [w, c] of freq) if (c >= CAND_MIN_FREQ && w.length >= MINN) cands.add(w);
// 表格首列 / 标题里出现过的实体，哪怕只出现一两次也要收进来
for (const w of known.keys()) if (freq.has(w)) cands.add(w);

for (const s of chunks) {
  const L = s.length;
  for (let n = MINN; n <= MAXN; n++) {
    for (let i = 0; i + n <= L; i++) {
      const w = s.slice(i, i + n);
      if (!cands.has(w)) continue;
      const l = i > 0 ? s[i - 1] : '^';
      const r = i + n < L ? s[i + n] : '$';
      if (!leftSet.has(w)) { leftSet.set(w, new Set()); rightSet.set(w, new Set()); }
      leftSet.get(w).add(l);
      rightSet.get(w).add(r);
    }
  }
}

function entropy(set) {
  if (!set || !set.size) return 0;
  const n = set.size;
  let h = 0;
  for (const v of set.values()) h += 1 / n * Math.log2(n);
  return Math.log2(n) * 1; // 简化：直接用 log2(种类数)
}

/* ---------- 4. 内部凝固度 ---------- */
function cohesion(w) {
  const c = freq.get(w) || 0;
  if (c < 2) return 0;
  let minPMI = Infinity;
  for (let k = 1; k < w.length; k++) {
    const a = freq.get(w.slice(0, k)) || 0;
    const b = freq.get(w.slice(k)) || 0;
    if (!a || !b) return 0;
    const pmi = (c * totalChar) / (a * b);
    if (pmi < minPMI) minPMI = pmi;
  }
  return minPMI === Infinity ? 0 : minPMI;
}

/* ---------- 5. 过滤 ---------- */
// 高频泛词 / 语法词
const STOP = new Set([
  '可以', '我们', '你们', '他们', '这个', '那个', '什么', '怎么', '就是', '不是', '没有', '需要',
  '一个', '一下', '这样', '那样', '自己', '现在', '时候', '因为', '所以', '但是', '而且', '如果',
  '然后', '还是', '或者', '以及', '已经', '可能', '应该', '必须', '一定', '直接', '继续', '开始',
  '之后', '之前', '之后', '以上', '以下', '其中', '其他', '其它', '这里', '那里', '很多', '非常',
  '比较', '一些', '这些', '那些', '还有', '只是', '不过', '为了', '由于', '对于', '关于', '通过',
  '进行', '使用', '获得', '增加', '减少', '提高', '降低', '选择', '进入', '点击', '查看', '注意',
  '建议', '推荐', '最好', '一般', '通常', '基本', '主要', '重要', '问题', '情况', '地方', '东西',
  '时间', '时候', '次数', '数量', '效果', '属性', '能力', '等级', '经验', '任务', '地图', '副本',
  '玩家', '角色', '游戏', '系统', '界面', '按钮', '位置', '方法', '方式', '内容', '部分', '方面',
  '不会', '不能', '不要', '不用', '只有', '只要', '所有', '每个', '每天', '每次', '有些', '有点',
  '大概', '大约', '左右', '目前', '当前', '默认', '自动', '手动', '同时', '一起', '一直', '总是',
  '基本', '相关', '对应', '包括', '包含', '属于', '作为', '成为', '变成', '出现', '发现', '觉得',
  '知道', '看到', '听到', '感觉', '认为', '表示', '说明', '介绍', '提供', '支持', '完成', '结束',
  // 颜色 / 品阶 / 泛化修饰
  '黄色', '绿色', '紫色', '蓝色', '橙色', '白色', '红色', '黑色', '金色', '灰色', '粉色',
  '普通', '高级', '低级', '中级', '顶级', '初级', '通用', '特殊', '一般',
  // 泛化名词
  '装备', '武器', '门派', '流程', '面板', '目标', '数据', '公共', '进阶', '困难', '自制', '自动',
  '停止', '保存', '练习', '解锁', '解密', '精炼', '替换', '覆盖', '兼容', '版本', '更新', '功能',
  '文件', '代码', '设置', '选项', '参数', '格式', '路径', '地址', '链接', '页面', '网站', '浏览器',
]);

// 词首/词尾常为虚词的排除
const BAD_EDGE_HEAD = '的了着过是在和与及或也都就还又很更最太不没别被把让给对从向往于以而且并且但所以因如若虽然则即';
const BAD_EDGE_TAIL = '的了着过是在和与及或也都就还又很更最太不没别被把让给对从向往于以而且并且但所以因如若虽然则即呢吧啊呀吗';


const DENY = new Set(['相信线','倒伏木架','地面纹样','山谷尽头','门边灯座','柜上布卷','廊下木匣','檐下席卷',
  '廊边木料','旧灯匣','小油壶','药草残留','请来验看','摊开双手','推门','新建','一键','总共','整合','扩展',
  '症状','单人','头部','机制','器物','工具','教程','步卡','运行中流程','新建流程','报名守城','拓下碑文',
  '浸洗器物','工作流程','地图描述','技能名称','品质','公式','双线','三线','合律','守誓','药田','丹房',
  '后勤','表格','已开启','全门派']);

const scored = [];
for (const w of cands) {
  if (STOP.has(w) || DENY.has(w)) continue;
  if (w.length < 2 || w.length > 6) continue;
  if (BAD_EDGE_HEAD.includes(w[0]) || BAD_EDGE_TAIL.includes(w[w.length - 1])) continue;
  if (/^[0-9]+$/.test(w)) continue;
  if (/^[A-Za-z0-9_.:/-]+$/.test(w)) continue;          // 纯英文/代码标识符一律不要
  // 动作/指令短语（"跳下去""出去""启用"）不是名词，剔除
  if (/[去来下上起出进做用开关说看想要能会把被好]$/.test(w) && w.length <= 3) continue;
  if (/(执行|进行|完成|开始|结束|使用|获得|选择|查看|点击|设置|打开|关闭|保存|删除)$/.test(w)) continue;
  if (/^[\u4e00-\u9fa5]+$/.test(w) === false) continue;  // 只留纯中文词

  const c = freq.get(w);
  const lh = entropy(leftSet.get(w));
  const rh = entropy(rightSet.get(w));
  const co = cohesion(w);
  const k = known.get(w) || 0;

  // 已知实体放宽阈值
  const dc = docCount.get(w) || 1;
  // 只在一篇里出现过、频次又低的，多半是房间描述而非术语
  const okKnown = k > 0 && (dc >= 2 || c >= 10);
  const okNew = c >= 8 && dc >= 2 && Math.min(lh, rh) >= 1.4 && co >= 8;
  if (!okKnown && !okNew) continue;

  // 首个出现处的上下文，便于人工校对
  const at = raw.indexOf(w);
  const ctx = at < 0 ? '' : raw.slice(Math.max(0, at - 18), at + w.length + 18).replace(/\s+/g, ' ');

  scored.push({ w, c, dc, lh: +lh.toFixed(2), rh: +rh.toFixed(2), co: +co.toFixed(1), known: k, tier: okKnown ? 1 : 2, ctx, score: c * (1 + k) });
}

/* ---------- 6. 去冗余：短词是长词子串且频次差距小则丢弃 ---------- */
scored.sort((a, b) => b.w.length - a.w.length || b.c - a.c);
const kept = [];
for (const it of scored) {
  const covered = kept.some(k => k.w.includes(it.w) && k.c >= it.c * 0.7);
  if (!covered) kept.push(it);
}

kept.sort((a, b) => b.score - a.score);
const TOP = Number((process.argv.find(a => a.startsWith('--top=') ) || '').split('=')[1] || 400);
const out = kept.slice(0, TOP);

fs.writeFileSync(path.join(ROOT, 'tools', 'terms-candidates.json'), JSON.stringify({
  totalChar,
  candidates: out,
}, null, 1));

console.log('语料字符', totalChar, '候选', kept.length, '输出', out.length);
console.log(out.slice(0, 60).map(o => `${o.w}(${o.c}${o.known ? ',已知' : ''})`).join(' '));
