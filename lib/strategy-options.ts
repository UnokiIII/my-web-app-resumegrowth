import type { AnalysisResult, AssetItem, GrowthActionDetail, GrowthPathPhase, ResumeData, StrategyOption } from './mock-data';
import {
  CASE_DEFINITIONS,
  FAQ_DEFINITIONS,
  METHODOLOGY_ARTICLES,
  ROUTE_ARTICLES,
  ROUTE_DEFINITIONS,
  SCENE_ARTICLES,
  type CandidateRoute,
  type KnowledgeArticleRef,
  type KnowledgeContext,
  type RecommendedCase,
  type RouteDefinition,
  type RouteId,
  type ScoredScene,
} from './knowledge';

const ARTICLE_POOL: KnowledgeArticleRef[] = [...METHODOLOGY_ARTICLES, ...ROUTE_ARTICLES, ...SCENE_ARTICLES];
const OPTION_IDS: StrategyOption['id'][] = ['primary', 'alternativeA', 'alternativeB'];
const OPTION_LABELS: Record<StrategyOption['id'], string> = {
  primary: '主定位',
  alternativeA: '备选 A',
  alternativeB: '备选 B',
};

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function uniqueStrings(items: string[]) {
  return Array.from(new Set(items.filter(Boolean)));
}

function pickArticles(articleIds: string[]) {
  return uniqueById(ARTICLE_POOL.filter((item) => articleIds.includes(item.id))).slice(0, 4);
}

function findRouteDefinitionByName(name: string) {
  return ROUTE_DEFINITIONS.find((route) => route.name === name);
}

function resolveOrderedCandidates(result: AnalysisResult, knowledgeContext: KnowledgeContext) {
  const candidates = knowledgeContext.candidateRoutes;
  const ordered: CandidateRoute[] = [];
  const seen = new Set<RouteId>();

  const pushCandidate = (candidate?: CandidateRoute) => {
    if (!candidate || seen.has(candidate.route.id)) return;
    seen.add(candidate.route.id);
    ordered.push(candidate);
  };

  const primaryRouteName = result.routeSelection?.mainRoute;
  if (primaryRouteName) {
    pushCandidate(candidates.find((item) => item.route.name === primaryRouteName));
  }

  if (result.routeSelection?.secondaryRoutes?.length) {
    for (const routeName of result.routeSelection.secondaryRoutes) {
      pushCandidate(candidates.find((item) => item.route.name === routeName));
    }
  }

  for (const candidate of candidates) {
    pushCandidate(candidate);
  }

  return ordered.slice(0, 3);
}

function pickSceneForRoute(route: RouteDefinition, knowledgeContext: KnowledgeContext) {
  const matched = knowledgeContext.scoredScenes
    .filter((entry) => entry.scene.primaryRoutes.includes(route.id) || entry.scene.secondaryRoutes.includes(route.id))
    .sort((a, b) => {
      const aPriority = a.scene.primaryRoutes.includes(route.id) ? 2 : 1;
      const bPriority = b.scene.primaryRoutes.includes(route.id) ? 2 : 1;
      if (aPriority !== bPriority) return bPriority - aPriority;
      return b.score - a.score;
    });

  return matched[0] || knowledgeContext.primaryScene;
}

function buildOptionTitle(result: AnalysisResult, optionId: StrategyOption['id'], fallbackRouteName: string) {
  if (optionId === 'primary') return result.positioning.primary || fallbackRouteName;
  if (optionId === 'alternativeA') return result.positioning.alternativeA || fallbackRouteName;
  return result.positioning.alternativeB || fallbackRouteName;
}

function buildOptionSummary(route: RouteDefinition, scene: ScoredScene) {
  return `${scene.scene.name}下优先考虑“${route.name}”，因为它和当前履历的已验证能力最接近，也更容易解释第一单从哪里来。`;
}

function buildAlternativeReason(candidate: CandidateRoute, fallbackReason: string | undefined) {
  return candidate.reason || fallbackReason || `当前更适合把 ${candidate.route.name} 作为具体落地方向。`;
}

const ROUTE_ASSET_KEYWORDS: Record<RouteId, string[]> = {
  project_delivery: ['交付', '项目', '落地', '页面', '设计', '开发', '物料', '搭建', '执行'],
  standardized_service: ['标准', '流程', 'sop', '模板', '打包', '复用', '月度', '套餐'],
  consulting: ['诊断', '策略', '框架', '判断', '方案', '梳理', '咨询'],
  agency: ['代运营', '运营', '增长', '社群', '投放', '内容', '账号', '执行'],
  channel_sales: ['销售', '商务', 'bd', '成交', '渠道', '客户', '转化'],
  training: ['培训', '教学', '陪跑', '课程', '答疑', '方法论'],
  resource_matching: ['资源', '撮合', '连接', '人脉', '供需'],
  research_service: ['研究', '分析', '报告', '选题', '策划', '洞察', '情报'],
  tool_product: ['自动化', '工具', '脚本', '工作流', 'agent', '插件', 'python'],
  vertical_saas: ['订阅', 'saas', '产品', '系统', '平台', '自动化'],
  content_ip: ['内容', '表达', '写作', '粉丝', '流量', '个人品牌', '账号'],
};

const SCENE_ASSET_KEYWORDS: Record<string, string[]> = {
  operations: ['运营', '增长', '活动', '转化', '数据', '社群', '执行'],
  content: ['内容', '研究', '选题', '表达', '写作', '策划'],
  technical: ['开发', '自动化', '工具', '数据', '脚本', '系统'],
  sales: ['销售', '客户', '成交', '商务', '渠道'],
  design: ['设计', '视觉', '品牌', '物料', '交付'],
  management: ['管理', '协调', '决策', '诊断', '组织'],
  junior: ['执行', '协助', '试单', '基础'],
};

