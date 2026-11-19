/* 生成词条种子数据：tools/terms.json + supabase/terms-seed.sql */
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(import.meta.dirname, '..');
const cand = JSON.parse(fs.readFileSync(path.join(ROOT, 'tools', 'terms-candidates.json'), 'utf8')).candidates;

const SECT = ['少林', '武当', '华山', '峨眉', '逍遥', '丐帮', '血刀', '天仙', '禅宗', '密宗', '恒山', '泰山', '嵩山', '全真', '古墓', '蜀山', '慈航', '净念禅宗', '慈航静斋', '药王谷'];
const STAT = ['攻击', '命中', '招架', '防御', '气血', '躲闪', '臂力', '身法', '暴击', '悟性', '根骨',
  '暴击伤害', '伤害减免', '免伤', '内力上限', '御气', '忙乱时间', '忽视忙乱', '忽视对方防御',
  '基础属性', '特殊属性', '高级属性', '稀有属性', '学习效率', '打坐效率', '练习效率',
  '绝招冷却时间', '绝招释放时间', '武道', '称号', '容貌'];

function catOf(w) {
  if (SECT.includes(w)) return 'sect';
  if (STAT.includes(w)) return 'stat';
  if (/(剑法|刀法|拳|掌|指|棍法|杖法|步法|身法|神功|心法|真气|经|功|剑|刀|棍|爪|棒)$/.test(w)) return 'skill';
  if (/(袍|衣|靴|鞋|帽|冠|腰带|护腕|护手|发簪|方巾|束腰|护臂|戒刀|军服)$/.test(w)) return 'equip';
  if (/(岛|谷|城|山|门|堂|楼|洞|墓|庄|寺|院|殿|宫|牢|狱|路|碑|禁地|秘境|古城|试炼)$/.test(w)) return 'place';
  return 'other';
}

const rows = cand.map(c => ({
  name: c.w,
  cat: catOf(c.w),
  freq: c.c,
  doc: c.dc || 1,
}));

const esc = s => s.replace(/'/g, "''");
const values = rows.map(r => `('${esc(r.name)}', '${r.cat}', ${r.freq}, false)`).join(',\n');

const sql = `-- 词条种子（由 tools/build-terms.mjs 生成）
insert into public.terms (name, cat, freq, filled)
values
${values}
on conflict (name) do update set freq = excluded.freq, cat = excluded.cat;
`;
fs.writeFileSync(path.join(ROOT, 'supabase', 'terms-seed.sql'), sql);
fs.writeFileSync(path.join(ROOT, 'tools', 'terms.json'), JSON.stringify(rows, null, 0));

const byCat = {};
for (const r of rows) byCat[r.cat] = (byCat[r.cat] || 0) + 1;
console.log('词条', rows.length, JSON.stringify(byCat));
