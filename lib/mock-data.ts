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
  routeSelection?: {
    mainRoute: string;
    secondaryRoutes: string[];
    rejectedRoutes: string[];
    reason: string;
  };
  firstDealPlan?: {
    targetCustomer: string;
    whereToFind: string;
    approach: string;
    closing: string;
  };
}

export function generateMockAnalysis(resume: ResumeData): AnalysisResult {
  const coreSkill = resume.skills[0]?.name || '专业能力';
  const secondarySkill = resume.skills[1]?.name || '项目推进';
  const evidence = resume.achievements[0]?.desc || '有可迁移的项目经验与执行记录';

  return {
    assets: [
      {
        name: `${coreSkill}专业服务`,
        potential: 4,
        evidence: `具备${resume.yearsExperience}年${resume.industry}相关经验，${evidence}`,
        product: `围绕${coreSkill}提供诊断、陪跑或专项交付服务，先从标准化服务包切入`,
      },
      {
        name: `${secondarySkill}标准化方案`,
        potential: 4,
        evidence: `简历中可见${secondarySkill}相关经历，适合沉淀方法论与交付模板`,
        product: '将经验沉淀为标准流程、模板包或阶段性交付方案，提高复用率',
      },
      {
        name: `${resume.industry}工具化支持`,
        potential: 3,
        evidence: `行业经验与技能组合具备进一步产品化、工具化的可能`,
        product: '从半定制工具、流程插件或轻量产品开始验证需求，再决定是否继续产品化',
      },
    ],
    positioning: {
      primary: `${resume.industry}领域的问题解决型服务者`,
      alternativeA: '标准化服务产品（低风险、易成交）',
      alternativeB: '工具化 / 产品化方案（更高天花板）',
    },
    growthPath: [
      {
        phase: '验证期',
        duration: '0-3个月',
        goal: '明确最容易成交的问题与服务方式',
        actions: [
          '梳理过往项目、成果和可复用能力，明确最强优势资产',
          '围绕一个细分问题设计最小服务包并验证真实需求',
          '与潜在客户深聊3-5次，确认最常见痛点与支付意愿',
          '根据反馈微调交付范围、定价和标准动作',
        ],
        milestone: '完成首个清晰可复用的付费交付案例',
      },
      {
        phase: '标准化期',
        duration: '3-6个月',
        goal: '把服务从依赖个人发挥，升级为更稳定的交付系统',
        actions: [
          '把高频动作沉淀为SOP、模板与交付清单',
          '把服务拆成更清晰的入门版、标准版、进阶版',
          '建立案例展示与转介绍机制，提升成交稳定性',
          '筛选更匹配的目标客户，减少无效沟通与低价单',
        ],
        milestone: '形成1-2个可重复售卖的标准化方案',
      },
      {
        phase: '放大期',
        duration: '6-12个月',
        goal: '在稳定交付基础上尝试规模化与产品化',
        actions: [
          '保留高利润服务，同时把部分能力工具化或产品化',
          '把高频问题整理为更轻量的标准解决方案',
          '优化获客、成交、交付三段流程，降低单次服务摩擦',
          '根据数据决定继续深耕服务还是向产品化延伸',
        ],
        milestone: '形成“服务 + 标准化产品/工具”双轮结构',
      },
    ],
    revenueModel: [
      {
        phase: '1-3月',
        product: '问题诊断 / 小型专项服务',
        pricing: '1000-3000元/次',
        target: '存在明确问题、愿意快速试用的小团队或个人客户',
        expectedIncome: '3000-10000元/月',
      },
      {
        phase: '3-6月',
        product: '标准化服务包 / 陪跑方案',
        pricing: '3000-10000元/项目',
        target: '需要结果、但预算有限的中小客户',
        expectedIncome: '1-3万/月',
      },
      {
        phase: '6-12月',
        product: '持续顾问 / 工具化方案 / 进阶产品',
        pricing: '8000-30000元/项目或订阅',
        target: '希望持续优化效率或结果的企业客户',
        expectedIncome: '3-5万/月',
      },
    ],
    risks: [
      {
        point: '方向判断过宽',
        warning: '什么都能做，最后什么都难成交',
        solution: '先聚焦一个最常见且最容易付费的问题场景，逐步扩展',
      },
      {
        point: '交付过度依赖个人发挥',
        warning: '每个项目都从头做，难以复制，利润被时间吃掉',
        solution: '尽早把高频动作沉淀成模板、清单和固定流程',
      },
      {
        point: '定价与价值表达不匹配',
        warning: '客户觉得贵，自己觉得累，最后两边都不满意',
        solution: '先定义交付边界、结果目标和适用对象，再反推定价',
      },
    ],
    checklist: [
      { week: '第1周', tasks: ['梳理3个最能代表能力的项目案例', '写出可解决的3类具体问题'] },
      { week: '第2周', tasks: ['确定一个最小服务包', '明确交付内容、周期与定价区间'] },
      { week: '第3周', tasks: ['与3-5位目标用户访谈', '记录他们最愿意付费的问题'] },
      { week: '第4周', tasks: ['完成首版服务介绍页/方案页', '争取首个付费或强反馈案例'] },
      { week: '第5-6周', tasks: ['复盘交付过程', '沉淀成模板、SOP、案例'] },
      { week: '第7-8周', tasks: ['优化版本与报价结构', '提高标准化程度'] },
      { week: '第9-10周', tasks: ['测试第二个可售卖方案', '建立转介绍或复购路径'] },
      { week: '第11-12周', tasks: ['根据数据决定重点深耕方向', '规划服务化还是工具化延伸'] },
    ],
    routeSelection: {
      mainRoute: '标准化服务型',
      secondaryRoutes: ['项目制交付型', '顾问/咨询型'],
      rejectedRoutes: ['内容/IP型'],
      reason: '当前更适合优先走可在30天内成交的中性服务路线，先用已有经验换首单，再考虑升级。',
    },
    firstDealPlan: {
      targetCustomer: '已有明确问题、预算有限但需要快速结果的中小团队或个体经营者',
      whereToFind: '过往同事、老客户、行业社群、微信私域、脉脉/LinkedIn 等熟人半熟人网络',
      approach: '先用一个具体问题切入，给出诊断或小型专项方案，再展示案例与交付边界',
      closing: '用低风险试单或小单切入，在7天内推进沟通、报价和确认范围，先拿下第一单',
    },
  };
}