function includesKeyword(text: string, keyword: string) {
  return Boolean(keyword && text.includes(keyword.toLowerCase()));
}

function buildStrategyAssets(
  assets: AssetItem[],
  route: RouteDefinition,
  scene: ScoredScene,
  resume: ResumeData
): AssetItem[] {
  if (!assets.length) return [];

  const sceneKeywords = SCENE_ASSET_KEYWORDS[scene.scene.id] || [];
  const routeKeywords = ROUTE_ASSET_KEYWORDS[route.id] || [];
  const topSkillKeywords = resume.skills.slice(0, 5).map((skill) => skill.name.toLowerCase());

  return assets
    .map((asset, index) => {
      const text = [asset.name, asset.evidence, asset.product].join(' ').toLowerCase();
      let score = asset.potential * 20 - index;
      const reasons: string[] = [];

      const routeKeywordHits = routeKeywords.filter((keyword) => includesKeyword(text, keyword));
      const sceneKeywordHits = sceneKeywords.filter((keyword) => includesKeyword(text, keyword));
      const signalHits = scene.matchedSignals.filter((signal) => includesKeyword(text, signal));
      const skillHits = topSkillKeywords.filter((keyword) => includesKeyword(text, keyword));
      const fitHits = route.fitSignals.filter((signal) => includesKeyword(text, signal));
      const notFitHits = route.notFitSignals.filter((signal) => includesKeyword(text, signal));

      score += routeKeywordHits.length * 14;
      score += sceneKeywordHits.length * 10;
      score += signalHits.length * 10;
      score += fitHits.length * 8;
      score += skillHits.length * 5;
      score -= notFitHits.length * 14;

      if (routeKeywordHits.length) reasons.push(`更贴近${route.name}所需的 ${routeKeywordHits.slice(0, 2).join(' / ')}`);
      if (sceneKeywordHits.length) reasons.push(`和${scene.scene.name}的 ${sceneKeywordHits.slice(0, 2).join(' / ')} 信号一致`);
      if (signalHits.length) reasons.push(`命中当前简历里的 ${signalHits.slice(0, 2).join(' / ')}`);
      if (!reasons.length && fitHits.length) reasons.push(`这项资产更适合走 ${route.name} 的成交路径`);
      if (notFitHits.length) score -= 6;

      return {
        ...asset,
        strategyReason: reasons[0] || `在当前定位下，这项资产更容易被包装成 ${route.name} 的成交入口`,
        __score: score,
      };
    })
    .sort((a, b) => b.__score - a.__score)
    .map(({ __score, ...asset }) => asset);
}

function buildFirstDealPlan(route: RouteDefinition, scene: ScoredScene, resume: ResumeData): NonNullable<StrategyOption['firstDealPlan']> {
  const industry = resume.industry || '当前行业';
  const coreSkills = resume.skills.slice(0, 3).map((item) => item.name).join('、') || '现有技能';
  const targetCustomerByScene: Record<string, string> = {
    operations: `在 ${industry} 里需要持续执行、增长或内容支持的中小团队`,
    content: `在 ${industry} 里需要研究、内容策划或表达转化的项目方`,
    technical: `在 ${industry} 里有提效或自动化需求，但不想先自建团队的客户`,
    sales: `在 ${industry} 里有明确拿单、渠道或供需连接需求的客户`,
    design: `在 ${industry} 里需要明确视觉交付物和改版支持的客户`,
    management: `在 ${industry} 里需要诊断、梳理和决策支持的负责人`,
    junior: `在 ${industry} 里愿意先买小服务或试单的轻量客户`,
  };

  const whereToFindByScene: Record<string, string> = {
    operations: '熟人网络、行业社群、私域、已有内容入口和前同事介绍',
    content: '行业社群、X/Twitter、公众号读者、研究讨论群和内容评论区',
    technical: '开发者社群、产品群、前同事、技术社区和需求明确的创业团队',
    sales: '老客户、行业群、上下游资源方和熟人转介绍',
    design: '老合作、朋友转介绍、设计社区和正在做增长的小品牌',
    management: '前同事、管理者圈层、行业社群和朋友介绍',
    junior: '熟人网络、低门槛试单平台和前雇主/前合作方',
  };

  const closingByRoute: Record<RouteId, string> = {
    project_delivery: '先用小项目或试单成交，明确交付边界、轮次和时间，再升级到更完整合作。',
    standardized_service: '先卖一个固定范围、固定流程、固定价格的服务包，用“边界清晰”降低客户决策成本。',
    consulting: '先卖一次诊断或方案梳理，不要一开始就谈长期顾问。',
    agency: '先卖专项代执行或轻量月度服务，再用结果复盘升级为长期合作。',
    channel_sales: '先撮合一单高匹配需求，用小佣金或服务费验证关系链条。',
    training: '先卖小班答疑、一对一陪跑或短周期训练营，不要先做大课。',
    resource_matching: '先完成一笔小撮合，验证供需两端与信任基础，再扩大资源池。',
    research_service: '先卖定制分析、研究报告或内容策略诊断，让客户先为判断与信息整理付费。',
    tool_product: '先以半定制工具或工作流搭建收费，用交付验证是否有重复付费需求。',
    vertical_saas: '只有在服务里反复验证之后，才适合转向订阅；首单不建议直接按 SaaS 逻辑成交。',
    content_ip: '把内容挂到服务、社群或咨询产品上成交，而不是只追曝光。',
  };

  return {
    targetCustomer: targetCustomerByScene[scene.scene.id] || `在 ${industry} 里最容易为 ${coreSkills} 付费的客户`,
    whereToFind: whereToFindByScene[scene.scene.id] || '熟人网络、老客户、前同事与垂直社群',
    approach: route.firstDealTemplate,
    closing: closingByRoute[route.id],
  };
}

