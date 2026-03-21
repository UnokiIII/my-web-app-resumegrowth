export interface CaseFilterRule {
  id: string;
  name: string;
  description: string;
  weight: number;
  decisionType: 'boost' | 'penalty' | 'gate';
}

export const CASE_FILTER_RULES: CaseFilterRule[] = [
  {
    id: 'scene-match',
    name: '场景匹配',
    description: '案例场景与当前用户背景场景一致时，优先级最高。',
    weight: 5,
    decisionType: 'boost',
  },
  {
    id: 'route-match',
    name: '路线匹配',
    description: '案例路线命中当前候选主路径时，显著加分。',
    weight: 4,
    decisionType: 'boost',
  },
  {
    id: 'tag-match',
    name: '标签命中',
    description: '技能、变现方式、资产类型等标签命中时追加加分。',
    weight: 2,
    decisionType: 'boost',
  },
  {
    id: 'experience-density',
    name: '经验密度校验',
    description: '高判断密度、高客单案例需要更高经验支撑，不满足时降权。',
    weight: 1,
    decisionType: 'gate',
  },
  {
    id: 'risk-misalignment',
    name: '风险错配',
    description: '如果案例的风险暴露与用户当前阶段明显错位，应降低推荐。',
    weight: 2,
    decisionType: 'penalty',
  },
];
