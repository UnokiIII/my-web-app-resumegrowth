import type { ResumeData } from './mock-data';

type WeightedCandidate = {
  label: string;
  aliases: string[];
};

type SkillCandidate = {
  name: string;
  aliases: string[];
  levelHint?: string;
};

const ROLE_CANDIDATES: WeightedCandidate[] = [
  {
    label: '产品/技术',
    aliases: [
      '工程师',
      '开发',
      '研发',
      '程序',
      '测试工程师',
      '游戏测试',
      'qa',
      '质量保障',
      '自动化测试',
      'python',
      'airtest',
      'unity',
      '脚本',
      '测试负责人',
    ],
  },
  {
    label: '新媒体运营',
    aliases: ['新媒体运营', '内容运营', '账号运营', '社媒运营', '公众号', '抖音', '小红书', '微博'],
  },
  {
    label: '内容运营',
    aliases: ['内容策划', '内容编辑', '写作', '文案', '选题', '脚本撰写', '编辑'],
  },
  {
    label: '社区运营',
    aliases: ['社区运营', '社群运营', '用户运营', '社群管理'],
  },
  {
    label: '市场推广',
    aliases: ['市场推广', '品牌推广', '增长', '投放', '营销'],
  },
  {
    label: '活动策划',
    aliases: ['活动策划', '赛事策划', '策划执行', '活动执行', '宣传推广'],
  },
  {
    label: '平面设计',
    aliases: ['平面设计', '视觉设计', '视觉传达', '品牌设计', '物料设计'],
  },
  {
    label: '销售/商务',
    aliases: ['销售', '商务', 'bd', '渠道'],
  },
];

const INDUSTRY_CANDIDATES: WeightedCandidate[] = [
  {
    label: '游戏/互联网',
    aliases: ['游戏', '手游', 'moba', 'mmorpg', '腾讯', '天美', 'unity', '互联网', '小程序', 'web端'],
  },
  {
    label: 'Web3/区块链',
    aliases: ['web3', 'crypto', '区块链', '链上', '加密市场', '投研', 'rwa', 'defi'],
  },
  {
    label: '内容/新媒体',
    aliases: ['内容运营', '内容策划', '新媒体', '公众号', '短视频', '抖音', '小红书', '微博'],
  },
  {
    label: '设计/品牌',
    aliases: ['视觉传达', '平面设计', '品牌设计', '物料设计', '广告设计'],
  },
  {
    label: '活动/演出',
    aliases: ['活动策划', '赛事', '演出', '街舞', '宣传推广'],
  },
  {
    label: '电商',
    aliases: ['电商', '直播带货', '店铺运营'],
  },
  {
    label: '教育',
    aliases: ['教师', '讲师', '培训', '教研', '课程'],
  },
];

const SKILL_CANDIDATES: SkillCandidate[] = [
  {
    name: '游戏测试',
    aliases: ['游戏测试', '测试工程师', '测试负责人', '测试质量', '测试管理', '质量管理'],
    levelHint: '熟练',
  },
  {
    name: '测试用例设计',
    aliases: ['测试用例', '设计测试用例', '测试方案', '测试计划', '评审组内用例'],
    levelHint: '熟练',
  },
  {
    name: '自动化测试',
    aliases: ['自动化测试', 'airtest', '测试脚本', '编写脚本', '脚本开发'],
    levelHint: '掌握',
  },
  {
    name: '性能与专项测试',
    aliases: ['性能测试', '弱网测试', '适配测试', '设备适配', '专项测试'],
    levelHint: '熟练',
  },
  {
    name: 'Python',
    aliases: ['python'],
    levelHint: '掌握',
  },
  {
    name: '版本管理',
    aliases: ['git', 'svn', '版本管理'],
    levelHint: '掌握',
  },
  {
    name: 'Unity / Web 测试',
    aliases: ['unity', 'web 端应用测试', 'web端应用测试', 'ios', 'android', 'pc 端', '小游戏平台'],
    levelHint: '掌握',
  },
  {
    name: '项目管理',
    aliases: ['项目管理', '发布计划', '测试团队人员协调', '风险评估', '协调测试设备和环境'],
    levelHint: '掌握',
  },
  {
    name: '新媒体运营',
    aliases: ['新媒体运营', '内容运营', '账号运营', '社媒运营', '公众号', '抖音', '小红书', '微博'],
  },
  {
    name: '内容策划',
    aliases: ['内容策划', '选题策划', '脚本撰写', '内容编辑', '文案策划'],
  },
  {
    name: '平面设计',
    aliases: ['平面设计', 'photoshop', 'illustrator', 'ps'],
  },
  {
    name: 'AI 自动化',
    aliases: ['ai 自动化', '工作流', 'agent', '提示词', 'chatgpt', 'gpt', 'claude', 'openai', '大模型'],
  },
  {
    name: 'Office',
    aliases: ['office', 'excel', 'ppt', 'word'],
  },
];