function pickTopSignal(resume: ResumeData) {
  const achievement = resume.achievements.find((item) => item.metric || item.desc) || resume.achievements[0];
  if (achievement?.metric) return achievement.metric;
  if (achievement?.desc) return achievement.desc.slice(0, 18);
  return '';
}

function pickPortfolioHint(sceneId: string, resume: ResumeData) {
  const signal = pickTopSignal(resume);
  if (sceneId === 'operations') {
    return {
      title: signal ? `整理过往 ${signal} 案例和提效结果做作品集` : '整理过往增长案例和提效结果做作品集',
      howTo: '用 Notion、飞书文档或一页式 PDF 做 3 个案例卡：项目背景、你做了什么、结果数据、可复制的方法。每个案例只保留最强结果，不要写成长篇复盘。',
      whereToFind: '优先从简历里挑有播放、转化、活动结果、私域增长、AI 提效的数据；没有完整数据就用“动作前后对比 + 截图”补证据。',
      deliverable: '1 份可发给客户的作品集链接，至少包含 3 个案例卡和 1 段自我介绍。',
    };
  }

  if (sceneId === 'content') {
    return {
      title: '整理研究、选题或内容转化案例做表达样本',
      howTo: '每个样本都按“原始信息很乱 -> 你怎么重组 -> 输出成什么内容 -> 最终结果”来写，让客户看懂你不是会写字，而是会提炼和转化。',
      whereToFind: '从做过的研究文档、脚本、选题库、竞品拆解、公众号或社媒内容里抽 3 个最能代表判断力的样本。',
      deliverable: '1 份内容/研究作品集，能证明你有判断和转化能力，不只是会写文案。',
    };
  }

  if (sceneId === 'technical') {
    return {
      title: '整理自动化、交付结果或测试提效案例做技术样本',
      howTo: '每个案例用“问题 - 方案 - 节省了什么 - 最终结果”四段式来写，重点展示你如何把复杂问题变成可交付成果。',
      whereToFind: '从脚本、自动化流程、测试提效、工具搭建、报表体系、数据处理等经历中挑 2-3 个最能证明业务价值的案例。',
      deliverable: '1 份技术服务样本页，能让非技术客户也看懂你到底解决了什么。',
    };
  }

  return {
    title: `整理 ${resume.currentRole || '过往经历'} 的代表案例做样本`,
    howTo: '用“背景 - 动作 - 结果 - 可复制方法”整理 2-3 个案例，优先保留能证明结果的截图、数据和客户反馈。',
    whereToFind: '从你做过的项目、服务、活动、交付物和正反馈里，挑最能证明能力的内容。',
    deliverable: '1 份可以发给潜在客户的案例样本页。',
  };
}

function pickLeadSourceHint(sceneId: string, industry: string, routeName: string) {
  if (sceneId === 'operations') {
    return {
      title: '锁定 20 家目标中小企业主做定向触达',
      howTo: '优先挑“已经在做内容但做得不稳定”的商家，而不是完全没有需求的人。先列行业，再列账号，再列联系人，再逐个发触达信息。',
      whereToFind: `从抖音、小红书、视频号、公众号、本地生活平台、企查查、行业社群里找 ${industry || '中小企业'} 老板或市场负责人；也可以先从熟人转介绍开始。`,
      deliverable: '1 张 20 人潜在客户名单表，至少包含公司、联系人、平台链接、痛点判断和触达进度。',
    };
  }

  if (sceneId === 'content') {
    return {
      title: '锁定愿意为研究、选题或内容转化付费的项目方',
      howTo: '优先找已经有内容需求但表达质量不稳定的团队，不要泛泛去找所有品牌。先判断谁有持续更新需求，再去触达。',
      whereToFind: `从 X/Twitter、公众号、知识星球、行业群、项目官网和社群里找 ${industry || '目标行业'} 的内容负责人或创始人。`,
      deliverable: '1 张目标客户表，至少列出 20 个潜在客户和你判断他们可能购买的原因。',
    };
  }

  if (sceneId === 'technical') {
    return {
      title: '锁定有明确提效需求的团队或项目方',
      howTo: '不要一开始就找大公司，优先找“人少事多、流程重复、有人愿意快速试用”的团队。触达时直接说你能替他们省掉哪类重复工作。',
      whereToFind: `从开发者社群、产品群、创业者社群、独立开发者社区、行业微信群和前同事网络里找 ${industry || '相关行业'} 的小团队。`,
      deliverable: '1 张精准客户表，写清楚他们的问题、你能切入的动作和第一句触达话术。',
    };
  }

  return {
    title: `锁定愿意为 ${routeName} 付费的第一批客户`,
    howTo: '先找最容易成交的人，不要一上来就全网海投。用熟人、老客户、前同事和已有渠道验证你的描述是否打得中需求。',
    whereToFind: `优先从熟人网络、老合作方、行业社群和已有内容入口里找 ${industry || '目标行业'} 的客户。`,
    deliverable: '1 张首批潜在客户名单和触达记录表。',
  };
}

