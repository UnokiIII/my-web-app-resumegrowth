import type { FaqDefinition, KnowledgeArticleRef } from './types';

export const FAQ_ARTICLES: KnowledgeArticleRef[] = [
  {
    id: 'faq-why-not-ip',
    title: '为什么不建议一上来做 IP',
    summary: '没有转化和成交验证时，内容只是获客手段，不是主业务。',
    path: '/knowledge/faq/why-not-ip',
  },
  {
    id: 'faq-why-not-saas',
    title: '为什么不建议一上来做 SaaS',
    summary: '没有真实服务验证时，SaaS 很容易陷入慢反馈和假需求。',
    path: '/knowledge/faq/why-not-saas',
  },
  {
    id: 'faq-why-first-deal',
    title: '为什么总强调第一单',
    summary: '第一单不是小目标，而是需求、支付和交付闭环的第一次验证。',
    path: '/knowledge/faq/why-first-deal',
  },
];

export const FAQ_DEFINITIONS: FaqDefinition[] = [
  {
    id: 'why-not-ip',
    question: '为什么当前阶段不建议直接做内容/IP？',
    answer: '因为内容曝光不等于成交。除非已经有持续输出和转化证据，否则内容更适合作为辅助获客渠道。',
    recommendedArticleIds: ['faq-why-not-ip', 'route-content-ip'],
  },
  {
    id: 'why-not-saas',
    question: '为什么不建议一开始就做 SaaS？',
    answer: '因为 SaaS 的反馈周期长、开发成本高，先做服务更容易验证真实痛点和付费意愿。',
    recommendedArticleIds: ['faq-why-not-saas', 'mvp-profit'],
  },
  {
    id: 'why-first-deal',
    question: '为什么报告总强调第一单路径？',
    answer: '因为第一单决定这个方向是否真的有人付钱，也决定是否值得继续标准化和放大。',
    recommendedArticleIds: ['faq-why-first-deal', 'first-deal-path'],
  },
];
