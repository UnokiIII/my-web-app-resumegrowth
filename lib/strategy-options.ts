import type { AnalysisResult, AssetItem, ResumeData, StrategyOption } from './mock-data';
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

function buildGrowthPath(route: RouteDefinition, scene: ScoredScene, resume: ResumeData): StrategyOption['growthPath'] {
  const assetText = resume.skills.slice(0, 3).map((item) => item.name).join('、') || '现有能力';

  return [
    {
      phase: '验证期',
      duration: '第 1-2 周',
      goal: `把 ${route.name} 做成一个能快速报价的最小版本，验证第一单是否成立。`,
      actions: [
        `围绕 ${assetText} 整理 2-3 个最能证明能力的案例或结果片段。`,
        `把 ${route.name} 的交付边界、周期、价格和适用客户写成一页方案。`,
        `优先联系最容易成交的熟人网络或已有流量入口，做第一轮真实沟通。`,
      ],
      milestone: `拿到一轮明确反馈，确认 ${route.name} 是否能成为主切口。`,
    },
    {
      phase: '成交期',
      duration: '第 3-6 周',
      goal: `跑通 ${route.name} 的首单交付，并沉淀出可重复动作。`,
      actions: [
        '把沟通脚本、报价话术和交付清单固定下来，减少每次从零开始。',
        `围绕 ${scene.scene.name} 里最强的一个痛点，先卖小单或试单。`,
        '交付完成后立刻收集结果、评价和可复用样本，补强下一次成交。',
      ],
      milestone: '形成第一个可对外展示的成交样本与服务版本。',
    },
    {
      phase: '升级期',
      duration: '第 2-3 个月',
      goal: `把 ${route.name} 从一次性交付升级为更稳定的收入模型。`,
      actions: [
        route.upgradePath,
        '根据复盘决定保留哪些高利润动作，哪些动作模板化或工具化。',
        '建立转介绍、案例展示和内容分发机制，让获客不只依赖临时沟通。',
      ],
      milestone: '形成更稳定的复购、升级或转介绍路径。',
    },
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
      growthPath: optionId === 'primary' ? result.growthPath : buildGrowthPath(candidate.route, scene, resume),
      revenueModel: optionId === 'primary' ? result.revenueModel : buildRevenueModel(candidate.route, scene),
      risks: optionId === 'primary' ? result.risks : buildRisks(candidate.route, scene),
      checklist: optionId === 'primary' ? result.checklist : buildChecklist(candidate.route),
    } satisfies StrategyOption;
  });
}