function pickOfferHint(route: RouteDefinition, sceneId: string) {
  if (sceneId === 'operations') {
    return {
      title: '推出低价引流版服务包',
      howTo: '先做一个低门槛版本，比如“单月 AI 内容规划”“7 天内容诊断”“短视频选题+脚本包”。只卖一个结果，不要把拍摄、剪辑、账号陪跑全塞进去。',
      whereToFind: '先让熟人客户、试单客户或前 20 个触达对象试听你的描述，看他们愿不愿意为这个最小版本付款。',
      deliverable: '1 页服务包说明：适合谁、交付什么、多久交付、价格多少、为什么值得买。',
    };
  }

  if (sceneId === 'content') {
    return {
      title: '推出最小研究/内容产品',
      howTo: '把服务包限制在一个非常具体的结果上，比如“1 次选题诊断”“1 份竞品研究卡”“1 周内容方向梳理”。不要一次卖长期内容顾问。',
      whereToFind: '优先给已经愿意聊需求的客户发这份服务说明，再根据反馈缩小边界。',
      deliverable: '1 个最小产品说明页和 1 条成交时可直接发送的标准话术。',
    };
  }

  if (sceneId === 'technical') {
    return {
      title: '推出可试用的轻量服务包',
      howTo: '把技术能力包成客户能理解的小结果，比如“自动化表单流程搭建”“周报自动生成”“测试流程诊断”。不要直接卖抽象技术能力。',
      whereToFind: '优先对已经有明确痛点的客户试卖，观察他们对结果描述、交付周期和价格的反应。',
      deliverable: '1 个轻量服务包描述页，重点写客户结果，而不是技术术语。',
    };
  }

  return {
    title: `推出 ${route.name} 的最小成交版本`,
    howTo: '先卖一个边界清晰、价格清楚、交付时间短的小版本。先证明有人愿意买，再考虑扩服务范围。',
    whereToFind: '先发给对你最有信任基础的人测试，再根据反馈修订。',
    deliverable: '1 个可报价的最小服务包页面。',
  };
}

function pickDeliveryHint(route: RouteDefinition, sceneId: string) {
  if (sceneId === 'operations') {
    return {
      title: '把首单交付过程沉淀成固定模板',
      howTo: '交付时同步记录每一步：沟通提纲、素材清单、内容框架、交付格式、复盘模板。你不是只完成项目，而是在积累下次更快成交和交付的素材。',
      whereToFind: '从首单真实交付过程里倒推，不需要额外找资料。',
      deliverable: '1 套首单交付 SOP，至少包含沟通清单、交付模板和复盘模板。',
    };
  }

  if (sceneId === 'content') {
    return {
      title: '把研究/策划过程标准化',
      howTo: '把你做研究、选题、梳理结构的方法写成固定模板，下次接新客户时只替换素材，不要全部重来。',
      whereToFind: '从首单里提炼重复动作，比如资料搜集、角度判断、结构输出、交付说明。',
      deliverable: '1 套研究/内容服务模板包。',
    };
  }

  if (sceneId === 'technical') {
    return {
      title: '把技术交付过程写成可复用文档',
      howTo: '把需求确认、数据准备、流程搭建、测试、交付、回访这几个步骤固化下来，减少下一单重新解释和重复劳动。',
      whereToFind: '从首单交付过程里沉淀，重点记录客户最关心的非技术解释。',
      deliverable: '1 套技术服务交付清单和说明文档。',
    };
  }

  return {
    title: '把首单变成可复制的交付流程',
    howTo: '固定报价、沟通、交付和复盘动作，让下一次成交和交付都更省力。',
    whereToFind: '从首单里提炼重复动作，逐步标准化。',
    deliverable: '1 套可复用的服务交付模板。',
  };
}

function pickStabilityHint(route: RouteDefinition, sceneId: string) {
  if (sceneId === 'operations') {
    return {
      title: '从试单升级到月度或专项稳定合作',
      howTo: '把首单结果复盘成“问题 - 动作 - 结果”案例，再顺势提出第二阶段合作，比如月度内容规划、代运营、专项增长支持。',
      whereToFind: '先从首单客户、老客户和转介绍里升级，不要完全依赖新客户开发。',
      deliverable: '1 套升级版服务包和 1 份可复用案例页。',
    };
  }

  if (sceneId === 'content') {
    return {
      title: '把单次服务升级成持续研究或内容产品',
      howTo: '把高频需求沉淀成月度报告、专题栏目、数据库、会员订阅或固定陪跑服务，让收入不只来自单次定制。',
      whereToFind: '从重复问同类问题的客户和读者里判断哪些需求适合做成持续产品。',
      deliverable: '1 个持续型产品雏形，比如月报、会员或固定服务计划。',
    };
  }

  if (sceneId === 'technical') {
    return {
      title: '把服务升级成模板、工具或持续支持',
      howTo: '观察首单里哪些动作重复出现，能模板化的模板化，能工具化的工具化，再决定是继续卖服务还是加一个轻量产品层。',
      whereToFind: '优先从已交付客户的重复需求里找，不要脱离真实场景空想产品。',
      deliverable: '1 份升级路线图：哪些继续服务，哪些抽成模板，哪些值得做成工具。',
    };
  }

  return {
    title: `把 ${route.name} 升级成更稳的收入结构`,
    howTo: route.upgradePath,
    whereToFind: '优先从复购、升级和转介绍里做稳定化，不要只靠不断找新客。',
    deliverable: '1 个升级后的收入结构草图。',
  };
}

function buildPhase(phase: string, duration: string, goal: string, actionDetails: GrowthActionDetail[], milestone: string): GrowthPathPhase {
  return {
    phase,
    duration,
    goal,
    actions: actionDetails.map((item) => item.title),
    actionDetails,
    milestone,
  };
}

