import type { ResumeData } from './mock-data';
import {
  CASE_DEFINITIONS,
  FAQ_DEFINITIONS,
  METHODOLOGY_ARTICLES,
  METHODOLOGY_RULES,
  ROUTE_ARTICLES,
  ROUTE_DEFINITIONS,
  SCENE_ARTICLES,
  SCENE_DEFINITIONS,
  type CandidateRoute,
  type CaseTag,
  type FaqDefinition,
  type KnowledgeArticleRef,
  type KnowledgeContext,
  type RecommendedCase,
  type RouteDefinition,
  type RouteId,
  type SceneDefinition,
  type ScoredScene,
} from './knowledge';

const ARTICLE_POOL: KnowledgeArticleRef[] = [...METHODOLOGY_ARTICLES, ...ROUTE_ARTICLES, ...SCENE_ARTICLES];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function splitKeywords(value: string) {
  return normalize(value)
    .split(/[、，,|/()（）\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function collectResumeKeywords(resume: ResumeData) {
  return [
    ...splitKeywords(resume.currentRole),
    ...splitKeywords(resume.industry),
    ...resume.skills.flatMap((skill) => splitKeywords(skill.name)),
    ...resume.interests.flatMap(splitKeywords),
    ...resume.experience.flatMap((item) => [
      ...splitKeywords(item.company),
      ...splitKeywords(item.role),
      ...item.highlights.flatMap(splitKeywords),
    ]),
    ...resume.achievements.flatMap((item) => splitKeywords(item.desc)),
  ];
}

function containsKeyword(keywords: string[], keyword: string) {
  const token = normalize(keyword);
  return keywords.some((value) => value.includes(token) || token.includes(value));
}

function uniqueById<T extends { id: string }>(items: T[]) {
  const seen = new Set<string>();
  return items.filter((item) => {
    if (seen.has(item.id)) return false;
    seen.add(item.id);
    return true;
  });
}

function scoreScene(scene: SceneDefinition, keywords: string[]): ScoredScene {
  const matchedSignals = new Set<string>();
  let score = 0;

  for (const keyword of scene.roleKeywords) {
    if (containsKeyword(keywords, keyword)) {
      matchedSignals.add(keyword);
      score += 4;
    }
  }

  for (const keyword of scene.skillKeywords) {
    if (containsKeyword(keywords, keyword)) {
      matchedSignals.add(keyword);
      score += 3;
    }
  }

  for (const keyword of scene.interestKeywords) {
    if (containsKeyword(keywords, keyword)) {
      matchedSignals.add(keyword);
      score += 1;
    }
  }

  return { scene, score, matchedSignals: Array.from(matchedSignals) };
}

function pickArticles(articleIds: string[]) {
  return uniqueById(ARTICLE_POOL.filter((item) => articleIds.includes(item.id)));
}

function pickRelevantScenes(scoredScenes: ScoredScene[]) {
  if (!scoredScenes.length) return [];

  const primary = scoredScenes[0];
  const picked = [primary];
  const secondary = scoredScenes
    .slice(1)
    .find((item) => item.score > 0 && item.score >= Math.max(primary.score - 4, Math.ceil(primary.score * 0.6)));

  if (secondary) picked.push(secondary);
  return picked;
}

function addWeight(weights: Map<RouteId, number>, routeId: RouteId, value: number) {
  weights.set(routeId, (weights.get(routeId) || 0) + value);
}

function applyRouteHeuristics(weights: Map<RouteId, number>, resume: ResumeData, keywords: string[]) {
  const text = keywords.join(' ').toLowerCase();
  const hasContentSignals =
    /(新媒体|内容运营|内容策划|内容编辑|文案|写作|选题|公众号|小红书|微博|抖音|tiktok|twitter)/.test(text) &&
    !/(测试内容|需求内容)/.test(text);
  const hasContentCommercialization = /(知识付费|付费社群|咨询服务|咨询成交|付费课程|训练营|会员订阅|内容变现|社群变现|个人品牌成交|广告报价)/.test(text);
  const hasOpsSignals = /(运营|矩阵|增长|社区|社群|用户|传播|推广|公关|活动执行|投放)/.test(text);
  const hasResearchSignals = /(研究|投研|分析|研报|选题|洞察|市场情绪)/.test(text);
  const hasDesignSignals = /(设计|视觉|物料|品牌|photoshop|illustrator|ps)/.test(text);
  const hasTechSignals = /(开发|工程|python|javascript|sql|脚本|api|自动化|agent|工作流|测试|qa|bug|airtest|unity|git|svn|性能测试|弱网测试|适配测试)/.test(text);
  const hasSalesSignals = /(销售|bd|商务|渠道|撮合)/.test(text);
  const hasManagementSignals = /(主编|负责人|经理|总监|董事长助理|带团队|项目管理)/.test(text);

  if (hasDesignSignals) {
    addWeight(weights, 'project_delivery', 16);
    addWeight(weights, 'standardized_service', 10);
  }

  if (hasOpsSignals) {
    addWeight(weights, 'agency', 18);
    addWeight(weights, 'standardized_service', 12);
  }

  if (hasResearchSignals) {
    addWeight(weights, 'research_service', 18);
    addWeight(weights, 'standardized_service', 8);
    addWeight(weights, 'consulting', 4);
  }

  if (hasContentSignals) {
    addWeight(weights, 'research_service', 8);
    addWeight(weights, 'agency', 6);
    addWeight(weights, 'content_ip', hasContentCommercialization ? 10 : 2);
  }

  if (hasTechSignals) {
    addWeight(weights, 'project_delivery', 14);
    addWeight(weights, 'standardized_service', 10);
    addWeight(weights, 'tool_product', 12);
    addWeight(weights, 'vertical_saas', 4);
  }

  if (hasSalesSignals) {
    addWeight(weights, 'channel_sales', 18);
    addWeight(weights, 'resource_matching', 12);
  }

  if (hasManagementSignals) {
    addWeight(weights, 'consulting', 8);
    addWeight(weights, 'training', 6);
  }

  if (resume.yearsExperience < 2) {
    addWeight(weights, 'consulting', -14);
    addWeight(weights, 'training', -12);
    addWeight(weights, 'vertical_saas', -16);
  }

  if (!hasContentCommercialization) {
    addWeight(weights, 'content_ip', -10);
  }

  if (!hasTechSignals) {
    addWeight(weights, 'vertical_saas', -12);
  }
}

function topAchievementText(resume: ResumeData) {
  return resume.achievements[0]?.desc || '已有可迁移的项目结果';
}

function coreSkillText(resume: ResumeData) {
  return resume.skills
    .slice(0, 4)
    .map((skill) => skill.name)
    .join('、') || '现有技能';
}

function buildRouteReason(route: RouteDefinition, resume: ResumeData, activeScenes: ScoredScene[]) {
  const scenes = activeScenes.map((item) => item.scene.name).join(' + ');
  const achievement = topAchievementText(resume);
  const skillsText = coreSkillText(resume);

  const routeReasonMap: Record<RouteId, string> = {
    project_delivery: `这份履历里有清晰的交付结果和模块边界，适合先从一次性交付的小项目切入。围绕 ${skillsText}，可以直接把“${achievement}”这类证据包装成试单或专项服务。`,
    standardized_service: `这份履历里有重复动作和稳定流程，适合做固定范围、固定流程、固定价格的服务包。围绕 ${skillsText} 打包，比重新定制每个项目更容易在短期内成交。`,
    consulting: `这条路线依赖高密度判断和行业经验。当前它更适合作为后续升级方向，而不是首单优先路线。`,
    agency: `如果履历里有持续执行、代办和结果复盘信号，代运营/代理服务是更容易成交的路线。围绕 ${skillsText}，可以先卖月度执行或专项代办。`,
    channel_sales: `这条路线更依赖拿单能力、资源撮合和商务推进。如果供需两端资源明确，它会是一条很快的成交路径。`,
    training: `只有当方法论已经足够稳定、能带来结果时，培训/陪跑才适合作为主路线。当前更适合作为后续升级。`,
    resource_matching: `这条路线依赖稳定的供需资源和强信任关系。如果当前资源网络足够强，可以作为更快的现金流补充。`,
    research_service: `如果履历里有研究、分析、写作和判断输出信号，更适合先卖研究、分析、策划或情报服务。相比直接做内容/IP，这条路更稳。`,
    tool_product: `如果履历里有自动化、工具或工作流搭建经验，适合先在服务中验证需求，再做轻量工具产品。`,
    vertical_saas: `这条路线通常需要在真实服务里反复验证痛点后才成立。当前更适合作为后续产品化方向，而不是首单路线。`,
    content_ip: `只有在持续输出和商业化证据同时成立时，内容/IP 才适合做主路线。否则它更适合作为获客放大器。`,
  };

  return `匹配场景：${scenes || '综合场景'}。${routeReasonMap[route.id]}`;
}

function buildRouteCandidates(activeScenes: ScoredScene[], resume: ResumeData, keywords: string[]): CandidateRoute[] {
  const weights = new Map<RouteId, number>();

  activeScenes.forEach((entry, sceneIndex) => {
    const primaryBase = sceneIndex === 0 ? 100 : 55;
    const secondaryBase = sceneIndex === 0 ? 72 : 32;

    entry.scene.primaryRoutes.forEach((routeId, index) => addWeight(weights, routeId, primaryBase - index * 8));
    entry.scene.secondaryRoutes.forEach((routeId, index) => addWeight(weights, routeId, secondaryBase - index * 6));
  });

  applyRouteHeuristics(weights, resume, keywords);

  return ROUTE_DEFINITIONS.map((route) => ({
    route,
    score: weights.get(route.id) || 0,
    reason: buildRouteReason(route, resume, activeScenes),
  }))
    .filter((item) => item.score > 0)
    .sort((a, b) => b.score - a.score);
}

function pickRejectedRoutes(primaryScene: SceneDefinition, resume: ResumeData, keywords: string[]) {
  const rejected = new Set<RouteId>(primaryScene.rejectedRoutes);
  const text = keywords.join(' ').toLowerCase();

  if (!/(知识付费|付费社群|咨询服务|咨询成交|付费课程|训练营|会员订阅|内容变现|社群变现|个人品牌成交|广告报价)/.test(text)) {
    rejected.add('content_ip');
  }

  if (!/(开发|工程|python|javascript|sql|api|脚本|工作流|自动化|agent|测试|airtest|unity)/.test(text)) {
    rejected.add('vertical_saas');
  }

  if (resume.yearsExperience < 2) {
    rejected.add('consulting');
    rejected.add('training');
  }

  return ROUTE_DEFINITIONS.filter((route) => rejected.has(route.id));
}

function pickFaqs(rejectedRoutes: RouteDefinition[], resume: ResumeData) {
  const routeIds = new Set(rejectedRoutes.map((item) => item.id));
  const faqs: FaqDefinition[] = [];

  if (routeIds.has('content_ip')) {
    faqs.push(FAQ_DEFINITIONS.find((item) => item.id === 'why-not-ip')!);
  }

  if (
    routeIds.has('vertical_saas') ||
    resume.skills.some((skill) => /(自动化|agent|工作流|python|javascript|sql|测试)/i.test(skill.name))
  ) {
    faqs.push(FAQ_DEFINITIONS.find((item) => item.id === 'why-not-saas')!);
  }

  faqs.push(FAQ_DEFINITIONS.find((item) => item.id === 'why-first-deal')!);
  return uniqueById(faqs);
}

function toScoreLabel(score: number): RecommendedCase['scoreLabel'] {
  if (score >= 10) return 'high';
  if (score >= 7) return 'medium';
  return 'low';
}

function describeReason(parts: string[]) {
  return Array.from(new Set(parts.filter(Boolean))).join('；');
}

function scoreCaseTags(tags: CaseTag[], keywords: string[]) {
  const matchedTags = tags.filter((tag) => keywords.some((keyword) => keyword.includes(normalize(tag.label))));
  return {
    matchedTags,
    score: matchedTags.length * 2,
  };
}

function pickCases(activeScenes: ScoredScene[], routes: CandidateRoute[], resume: ResumeData): RecommendedCase[] {
  const sceneIds = new Set(activeScenes.map((item) => item.scene.id));
  const routeIds = new Set(routes.slice(0, 3).map((item) => item.route.id));
  const keywords = collectResumeKeywords(resume);

  return uniqueById(
    CASE_DEFINITIONS.map((item) => {
      let score = 0;
      const matchedSignals: string[] = [];
      const reasonParts: string[] = [];

      if (sceneIds.has(item.sceneId)) {
        score += 5;
        matchedSignals.push(`场景匹配：${item.sceneId}`);
        reasonParts.push('和当前简历的核心场景接近');
      }

      if (routeIds.has(item.routeId)) {
        score += 4;
        matchedSignals.push(`路线匹配：${item.routeId}`);
        reasonParts.push('和当前候选路线的变现逻辑一致');
      }

      const tagScore = scoreCaseTags(item.tags, keywords);
      score += tagScore.score;
      if (tagScore.matchedTags.length > 0) {
        matchedSignals.push(...tagScore.matchedTags.map((tag) => `标签命中：${tag.label}`));
        reasonParts.push(`命中了 ${tagScore.matchedTags.map((tag) => tag.label).join('、')} 等关键信号`);
      }

      if (resume.yearsExperience >= 4 && item.tags.some((tag) => tag.id === 'high-ticket' || tag.id === 'frameworks')) {
        score += 1;
        reasonParts.push('经验密度足够承接更高客单或更高判断浓度的路径');
      }

      return {
        caseDef: item,
        score,
        matchedSignals,
        matchedTags: tagScore.matchedTags,
        recommendationReason: describeReason(reasonParts.length ? reasonParts : item.whyItMatches.slice(0, 2)),
      };
    })
      .filter((entry) => entry.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3)
      .map<RecommendedCase>((entry) => ({
        id: entry.caseDef.id,
        title: entry.caseDef.title,
        background: entry.caseDef.background,
        trigger: entry.caseDef.trigger,
        firstDeal: entry.caseDef.firstDeal,
        monetization: entry.caseDef.monetization,
        assetUpgrade: entry.caseDef.assetUpgrade,
        sourceLabel: entry.caseDef.sourceLabel,
        sourceType: entry.caseDef.sourceType,
        score: entry.score,
        scoreLabel: toScoreLabel(entry.score),
        recommendationReason: entry.recommendationReason,
        matchedSignals: entry.matchedSignals,
        matchedTags: entry.matchedTags,
      }))
  );
}

function buildPromptContext(params: {
  relevantScenes: ScoredScene[];
  routeCandidates: CandidateRoute[];
  rejectedRoutes: RouteDefinition[];
  articles: KnowledgeArticleRef[];
  faqs: FaqDefinition[];
  cases: RecommendedCase[];
}) {
  const { relevantScenes, routeCandidates, rejectedRoutes, articles, faqs, cases } = params;

  const methodology = METHODOLOGY_RULES.map((rule, index) => `${index + 1}. ${rule.title}: ${rule.summary}`).join('\n');
  const sceneSummary = relevantScenes
    .map((item, index) => `${index + 1}. ${item.scene.name}（分数 ${item.score}，命中信号：${item.matchedSignals.join('、') || '无'}）: ${item.scene.reasonTemplate}`)
    .join('\n');
  const routes = routeCandidates
    .slice(0, 4)
    .map((item, index) => `${index + 1}. ${item.route.name}（分数 ${item.score}）: ${item.reason} 首单模板：${item.route.firstDealTemplate}`)
    .join('\n');
  const rejected = rejectedRoutes.length ? rejectedRoutes.map((item) => item.name).join('、') : '无';
  const articleSummary = articles.length ? articles.map((item) => `${item.title}: ${item.summary}`).join('\n') : '暂无';
  const faqSummary = faqs.length ? faqs.map((item) => `${item.question} ${item.answer}`).join('\n') : '暂无';
  const caseSummary =
    cases.length > 0
      ? cases
          .map(
            (item, index) =>
              `${index + 1}. ${item.title}: 匹配分 ${item.score}；推荐理由=${item.recommendationReason}；首单=${item.firstDeal}；资产升级=${item.assetUpgrade}`
          )
          .join('\n')
      : '暂无';

  return [
    '以下是一人企业知识库为本次简历分析生成的约束上下文。请优先依照这些规则判断，不要套用固定职业模板。',
    '',
    '【方法论】',
    methodology,
    '',
    '【场景判断】',
    sceneSummary,
    '',
    '【优先路线】',
    routes,
    '',
    '【当前不优先】',
    rejected,
    '',
    '【推荐阅读】',
    articleSummary,
    '',
    '【相似案例】',
    caseSummary,
    '',
    '【解释型 FAQ】',
    faqSummary,
    '',
    '【额外约束】',
    '1. 不允许把其他简历里的主路线、资产排序或案例模板套到当前用户身上。',
    '2. 资产排序必须基于这份简历里最容易直接变现的证据，而不是固定职业类别顺序。',
    '3. 如果履历是混合型，可以给主路线和备选路线，但必须解释每条路线为何成立。',
  ].join('\n');
}

export function buildKnowledgeContext(resume: ResumeData): KnowledgeContext {
  const keywords = collectResumeKeywords(resume);
  const scoredScenes = SCENE_DEFINITIONS.map((scene) => scoreScene(scene, keywords)).sort((a, b) => b.score - a.score);
  const fallbackScene =
    scoredScenes[0] ??
    ({
      scene: SCENE_DEFINITIONS.find((item) => item.id === 'junior')!,
      score: 0,
      matchedSignals: [],
    } satisfies ScoredScene);

  const relevantScenes = pickRelevantScenes(scoredScenes.length ? scoredScenes : [fallbackScene]);
  const primaryScene = relevantScenes[0] || fallbackScene;
  const candidateRoutes = buildRouteCandidates(relevantScenes.length ? relevantScenes : [fallbackScene], resume, keywords);
  const rejectedRoutes = pickRejectedRoutes(primaryScene.scene, resume, keywords);
  const recommendedFaqs = pickFaqs(rejectedRoutes, resume);
  const recommendedCases = pickCases(relevantScenes.length ? relevantScenes : [fallbackScene], candidateRoutes, resume);
  const articleIds = [
    ...primaryScene.scene.recommendedArticleIds,
    ...candidateRoutes.slice(0, 3).flatMap((item) => item.route.recommendedArticleIds),
    ...recommendedFaqs.flatMap((item) => item.recommendedArticleIds),
    ...METHODOLOGY_ARTICLES.slice(0, 3).map((item) => item.id),
  ];
  const recommendedArticles = pickArticles(articleIds).slice(0, 4);
  const promptContext = buildPromptContext({
    relevantScenes: relevantScenes.length ? relevantScenes : [fallbackScene],
    routeCandidates: candidateRoutes,
    rejectedRoutes,
    articles: recommendedArticles,
    faqs: recommendedFaqs,
    cases: recommendedCases,
  });

  return {
    resume,
    primaryScene,
    scoredScenes,
    candidateRoutes,
    rejectedRoutes,
    methodologyRules: METHODOLOGY_RULES,
    recommendedArticles,
    recommendedFaqs,
    recommendedCases,
    routeDefinitions: candidateRoutes.map((item) => item.route),
    guidance: {
      scene: primaryScene.scene.name,
      sceneSummary: primaryScene.scene.summary,
      sceneReason:
        primaryScene.matchedSignals.length > 0
          ? `命中信号：${primaryScene.matchedSignals.join('、')}。${primaryScene.scene.reasonTemplate}`
          : primaryScene.scene.reasonTemplate,
      matchedSignals: primaryScene.matchedSignals,
      recommendedRoutes: candidateRoutes.slice(0, 2).map((item) => ({
        name: item.route.name,
        reason: item.reason,
      })),
      rejectedRoutes: rejectedRoutes.map((item) => item.name),
      recommendedArticles,
      recommendedCases,
      faqHints: recommendedFaqs.map((item) => ({
        id: item.id,
        question: item.question,
        answer: item.answer,
      })),
    },
    promptContext,
  };
}