const INTEREST_CANDIDATES = ['技术', '游戏', 'AI', '产品', '自动化', '内容', '设计', '活动', '创业'];

const SECTION_HEADING_PATTERN = /^(个人简历|教育背景|项目经历|工作经历|专业技能|游戏经历|自我评价|荣誉奖励|项目介绍)$/;

function normalizeText(value: string) {
  return value
    .replace(/\u0000/g, '')
    .replace(/\r/g, '\n')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function normalizeLower(value: string) {
  return normalizeText(value).toLowerCase();
}

function scoreAliases(text: string, aliases: string[]) {
  const lower = normalizeLower(text);
  return aliases.reduce((sum, alias) => {
    const token = normalizeLower(alias);
    if (!token) return sum;
    return sum + Math.max(lower.split(token).length - 1, 0);
  }, 0);
}

function pickBestLabel(text: string, candidates: WeightedCandidate[], fallback: string) {
  const scored = candidates
    .map((item) => ({
      label: item.label,
      score: scoreAliases(text, item.aliases),
    }))
    .sort((a, b) => b.score - a.score);

  return scored[0]?.score ? scored[0].label : fallback;
}

function pickName(lines: string[]) {
  const joined = lines.join('\n');
  const matched = joined.match(/姓\s*名\s*[：:]\s*([^\n\r]{2,12})/);
  if (matched?.[1]) return matched[1].trim();

  const topLine = lines.slice(0, 16).find((line) => {
    if (SECTION_HEADING_PATTERN.test(line)) return false;
    if (/电话|邮箱|求职意向|现工作地|户籍|毕业院校|专业/.test(line)) return false;
    return /^[\u4e00-\u9fa5A-Za-z·]{2,12}$/.test(line);
  });

  return topLine || '候选人';
}

function parseDateToken(token: string) {
  if (/至今|现在|present|current/i.test(token)) {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() + 1 };
  }

  const matched = token.match(/(20\d{2})[./-]?(\d{1,2})?/);
  if (!matched) return null;

  return {
    year: Number(matched[1]),
    month: Number(matched[2] || '1'),
  };
}

function monthDiff(start: { year: number; month: number }, end: { year: number; month: number }) {
  return Math.max(0, (end.year - start.year) * 12 + (end.month - start.month) + 1);
}

function pickYears(text: string) {
  const regex = /(20\d{2}[./-]?\d{1,2})\s*[–—-]+\s*(20\d{2}[./-]?\d{1,2}|至今|现在|present|current)/gi;
  const spans: number[] = [];
  let current = regex.exec(text);

  while (current) {
    const start = parseDateToken(current[1]);
    const end = parseDateToken(current[2]);
    if (start && end) {
      spans.push(monthDiff(start, end));
    }
    current = regex.exec(text);
  }

  if (!spans.length) return 1;
  const longest = Math.max(...spans);
  return Math.min(12, Math.max(1, Math.round((longest / 12) * 10) / 10));
}

function inferSkillLevel(score: number) {
  if (score >= 4) return '熟练';
  if (score >= 2) return '掌握';
  return '了解';
}