function buildGrowthPath(route: RouteDefinition, scene: ScoredScene, resume: ResumeData): StrategyOption['growthPath'] {
  const industry = resume.industry || scene.scene.name;

  const verificationActions = [
    pickPortfolioHint(scene.scene.id, resume),
    pickLeadSourceHint(scene.scene.id, industry, route.name),
    pickOfferHint(route, scene.scene.id),
  ];

  const deliveryActions = [
    {
      title: '固定沟通、报价和交付话术',
      howTo: '把首轮沟通里最常被问到的问题整理成标准回答，把报价结构、交付清单和边界说明写成固定版本，避免每次临时发挥。',
      whereToFind: '直接从你第一次成交前后的聊天记录、语音和会议纪要里提炼。',
      deliverable: '1 份标准沟通话术 + 报价说明 + 交付清单。',
    },
    {
      title: `围绕 ${scene.scene.name} 的强痛点先做试单或小单`,
      howTo: '不要一开始就卖大单。先拿一个能在 7-14 天看到结果的小范围项目，目标是验证成交和交付，而不是一次赚最多。',
      whereToFind: '优先从最容易信任你的人里试单，比如熟人网络、老同事、老客户或当前正在沟通的潜在客户。',
      deliverable: '1 个已成交的小单或 1 轮有明确需求反馈的试单沟通记录。',
    },
    pickDeliveryHint(route, scene.scene.id),
  ];

  const stabilityActions = [
    pickStabilityHint(route, scene.scene.id),
    {
      title: '筛掉低利润动作，保留高复购动作',
      howTo: '回看首单和试单：哪些动作最耗时但客户不愿意多付钱，哪些动作客户最看重、最愿意复购。前者砍掉，后者保留并加强。',
      whereToFind: '从交付复盘、客户反馈和报价拉扯最多的环节里判断。',
      deliverable: '1 份保留/删减动作清单，明确哪些服务继续卖，哪些以后不接。',
    },
    {
      title: '建立案例展示和转介绍入口',
      howTo: '把最好的成交案例整理成一页式案例，固定放在作品集、朋友圈、公众号、个人主页或介绍页里，并在交付结束后主动索取推荐语和转介绍。',
      whereToFind: '从已完成项目的结果、评价、截图、客户聊天记录里提取素材。',
      deliverable: '1 个案例页 + 1 条主动索要推荐语/转介绍的话术。',
    },
  ];

  return [
    buildPhase(
      '验证期',
      '第 1-2 周',
      `先把 ${route.name} 做成能快速解释、快速报价、快速试卖的最小版本。`,
      verificationActions,
      `拿到第一轮真实反馈，确认 ${route.name} 是否是你当前最短的变现路径。`
    ),
    buildPhase(
      '交付期',
      '第 3-6 周',
      `跑通 ${route.name} 的首单交付，并把“会做”变成“可复用”。`,
      deliveryActions,
      '形成第一套对外可展示的成交样本、交付模板和沟通话术。'
    ),
    buildPhase(
      '稳定期',
      '第 2-3 个月',
      `把 ${route.name} 从单次成交升级成更稳的复购、升级或转介绍收入。`,
      stabilityActions,
      '形成更稳定的服务版本和升级路径，不再每个月都从零找单。'
    ),
  ];
}

