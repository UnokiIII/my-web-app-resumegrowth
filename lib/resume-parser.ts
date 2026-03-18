import { ResumeData } from './mock-data';

const ROLE_KEYWORDS = [
  '产品经理',
  '运营',
  '市场',
  '销售',
  '研发',
  '工程师',
  '设计师',
  '项目经理',
  '咨询顾问',
  'HR',
  '财务',
];

const INDUSTRY_KEYWORDS = [
  '互联网',
  '科技',
  '教育',
  '医疗',
  '金融',
  '制造',
  '消费',
  '跨境',
  '电商',
  '新能源',
];

const SKILL_KEYWORDS = [
  '产品',
  '运营',
  '增长',
  '数据分析',
  'SQL',
  'Python',
  'JavaScript',
  '项目管理',
  '沟通',
  '销售',
  '内容',
  'AI',
  '自动化',
  '品牌',
  '用户研究',
  'SaaS',
];

function pickName(lines: string[]) {
  const first = lines.slice(0, 5).find((l) => l.trim().length > 1 && l.trim().length <= 20);
  return first?.replace(/[|｜•·]/g, ' ').trim() || '候选人';
}

function pickYears(text: string) {
  const regex = /(\d{1,2})\s*年/g;
  const matches: number[] = [];
  let matched: RegExpExecArray | null = regex.exec(text);

  while (matched) {
    matches.push(Number(matched[1]));
    matched = regex.exec(text);
  }

  const valid = matches.filter((n) => n >= 0 && n <= 40);
  if (!valid.length) return 3;
  return Math.max(...valid);
}

function pickRole(text: string) {
  for (const role of ROLE_KEYWORDS) {
    if (text.includes(role)) return role;
  }
  return '综合岗位';
}

function pickIndustry(text: string) {
  for (const keyword of INDUSTRY_KEYWORDS) {
    if (text.includes(keyword)) return keyword;
  }
  return '通用行业';
}

function pickSkills(text: string) {
  const hits = SKILL_KEYWORDS
    .map((keyword) => ({ keyword, score: text.split(keyword).length - 1 }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6);

  if (!hits.length) {
    return [
      { name: '执行力', level: '熟练', context: '从简历文本中提取到多段项目经历' },
      { name: '沟通协作', level: '熟练', context: '存在跨团队/跨角色协作描述' },
    ];
  }

  return hits.map((item, index) => ({
    name: item.keyword,
    level: index < 2 ? '精通' : '熟练',
    context: `在简历中出现 ${item.score} 次`,
  }));
}

function pickAchievements(lines: string[]) {
  const achievementLines = lines
    .filter((line) => /(%|万|亿|增长|提升|下降|优化|节省|新增|转化)/.test(line))
    .slice(0, 4);

  if (!achievementLines.length) {
    return [{ desc: '完成多个项目交付', metric: '按期上线', scope: '跨团队协作' }];
  }

  return achievementLines.map((line) => ({
    desc: line.slice(0, 32),
    metric: line.match(/\d+[.%万亿]?/)?.[0] || '有量化结果',
    scope: '来自简历原文提取',
  }));
}

function pickExperience(lines: string[]) {
  const expLines = lines
    .filter((line) => /(公司|有限公司|集团|科技|担任|任职|负责)/.test(line))
    .slice(0, 3);

  if (!expLines.length) {
    return [{ company: '未明确公司信息', role: '待补充', highlights: ['建议补充关键项目与职责'] }];
  }

  return expLines.map((line) => ({
    company: line.slice(0, 20),
    role: '核心岗位',
    highlights: [line.slice(0, 40)],
  }));
}

function pickEducation(text: string) {
  if (text.includes('博士')) return '博士';
  if (text.includes('硕士') || text.includes('研究生')) return '硕士';
  if (text.includes('本科')) return '本科';
  if (text.includes('大专')) return '大专';
  return '未明确';
}

function pickInterests(text: string) {
  const candidates = ['AI', '创业', '写作', '增长', '产品', '技术', '数据', '商业'];
  const hits = candidates.filter((item) => text.includes(item));
  return hits.length ? hits.slice(0, 4) : ['一人企业', '职业成长'];
}

export function parseResumeText(rawText: string): ResumeData {
  const text = rawText.replace(/\u0000/g, '').replace(/\s+/g, ' ').trim();
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    name: pickName(lines),
    yearsExperience: pickYears(text),
    currentRole: pickRole(text),
    industry: pickIndustry(text),
    skills: pickSkills(text),
    achievements: pickAchievements(lines),
    experience: pickExperience(lines),
    education: pickEducation(text),
    interests: pickInterests(text),
  };
}
