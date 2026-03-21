import type { KnowledgeArticleRef, MethodologyRule } from './types';

export const METHODOLOGY_RULES: MethodologyRule[] = [
  {
    id: 'first-deal-first',
    title: '先拿第一单，再谈长期理想',
    summary: '主路径优先选择 30 天内最容易成交的方案，而不是看起来更性感的路线。',
    whyItMatters: '这个产品的核心不是职业建议，而是帮助用户尽快完成第一次真实变现。',
  },
  {
    id: 'asset-pool',
    title: '围绕资产池做判断',
    summary: '优先盘点已有经验、技能、成果、关系和可复用流程，再决定路线。',
    whyItMatters: '这样能避免让用户跨能力创业，降低试错成本。',
  },
  {
    id: 'service-before-product',
    title: '先服务，后产品',
    summary: '在需求、付费意愿和交付边界没验证前，不要直接做 SaaS 或复杂产品。',
    whyItMatters: '服务是需求验证器，也是后续工具化和产品化的入口。',
  },
  {
    id: 'minimum-viable-profit',
    title: '以最低可行利润为阶段目标',
    summary: '先跑通可以稳定成交的小模型，再逐步提升利润和杠杆。',
    whyItMatters: '一人企业首先要解决的是生存和复利，而不是规模幻觉。',
  },
  {
    id: 'niche-demand',
    title: '优先小众强需求',
    summary: '优先选择强痛点、非标准化、替代弱的场景，而不是大众泛需求。',
    whyItMatters: '小众强需求更容易形成高转化和高客单。',
  },
  {
    id: 'differentiated-value-logic',
    title: '差异化来自价值逻辑',
    summary: '不要只搬运信息，要把职业经历、个人见闻和长期热爱沉淀成自己的价值内核。',
    whyItMatters: '这是 AI 很难替代的部分，也是形成长期护城河的关键。',
  },
  {
    id: 'cashflow-before-audience',
    title: '先现金流，后粉丝规模',
    summary: '一人企业优先追求精准转化和高价值成交，而不是空泛曝光和粉丝数。',
    whyItMatters: '没有稳定现金流，再好的叙事也无法支撑自由选择。',
  },
  {
    id: 'content-operating-system',
    title: '内容要系统化，不靠临时发挥',
    summary: '内容不是随手发，而是要进入一套可复用、可分发、可筛选客户的资产流水线。',
    whyItMatters: '只有形成系统，内容才会变成杠杆，而不是新的工作负担。',
  },
  {
    id: 'enough-threshold',
    title: '定义足够，保护可持续性',
    summary: '一人企业的目标不是无限扩张，而是在达到利润和生活目标后守住边界。',
    whyItMatters: '如果没有边界阈值，规模会反过来吞掉自由。',
  },
];

export const METHODOLOGY_ARTICLES: KnowledgeArticleRef[] = [
  {
    id: 'what-is-solobusiness',
    title: '什么是一人企业',
    summary: '解释一人企业的目标不是当老板，而是建立可持续变现和资产沉淀。',
    path: '/knowledge/methodology/what-is-solobusiness',
  },
  {
    id: 'asset-pool',
    title: '资产池思维',
    summary: '如何从简历里的经验、成果和资源提炼出可卖的资产。',
    path: '/knowledge/methodology/asset-pool',
  },
  {
    id: 'mvp-profit',
    title: '最低可行利润',
    summary: '为什么先活下来、先赚钱，是一人企业的第一阶段目标。',
    path: '/knowledge/methodology/mvp-profit',
  },
  {
    id: 'new-leverage',
    title: '新杠杆',
    summary: '内容、工具、知识库、AI 助手和标准化产品如何成为杠杆。',
    path: '/knowledge/methodology/new-leverage',
  },
  {
    id: 'first-deal-path',
    title: '第一单路径',
    summary: '如何从熟人网络、老客户、案例和小单切入拿到第一单。',
    path: '/knowledge/methodology/first-deal-path',
  },
  {
    id: 'dan-koe-value-core',
    title: 'Dan Koe: 价值内核',
    summary: '差异化不来自信息搬运，而来自你独特的经历、认知和热爱组合成的价值逻辑。',
    path: '/knowledge/methodology/dan-koe-value-core',
  },
  {
    id: 'iman-gadzhi-cashflow',
    title: 'Iman Gadzhi: 现金流优先',
    summary: '先锁定高价值赛道和精准转化，再谈规模化表达。',
    path: '/knowledge/methodology/iman-gadzhi-cashflow',
  },
  {
    id: 'justin-welsh-systems',
    title: 'Justin Welsh: 内容系统',
    summary: '建立可复用的内容分发与筛选系统，让内容变成资产流水线。',
    path: '/knowledge/methodology/justin-welsh-systems',
  },
  {
    id: 'paul-jarvis-enough',
    title: 'Paul Jarvis: 足够阈值',
    summary: '主动定义上限，把利润率和生活质量放在规模之前。',
    path: '/knowledge/methodology/paul-jarvis-enough',
  },
];