function buildRevenueModel(route: RouteDefinition, scene: ScoredScene): StrategyOption['revenueModel'] {
  const routeRevenue: Record<RouteId, StrategyOption['revenueModel']> = {
    project_delivery: [
      { phase: '起步期', product: '小项目/试单', pricing: '1500-5000 元/次', target: '需要明确交付物的客户', expectedIncome: '3000-10000 元/月' },
      { phase: '稳定期', product: '专项项目包', pricing: '5000-15000 元/项目', target: '愿意为清晰结果付费的中小客户', expectedIncome: '10000-30000 元/月' },
      { phase: '升级期', product: '长期支持/打包服务', pricing: '8000-30000 元/月', target: '复购客户与长期合作方', expectedIncome: '30000 元+/月' },
    ],
    standardized_service: [
      { phase: '起步期', product: '固定范围服务包', pricing: '1000-3000 元/包', target: '希望快速试用的小客户', expectedIncome: '3000-10000 元/月' },
      { phase: '稳定期', product: '标准版服务套餐', pricing: '3000-10000 元/项目', target: '重复需求明显的中小团队', expectedIncome: '10000-30000 元/月' },
      { phase: '升级期', product: '高阶套餐/顾问版', pricing: '8000-20000 元/月', target: '愿意为效率和结果付费的复购客户', expectedIncome: '30000 元+/月' },
    ],
    consulting: [
      { phase: '起步期', product: '诊断单/策略梳理', pricing: '1000-3000 元/次', target: '有明确问题但尚未决定长期合作的客户', expectedIncome: '3000-8000 元/月' },
      { phase: '稳定期', product: '专项顾问', pricing: '5000-15000 元/项目', target: '需要判断与框架支持的负责人', expectedIncome: '10000-30000 元/月' },
      { phase: '升级期', product: '季度顾问/高阶咨询', pricing: '10000-30000 元/月', target: '需要持续决策支持的高价值客户', expectedIncome: '30000 元+/月' },
    ],
    agency: [
      { phase: '起步期', product: '专项代执行', pricing: '2000-5000 元/次', target: '想先试用执行能力的客户', expectedIncome: '5000-12000 元/月' },
      { phase: '稳定期', product: '月度代运营', pricing: '5000-15000 元/月', target: '需要持续增长、内容或社区支持的团队', expectedIncome: '15000-40000 元/月' },
      { phase: '升级期', product: '顾问 + 代执行组合', pricing: '10000-30000 元/月', target: '已经认可结果的长期客户', expectedIncome: '30000 元+/月' },
    ],
    channel_sales: [
      { phase: '起步期', product: '佣金撮合/渠道试单', pricing: '按单抽成', target: '已有供需连接机会的客户', expectedIncome: '不固定，先验证成交' },
      { phase: '稳定期', product: '代理/渠道合作', pricing: '佣金 + 服务费', target: '愿意持续合作的供需双方', expectedIncome: '10000-30000 元/月' },
      { phase: '升级期', product: '渠道包/行业顾问', pricing: '5000-20000 元/月', target: '需要稳定拿单的客户', expectedIncome: '30000 元+/月' },
    ],
    training: [
      { phase: '起步期', product: '小班答疑/一对一陪跑', pricing: '999-2999 元/人', target: '想快速解决具体问题的个人客户', expectedIncome: '3000-10000 元/月' },
      { phase: '稳定期', product: '训练营/专项陪跑', pricing: '2999-9999 元/期', target: '需要阶段性陪跑的目标用户', expectedIncome: '10000-30000 元/月' },
      { phase: '升级期', product: '课程/社群/会员', pricing: '199-1999 元/订阅', target: '认可方法论并愿意持续学习的用户', expectedIncome: '30000 元+/月' },
    ],
    resource_matching: [
      { phase: '起步期', product: '小撮合/资源介绍', pricing: '佣金或服务费', target: '已有高匹配关系链的客户', expectedIncome: '先验证小额成交' },
      { phase: '稳定期', product: '行业资源包', pricing: '2000-10000 元/次', target: '需要快速找人/找资源的客户', expectedIncome: '10000-20000 元/月' },
      { phase: '升级期', product: '社群/行业情报', pricing: '订阅或会员', target: '需要持续资源连接的人群', expectedIncome: '20000 元+/月' },
    ],
    research_service: [
      { phase: '起步期', product: '研究诊断/轻报告', pricing: '1000-3000 元/次', target: '需要快速获得判断与洞察的客户', expectedIncome: '3000-10000 元/月' },
      { phase: '稳定期', product: '定制研究/内容策划', pricing: '3000-10000 元/项目', target: '需要行业分析、选题或内容框架的项目方', expectedIncome: '10000-25000 元/月' },
      { phase: '升级期', product: '专题库/会员/数据库', pricing: '199-1999 元/订阅', target: '愿意持续购买情报和研究产品的用户', expectedIncome: '25000 元+/月' },
    ],
    tool_product: [
      { phase: '起步期', product: '半定制工具/工作流搭建', pricing: '2000-8000 元/次', target: '有明确提效需求的客户', expectedIncome: '5000-15000 元/月' },
      { phase: '稳定期', product: '复用型工具包', pricing: '99-999 元/份', target: '已有验证过的重复问题用户', expectedIncome: '10000-30000 元/月' },
      { phase: '升级期', product: '工具订阅/插件套件', pricing: '199-1999 元/月', target: '高频复购用户', expectedIncome: '30000 元+/月' },
    ],
    vertical_saas: [
      { phase: '起步期', product: '服务验证', pricing: '先收服务费', target: '当前不建议直接走 SaaS', expectedIncome: '以验证为主' },
      { phase: '稳定期', product: '轻量订阅原型', pricing: '99-499 元/月', target: '重复需求用户', expectedIncome: '取决于验证结果' },
      { phase: '升级期', product: '正式 SaaS', pricing: '按席位/订阅收费', target: '真实复购客户', expectedIncome: '长期路线，不作为首选' },
    ],
    content_ip: [
      { phase: '起步期', product: '内容获客 + 服务承接', pricing: '先以服务为主', target: '当前更适合作为辅助路径', expectedIncome: '不建议单独以 IP 为收入模型' },
      { phase: '稳定期', product: '课程/会员/社群', pricing: '199-1999 元/期', target: '已经被内容筛选过的精准用户', expectedIncome: '视商业化验证而定' },
      { phase: '升级期', product: '品牌/IP 产品矩阵', pricing: '多元化', target: '已有稳定转化基础的用户群体', expectedIncome: '长期路线，不建议首发' },
    ],
  };

  return routeRevenue[route.id].map((item) => ({
    ...item,
    target: `${item.target}，更偏向 ${scene.scene.name} 的目标客群`,
  }));
}

function buildRisks(route: RouteDefinition, scene: ScoredScene): StrategyOption['risks'] {
  const baseRisks = route.risks.slice(0, 2).map((risk, index) => ({
    point: `${route.name}常见风险 ${index + 1}`,
    warning: risk,
    solution: index === 0 ? '先缩小范围、收紧边界，再验证真实付费。' : '优先保留高反馈动作，把非核心部分模块化或单独收费。',
  }));

  return [
    ...baseRisks,
    {
      point: '场景错配',
      warning: `如果 ${scene.scene.name} 的真实客户需求和当前方案不一致，这条路径会看起来合理但很难成交。`,
      solution: '用真实沟通和小额试单验证，不要只凭自我感觉决定方案是否成立。',
    },
  ];
}

