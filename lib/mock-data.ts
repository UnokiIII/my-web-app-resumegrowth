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

export interface AssetItem {
  name: string;
  potential: number;
  evidence: string;
  product: string;
  strategyReason?: string;
}

export interface GrowthActionDetail {
  title: string;
  howTo: string;
  whereToFind?: string;
  deliverable: string;
}

export interface GrowthPathPhase {
  phase: string;
  duration: string;
  goal: string;
  actions: string[];
  actionDetails?: GrowthActionDetail[];
  milestone: string;
}

export interface StrategyOption {
  id: 'primary' | 'alternativeA' | 'alternativeB';
  label: string;
  title: string;
  summary: string;
  assets?: AssetItem[];
  routeSelection: {
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
  knowledgeGuidance?: {
    scene: string;
    sceneSummary: string;
    sceneReason: string;
    matchedSignals: string[];
    recommendedRoutes: {
      name: string;
      reason: string;
    }[];
    rejectedRoutes: string[];
    recommendedArticles: {
      id: string;
      title: string;
      summary: string;
      path: string;
    }[];
    recommendedCases: {
      id: string;
      title: string;
      background: string;
      trigger: string;
      firstDeal: string;
      monetization: string;
      assetUpgrade: string;
      sourceLabel: string;
      sourceType: 'creator_reference' | 'internal_pattern' | 'market_observation';
      score: number;
      scoreLabel: 'high' | 'medium' | 'low';
      recommendationReason: string;
      matchedSignals: string[];
      matchedTags: {
        id: string;
        label: string;
        category: 'skill' | 'route' | 'monetization' | 'stage' | 'asset' | 'risk' | 'style';
      }[];
    }[];
    faqHints: {
      id: string;
      question: string;
      answer: string;
    }[];
  };
  growthPath: GrowthPathPhase[];
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

export interface AnalysisResult {
  assets: AssetItem[];
  positioning: {
    primary: string;
    alternativeA: string;
    alternativeB: string;
  };
  growthPath: GrowthPathPhase[];
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
  knowledgeGuidance?: {
    scene: string;
    sceneSummary: string;
    sceneReason: string;
    matchedSignals: string[];
    recommendedRoutes: {
      name: string;
      reason: string;
    }[];
    rejectedRoutes: string[];
    recommendedArticles: {
      id: string;
      title: string;
      summary: string;
      path: string;
    }[];
    recommendedCases: {
      id: string;
      title: string;
      background: string;
      trigger: string;
      firstDeal: string;
      monetization: string;
      assetUpgrade: string;
      sourceLabel: string;
      sourceType: 'creator_reference' | 'internal_pattern' | 'market_observation';
      score: number;
      scoreLabel: 'high' | 'medium' | 'low';
      recommendationReason: string;
      matchedSignals: string[];
      matchedTags: {
        id: string;
        label: string;
        category: 'skill' | 'route' | 'monetization' | 'stage' | 'asset' | 'risk' | 'style';
      }[];
    }[];
    faqHints: {
      id: string;
      question: string;
      answer: string;
    }[];
  };
  strategyOptions?: StrategyOption[];
}

function inferFallbackRoute(resume: ResumeData) {
  const text = [resume.currentRole, resume.industry, ...resume.skills.map((skill) => skill.name), ...resume.interests].join(' ').toLowerCase();

  if (/设计|视觉|物料|品牌|photoshop|illustrator/.test(text)) {
    return {
      mainRoute: '项目制交付',
      secondaryRoutes: ['标准化服务', '内容/IP'],
      rejectedRoutes: ['垂直 SaaS'],
      reason: '当前履历更容易从清晰交付物切入，首单路径通常比先做品牌化表达更短。',
    };
  }

  if (/新媒体|内容|社区|运营|增长|短视频|抖音|tiktok|推特|twitter/.test(text)) {
    return {
      mainRoute: '代运营/代理服务',
      secondaryRoutes: ['信息服务/研究', '标准化服务'],
      rejectedRoutes: ['垂直 SaaS'],
      reason: '这类履历更适合先卖持续执行、内容策划或运营支持，再把高频动作标准化。',
    };
  }

  if (/研究|投研|分析|报告|web3|crypto/.test(text)) {
    return {
      mainRoute: '信息服务/研究',
      secondaryRoutes: ['标准化服务', '内容/IP'],
      rejectedRoutes: ['垂直 SaaS'],
      reason: '当前更像把复杂信息转成研究、情报或内容服务，而不是先做产品。',
    };
  }

  if (/开发|工程|自动化|agent|工作流|python|javascript|sql/.test(text)) {
    return {
      mainRoute: '标准化服务',
      secondaryRoutes: ['工具产品', '项目制交付'],
      rejectedRoutes: ['内容/IP'],
      reason: '更稳妥的方式是先在服务里验证自动化或工具能力，再决定是否做独立产品。',
    };
  }

  if (/销售|bd|商务|渠道/.test(text)) {
    return {
      mainRoute: '渠道销售',
      secondaryRoutes: ['资源撮合', '顾问咨询'],
      rejectedRoutes: ['垂直 SaaS'],
      reason: '现阶段最短路径通常是先利用已有拿单、连接和成交能力变现。',
    };
  }

  return {
    mainRoute: '标准化服务',
    secondaryRoutes: ['项目制交付', '代运营/代理服务'],
    rejectedRoutes: ['内容/IP'],
    reason: '当履历信号不够集中时，优先从边界清晰、容易成交的小服务开始更稳妥。',
  };
}

export function generateMockAnalysis(resume: ResumeData): AnalysisResult {
  const primarySkill = resume.skills[0]?.name || '核心专业能力';
  const secondarySkill = resume.skills[1]?.name || '协同推进能力';
  const tertiarySkill = resume.skills[2]?.name || '研究整理能力';
  const evidence = resume.achievements[0]?.desc || '有可迁移的项目成果与执行记录';
  const route = inferFallbackRoute(resume);

  return {
    assets: [
      {
        name: primarySkill,
        potential: 4,
        evidence: `简历中已有直接证据：${evidence}`,
        product: `先把 ${primarySkill} 包装成边界清晰、可报价的小服务，再用案例迭代到标准化版本。`,
      },
      {
        name: secondarySkill,
        potential: 4,
        evidence: `这项能力和主技能形成组合，更容易做出完整交付。`,
        product: `把 ${secondarySkill} 设计成专项支持、陪跑或打包服务，提高复购和客单。`,
      },
      {
        name: tertiarySkill,
        potential: 3,
        evidence: `它适合作为差异化补充，而不是一开始单独卖。`,
        product: `先把 ${tertiarySkill} 挂到主服务里验证需求，再考虑做更轻的产品化延伸。`,
      },
    ],
    positioning: {
      primary: `${resume.industry} 领域的问题解决型一人企业`,
      alternativeA: `围绕 ${primarySkill} 的标准化服务提供者`,
      alternativeB: `把 ${secondarySkill} 与 ${tertiarySkill} 组合成更高价值的专项方案`,
    },
    growthPath: [
      {
        phase: '验证期',
        duration: '0-30 天',
        goal: '找到最容易成交的最小服务切口，拿到第一单。',
        actions: [
          '从过往经历里挑出 2-3 个最像真实需求的案例，整理成能对外解释的服务样本。',
          '围绕一个高频问题写出最小服务包：交付边界、周期、价格与适合对象。',
          '优先联系熟人网络、前同事、老客户或已有流量入口，做第一轮真实沟通。',
        ],
        milestone: '拿到第一单，或至少拿到明确的付费反馈与修改方向。',
      },
      {
        phase: '标准化期',
        duration: '30-90 天',
        goal: '把已成交的动作沉淀成可复制交付，而不是继续全靠临场发挥。',
        actions: [
          '整理沟通脚本、交付清单、案例模板和报价边界。',
          '把高频动作拆成固定模块，形成更容易复用的标准化服务版本。',
          '明确哪类客户最容易成交，主动缩窄目标范围。',
        ],
        milestone: '形成 1-2 个能重复成交的固定服务。',
      },
      {
        phase: '升级期',
        duration: '90-180 天',
        goal: '在稳定服务基础上，尝试做内容、工具或知识资产升级。',
        actions: [
          '保留高利润服务，同时把重复动作模板化、工具化或知识库化。',
          '根据客户反馈决定是往高客单服务升级，还是往更轻的产品化延伸。',
          '开始建立转介绍、案例展示和内容分发机制，降低单次获客成本。',
        ],
        milestone: '形成“服务 + 资产化内容/工具”的双轮结构。',
      },
    ],
    revenueModel: [
      {
        phase: '1-3 个月',
        product: '最小服务包 / 诊断单 / 小专项',
        pricing: '1000-3000 元/次',
        target: '有明确问题、希望快速试用的个人或小团队客户',
        expectedIncome: '3000-10000 元/月',
      },
      {
        phase: '3-6 个月',
        product: '标准化服务包 / 月度支持',
        pricing: '3000-10000 元/项目',
        target: '需要更稳定结果、但预算仍有限的中小客户',
        expectedIncome: '10000-30000 元/月',
      },
      {
        phase: '6-12 个月',
        product: '高阶顾问 / 训练营 / 工具化产品',
        pricing: '8000-30000 元/项目或订阅',
        target: '已经认可你方法与结果的复购客户',
        expectedIncome: '30000-50000 元/月',
      },
    ],
    risks: [
      {
        point: '方向同时开太多',
        warning: '同时卖太多能力会让用户不知道你到底解决什么问题。',
        solution: '先保留一个最容易成交的主切口，再把其余能力作为加分项。',
      },
      {
        point: '交付边界不清晰',
        warning: '客户容易不断加需求，最后时间被吞掉、利润也被吞掉。',
        solution: '先写清楚交付物、轮次、周期和不包含项，再谈报价。',
      },
      {
        point: '把曝光误当成交',
        warning: '内容播放、粉丝增长或表面活跃不等于真正愿意付费。',
        solution: '所有动作都回到“这能不能带来第一单”来判断优先级。',
      },
    ],
    checklist: [
      { week: '第 1 周', tasks: ['整理 3 个最能代表能力的案例', '写出 1 个最小服务包草案'] },
      { week: '第 2 周', tasks: ['找 3-5 个真实潜在客户沟通', '记录他们最愿意付费的问题'] },
      { week: '第 3 周', tasks: ['完善报价边界与交付清单', '准备案例页或服务介绍页'] },
      { week: '第 4 周', tasks: ['争取拿下第一单或试单', '复盘沟通和成交阻力'] },
      { week: '第 5-8 周', tasks: ['沉淀 SOP、模板和案例库', '把重复动作打包成标准化版本'] },
      { week: '第 9-12 周', tasks: ['测试第二个可卖方案', '建立转介绍或持续获客机制'] },
    ],
    routeSelection: route,
    firstDealPlan: {
      targetCustomer: '已有明确问题、预算有限但希望快速看到结果的中小客户',
      whereToFind: '熟人网络、前同事、前客户、行业社群、私域与已有内容入口',
      approach: '先拿一个具体问题切入，给出小而明确的方案，不要一开始就卖大而全合作',
      closing: '优先用试单、小单或短周期服务成交，先完成第一次真实支付与交付闭环',
    },
  };
}
