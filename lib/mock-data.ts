export interface ResumeData {
  name: string;
  yearsExperience: number;
  currentRole: string;
  industry: string;
  skills: { name: string; level: string; context: string }[];
  achievements: { desc: string; metric: string; scope: string }[];
  experience: { company: string; role: string; highlights: string[] }[];
  education: string;
  interests: string[];
}

export interface AnalysisResult {
  assets: {
    name: string;
    potential: number;
    evidence: string;
    product: string;
  }[];
  positioning: {
    primary: string;
    alternativeA: string;
    alternativeB: string;
  };
  growthPath: {
    phase: string;
    duration: string;
    goal: string;
    actions: string[];
    milestone: string;
  }[];
  revenueModel: {
    phase: string;
    product: string;
    pricing: string;
    target: string;
    expectedIncome: string;
  }[];
  risks: {
    point: string;
    warning: string;
    solution: string;
  }[];
  checklist: {
    week: string;
    tasks: string[];
  }[];
}

export function generateMockAnalysis(resume: ResumeData): AnalysisResult {
  return {
    assets: [
      {
        name: `${resume.skills[0]?.name || '专业技能'}咨询`,
        potential: 5,
        evidence: `具备${resume.yearsExperience}年${resume.industry}经验，${resume.achievements[0]?.desc || '有丰富项目经验'}`,
        product: `面向中小企业的${resume.industry}咨询服务，客单价3000-8000元`,
      },
      {
        name: '内容创作与知识付费',
        potential: 4,
        evidence: `擅长${resume.skills[1]?.name || '内容输出'}，可系统化输出行业经验`,
        product: '付费专栏/小册，单价99-299元，配合社群运营',
      },
      {
        name: 'AI工具赋能服务',
        potential: 4,
        evidence: '熟悉AI工具链，可为传统企业提供AI转型咨询',
        product: 'AI工具培训+落地陪跑，客单价5000-15000元',
      },
    ],
    positioning: {
      primary: `${resume.industry}细分领域专家顾问`,
      alternativeA: '知识IP + 轻咨询模式（低风险）',
      alternativeB: 'AI+行业垂直SaaS（高天花板）',
    },
    growthPath: [
      {
        phase: '起步期',
        duration: '0-3个月',
        goal: '验证需求，完成首单',
        actions: [
          '建立个人专业形象（LinkedIn/即刻/公众号）',
          '输出5-10篇垂直领域干货内容',
          '免费为3-5个潜在客户做轻咨询',
          '确定首个付费产品形态',
        ],
        milestone: '完成首单付费，收入≥3000元',
      },
      {
        phase: '增长期',
        duration: '3-6个月',
        goal: '稳定获客，月收入破万',
        actions: [
          '搭建内容矩阵，每周输出2-3篇内容',
          '建立私域社群（目标500人）',
          '推出标准化产品（小册/模板/课程）',
          '建立客户转介绍机制',
        ],
        milestone: '月收入稳定在1-2万',
      },
      {
        phase: '放大期',
        duration: '6-12个月',
        goal: '规模化，建立被动收入',
        actions: [
          '推出高价产品（年度顾问/企业培训）',
          '建立自动化获客漏斗',
          '开发标准化SOP，可考虑外包/合伙',
          '探索资本化路径或被动收入产品',
        ],
        milestone: '月收入3-5万，被动收入占比30%+',
      },
    ],
    revenueModel: [
      {
        phase: '1-3月',
        product: '轻咨询（单次诊断+建议）',
        pricing: '500-1000元/次',
        target: '职场新人、小企业主',
        expectedIncome: '3000-8000元/月',
      },
      {
        phase: '3-6月',
        product: '小册/模板 + 轻社群',
        pricing: '99-299元/人',
        target: '同行业从业者',
        expectedIncome: '1-2万/月',
      },
      {
        phase: '6-12月',
        product: '深度咨询 + 企业培训',
        pricing: '5000-20000元/项目',
        target: '中小企业、创业公司',
        expectedIncome: '3-5万/月',
      },
    ],
    risks: [
      {
        point: '时间管理失衡',
        warning: '主业与副业精力冲突，两者都做不好',
        solution: '设定固定时间块（如每天2小时），用番茄工作法保持专注',
      },
      {
        point: '获客渠道单一',
        warning: '过度依赖单一平台，算法变动导致流量断崖',
        solution: '3个月内建立至少3个获客渠道（内容+社群+转介绍）',
      },
      {
        point: '产品定价过低',
        warning: '低价竞争导致利润微薄，难以持续',
        solution: '首单即按市场价收费，拒绝"练手价"心理',
      },
    ],
    checklist: [
      { week: '第1周', tasks: ['完善个人资料（各平台统一）', '输出第1篇专业内容'] },
      { week: '第2周', tasks: ['梳理过往项目案例（3-5个）', '输出第2篇内容'] },
      { week: '第3周', tasks: ['联系3位潜在客户，免费轻咨询', '收集反馈，打磨产品'] },
      { week: '第4周', tasks: ['确定付费产品形态与定价', '输出第3篇内容'] },
      { week: '第5-6周', tasks: ['启动付费咨询（至少1单）', '建立客户反馈机制'] },
      { week: '第7-8周', tasks: ['输出小册/模板初稿', '启动私域社群运营'] },
      { week: '第9-10周', tasks: ['正式发布标准化产品', '建立内容发布节奏'] },
      { week: '第11-12周', tasks: ['复盘前3个月数据', '制定下一阶段增长计划'] },
    ],
  };
}