function buildChecklist(route: RouteDefinition): StrategyOption['checklist'] {
  const routeTasks: Record<RouteId, string[][]> = {
    project_delivery: [
      ['整理 3 个可展示项目样本', '写清楚交付边界、周期和价格'],
      ['联系熟人或老合作方争取试单', '准备项目报价与案例页'],
      ['交付首单并复盘修改点', '把高频动作沉淀成模板'],
      ['测试升级版项目包', '建立转介绍或复购路径'],
    ],
    standardized_service: [
      ['定义 1 个固定服务包', '写清楚适用对象、边界与报价'],
      ['用 3-5 位潜在客户验证描述是否容易理解', '优化服务文案和成交脚本'],
      ['完成第一单标准化交付', '整理 SOP 与交付清单'],
      ['把套餐分层', '建立案例页与常见问题说明'],
    ],
    consulting: [
      ['确定 1 个擅长诊断的问题场景', '写出一次诊断单的交付范围'],
      ['联系可快速成交的熟人客户', '用低门槛诊断换取首个反馈'],
      ['交付第一份诊断建议', '沉淀复盘模板与诊断框架'],
      ['测试季度顾问或陪跑升级方案', '整理高价值案例'],
    ],
    agency: [
      ['确定 1 个专项代执行切口', '写出月度或专项服务边界'],
      ['整理执行案例、数据结果和沟通脚本', '联系目标客户试探需求'],
      ['完成首个代执行项目', '复盘结果并补充周报/SOP 模板'],
      ['升级为月度服务版本', '建立复购与转介绍流程'],
    ],
    channel_sales: [
      ['梳理现有供需两端资源', '筛出高匹配的首单机会'],
      ['联系双方确认需求和成交条件', '设计佣金或服务费方式'],
      ['撮合第一单并复盘流程', '记录可复制的话术和条件'],
      ['尝试做更稳定的渠道包', '筛选可持续合作的资源方'],
    ],
    training: [
      ['明确一个最擅长教的主题', '设计小班或一对一版本'],
      ['找第一批精准用户访谈', '确定课程/陪跑最小结构'],
      ['完成第一期陪跑或答疑', '记录共性问题与结果'],
      ['升级成训练营或课程雏形', '建立学员反馈和案例机制'],
    ],
    resource_matching: [
      ['梳理现有资源池', '筛出最容易成交的两端需求'],
      ['完成 1 次小撮合', '验证收费与信任机制'],
      ['记录流程与风险点', '补充可复用的资源说明'],
      ['尝试做行业情报或资源包', '提高可复制性'],
    ],
    research_service: [
      ['整理 3 个研究或内容转译样本', '定义 1 个可卖的研究产品'],
      ['联系精准需求方', '测试诊断、报告或选题服务描述'],
      ['完成首份付费研究交付', '沉淀报告模板与资料库'],
      ['把高频研究动作知识库化', '测试会员或专题库雏形'],
    ],
    tool_product: [
      ['梳理 1 个重复提效问题', '定义半定制工具或工作流交付范围'],
      ['联系有真实需求的客户验证', '用服务方式完成首个工具交付'],
      ['复盘哪些动作适合抽象成通用能力', '整理文档与配置模板'],
      ['测试轻量产品化版本', '观察是否有重复付费需求'],
    ],
    vertical_saas: [
      ['不要直接做 SaaS', '先通过服务验证重复需求'],
      ['记录真实客户的高频问题', '找到可产品化的最小模块'],
      ['先收服务费再决定是否开发', '避免无验证开发'],
      ['只有复购明确后再做订阅产品', '谨慎投入开发成本'],
    ],
    content_ip: [
      ['先定义内容背后的服务承接物', '不要只做曝光'],
      ['用内容筛选潜在客户', '观察真实成交反馈'],
      ['把高反馈主题沉淀成产品雏形', '验证课程/社群/会员可能性'],
      ['只有商业化成立后再强化 IP', '保持现金流优先'],
    ],
  };

  return routeTasks[route.id].map((tasks, index) => ({
    week: `第 ${index + 1} 阶段`,
    tasks,
  }));
}

function scoreSupplementCaseScore(routeId: RouteId, sceneId: string, matchRoute: boolean, matchScene: boolean) {
  let score = 6;
  if (matchRoute) score += 3;
  if (matchScene) score += 2;
  if (routeId === 'content_ip' || routeId === 'vertical_saas') score -= 1;
  return score;
}

function buildRecommendedCases(route: RouteDefinition, scene: ScoredScene, knowledgeContext: KnowledgeContext): RecommendedCase[] {
  const existing = knowledgeContext.recommendedCases.filter(
    (item) =>
      item.matchedSignals.some((signal) => signal.includes(route.id) || signal.includes(scene.scene.id)) ||
      item.title.includes(route.name)
  );

  const supplements = CASE_DEFINITIONS.filter((item) => item.routeId === route.id || item.sceneId === scene.scene.id).map((item) => {
    const matchRoute = item.routeId === route.id;
    const matchScene = item.sceneId === scene.scene.id;
    const score = scoreSupplementCaseScore(route.id, scene.scene.id, matchRoute, matchScene);

    return {
      id: item.id,
      title: item.title,
      background: item.background,
      trigger: item.trigger,
      firstDeal: item.firstDeal,
      monetization: item.monetization,
      assetUpgrade: item.assetUpgrade,
      sourceLabel: item.sourceLabel,
      sourceType: item.sourceType,
      score,
      scoreLabel: score >= 10 ? 'high' : score >= 7 ? 'medium' : 'low',
      recommendationReason: matchRoute
        ? `这条案例和当前方案的主路线“${route.name}”一致。`
        : `这条案例和当前匹配场景“${scene.scene.name}”一致。`,
      matchedSignals: uniqueStrings([
        matchRoute ? `路线匹配：${route.id}` : '',
        matchScene ? `场景匹配：${scene.scene.id}` : '',
      ]),
      matchedTags: item.tags.slice(0, 3),
    } satisfies RecommendedCase;
  });

  return uniqueById([...existing, ...supplements]).slice(0, 3);
}

function buildFaqHints(route: RouteDefinition, knowledgeContext: KnowledgeContext) {
  const faqIds = new Set<string>(knowledgeContext.recommendedFaqs.map((item) => item.id));

  if (route.id === 'content_ip') {
    faqIds.add('why-not-ip');
  }

  if (route.id === 'vertical_saas' || route.id === 'tool_product') {
    faqIds.add('why-not-saas');
  }

  faqIds.add('why-first-deal');

  return FAQ_DEFINITIONS.filter((item) => faqIds.has(item.id)).map((item) => ({
    id: item.id,
    question: item.question,
    answer: item.answer,
  }));
}