function pickSkills(text: string) {
  const scored = SKILL_CANDIDATES.map((item) => ({
    ...item,
    score: scoreAliases(text, item.aliases),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);

  if (!scored.length) {
    return [
      { name: '执行能力', level: '熟练', context: '简历中有明确项目推进和交付记录。' },
      { name: '沟通协作', level: '熟练', context: '简历中存在跨团队或跨角色协作经历。' },
    ];
  }

  return scored.map((item) => ({
    name: item.name,
    level: item.levelHint || inferSkillLevel(item.score),
    context: `简历中多次出现与“${item.aliases[0]}”相关的经历或技能描述。`,
  }));
}

function pickAchievements(lines: string[]) {
  const interesting = lines.filter(
    (line) =>
      line.length >= 4 &&
      /(\d+(?:\.\d+)?%|\d+\+|前\d+|top ?\d+|最佳员工|成长进步奖|国服前\d+|台湾省前\d+|榜十内)/i.test(line)
  );

  if (!interesting.length) {
    return [{ desc: '完成过可迁移的项目交付', metric: '有结果样本', scope: '来自简历原文提取' }];
  }

  return interesting.slice(0, 5).map((line) => ({
    desc: line.slice(0, 60),
    metric: line.match(/(\d+(?:\.\d+)?(?:%|\+)?|前\d+|top ?\d+|最佳员工|成长进步奖|榜十内)/i)?.[0] || '有量化结果',
    scope: '来自简历原文提取',
  }));
}

function isDateRange(line: string) {
  return /(20\d{2}[./-]?\d{1,2})\s*[–—-]+\s*(20\d{2}[./-]?\d{1,2}|至今|现在|present|current)/i.test(line);
}

function looksLikeRole(line: string) {
  return /运营|编辑|设计|策划|执行|推广|助理|专员|经理|研究|分析|商务|销售|产品|工程师|测试|开发|qa|负责人/i.test(line);
}

function cleanInlineRole(line: string) {
  return (
    line
      .split('|')
      .map((item) => item.trim())
      .find((item) => looksLikeRole(item)) || line.trim()
  );
}

function pickExperience(lines: string[]) {
  const entries: ResumeData['experience'] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];
    if (!isDateRange(line)) continue;

    const companyLine = lines[index + 1];
    if (!companyLine || SECTION_HEADING_PATTERN.test(companyLine)) continue;

    const nearbyRoleLine = lines.slice(index + 1, index + 7).find((item) => looksLikeRole(item) || /项目职责[:：]/.test(item));
    const roleLine = nearbyRoleLine
      ? nearbyRoleLine.replace(/^项目职责[:：]\s*/, '').trim()
      : cleanInlineRole(companyLine);

    const highlights: string[] = [];
    for (let cursor = index + 1; cursor < lines.length; cursor += 1) {
      const current = lines[cursor];
      if (cursor !== index + 1 && isDateRange(current)) break;
      if (SECTION_HEADING_PATTERN.test(current)) continue;
      if (current.length < 5) continue;
      if (/^(姓|名：|电话|邮箱|现工作地|户籍)/.test(current)) continue;
      highlights.push(current);
      if (highlights.length === 4) break;
    }

    entries.push({
      company: companyLine.slice(0, 40),
      role: roleLine.slice(0, 40),
      highlights: highlights.length ? highlights : ['有明确项目推进与交付结果。'],
    });

    if (entries.length === 4) break;
  }

  if (!entries.length) {
    return [{ company: '未识别到明确公司信息', role: '待补充', highlights: ['建议补充关键项目、岗位职责与结果。'] }];
  }

  return entries;
}

function pickEducation(text: string) {
  if (text.includes('博士')) return '博士';
  if (text.includes('硕士') || text.includes('研究生')) return '硕士';
  if (text.includes('本科')) return '本科';
  if (text.includes('大专')) return '大专';
  return '未明确';
}

function pickInterests(text: string) {
  const lower = normalizeLower(text);
  const hits = INTEREST_CANDIDATES.filter((item) => lower.includes(item.toLowerCase()));
  return hits.length ? hits.slice(0, 4) : ['职业成长', '一人企业'];
}

function buildIndustryText(lines: string[]) {
  return lines
    .filter((line) => !/毕业院校|专业:|专业：|教育背景|个人简历/.test(line))
    .join('\n');
}

export function parseResumeText(rawText: string): ResumeData {
  const text = normalizeText(rawText);
  const lines = rawText
    .split(/\r?\n/)
    .map((line) => normalizeText(line))
    .filter(Boolean);
  const industryText = buildIndustryText(lines);

  return {
    name: pickName(lines),
    yearsExperience: pickYears(text),
    currentRole: pickBestLabel(text, ROLE_CANDIDATES, '综合岗位'),
    industry: pickBestLabel(industryText, INDUSTRY_CANDIDATES, '通用行业'),
    skills: pickSkills(text),
    achievements: pickAchievements(lines),
    experience: pickExperience(lines),
    education: pickEducation(text),
    interests: pickInterests(text),
  };
}