function buildKnowledgeGuidance(
  routeCandidate: CandidateRoute,
  scene: ScoredScene,
  knowledgeContext: KnowledgeContext
): NonNullable<StrategyOption['knowledgeGuidance']> {
  const articleIds = uniqueStrings([
    ...scene.scene.recommendedArticleIds,
    ...routeCandidate.route.recommendedArticleIds,
    ...METHODOLOGY_ARTICLES.slice(0, 2).map((item) => item.id),
  ]);

  return {
    scene: scene.scene.name,
    sceneSummary: scene.scene.summary,
    sceneReason:
      scene.matchedSignals.length > 0
        ? `命中信号：${scene.matchedSignals.join('、')}。${scene.scene.reasonTemplate}`
        : scene.scene.reasonTemplate,
    matchedSignals: scene.matchedSignals,
    recommendedRoutes: uniqueStrings([
      routeCandidate.route.name,
      ...knowledgeContext.candidateRoutes
        .filter((item) => item.route.id !== routeCandidate.route.id)
        .slice(0, 2)
        .map((item) => item.route.name),
    ]).map((name) => {
      const candidate = knowledgeContext.candidateRoutes.find((item) => item.route.name === name);
      return {
        name,
        reason: candidate?.reason || `这条路线和当前场景“${scene.scene.name}”有较高匹配度。`,
      };
    }),
    rejectedRoutes: knowledgeContext.rejectedRoutes
      .map((item) => item.name)
      .filter((name) => name !== routeCandidate.route.name),
    recommendedArticles: pickArticles(articleIds),
    recommendedCases: buildRecommendedCases(routeCandidate.route, scene, knowledgeContext),
    faqHints: buildFaqHints(routeCandidate.route, knowledgeContext),
  };
}

function buildFallbackOption(result: AnalysisResult): StrategyOption[] {
  if (!result.routeSelection) return [];

  return [
    {
      id: 'primary',
      label: '主定位',
      title: result.positioning.primary,
      summary: '当前报告仅返回了主方案，未生成可切换的备选策略。',
      assets: result.assets,
      routeSelection: result.routeSelection,
      firstDealPlan: result.firstDealPlan,
      knowledgeGuidance: result.knowledgeGuidance,
      growthPath: result.growthPath,
      revenueModel: result.revenueModel,
      risks: result.risks,
      checklist: result.checklist,
    },
  ];
}

export function buildStrategyOptions(
  result: AnalysisResult,
  knowledgeContext: KnowledgeContext,
  resume: ResumeData
): StrategyOption[] {
  const orderedCandidates = resolveOrderedCandidates(result, knowledgeContext);
  if (!orderedCandidates.length || !result.routeSelection) {
    return buildFallbackOption(result);
  }
  const primaryRouteSelection = result.routeSelection;

  return orderedCandidates.slice(0, 3).map((candidate, index) => {
    const optionId = OPTION_IDS[index];
    const scene = pickSceneForRoute(candidate.route, knowledgeContext);
    const routeSelection =
      optionId === 'primary'
        ? {
            mainRoute: primaryRouteSelection.mainRoute || candidate.route.name,
            secondaryRoutes: uniqueStrings([
              ...primaryRouteSelection.secondaryRoutes,
              ...orderedCandidates
                .filter((item) => item.route.id !== candidate.route.id)
                .slice(0, 2)
                .map((item) => item.route.name),
            ]).slice(0, 2),
            rejectedRoutes: uniqueStrings([
              ...primaryRouteSelection.rejectedRoutes,
              ...knowledgeContext.rejectedRoutes.map((item) => item.name),
            ]),
            reason: primaryRouteSelection.reason || candidate.reason,
          }
        : {
            mainRoute: candidate.route.name,
            secondaryRoutes: orderedCandidates
              .filter((item) => item.route.id !== candidate.route.id)
              .slice(0, 2)
              .map((item) => item.route.name),
            rejectedRoutes: knowledgeContext.rejectedRoutes
              .map((item) => item.name)
              .filter((name) => name !== candidate.route.name),
            reason: buildAlternativeReason(candidate, result.routeSelection?.reason),
          };

    return {
      id: optionId,
      label: OPTION_LABELS[optionId],
      title: buildOptionTitle(result, optionId, candidate.route.name),
      summary: buildOptionSummary(candidate.route, scene),
      assets: buildStrategyAssets(result.assets, candidate.route, scene, resume),
      routeSelection,
      firstDealPlan: optionId === 'primary' && result.firstDealPlan ? result.firstDealPlan : buildFirstDealPlan(candidate.route, scene, resume),
      knowledgeGuidance:
        optionId === 'primary' && result.knowledgeGuidance
          ? {
              ...result.knowledgeGuidance,
              recommendedRoutes: uniqueStrings([
                routeSelection.mainRoute,
                ...routeSelection.secondaryRoutes,
              ])
                .map((routeName) => {
                  const routeCandidate = knowledgeContext.candidateRoutes.find((item) => item.route.name === routeName);
                  return routeCandidate
                    ? {
                        name: routeName,
                        reason: routeCandidate.reason,
                      }
                    : null;
                })
                .filter(Boolean) as NonNullable<StrategyOption['knowledgeGuidance']>['recommendedRoutes'],
            }
          : buildKnowledgeGuidance(candidate, scene, knowledgeContext),
      growthPath: buildGrowthPath(candidate.route, scene, resume),
      revenueModel: optionId === 'primary' ? result.revenueModel : buildRevenueModel(candidate.route, scene),
      risks: optionId === 'primary' ? result.risks : buildRisks(candidate.route, scene),
      checklist: optionId === 'primary' ? result.checklist : buildChecklist(candidate.route),
    } satisfies StrategyOption;
  });
}
