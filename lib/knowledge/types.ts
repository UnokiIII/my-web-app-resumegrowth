import type { ResumeData } from '../mock-data';

export type RouteId =
  | 'project_delivery'
  | 'standardized_service'
  | 'consulting'
  | 'agency'
  | 'channel_sales'
  | 'training'
  | 'resource_matching'
  | 'research_service'
  | 'tool_product'
  | 'vertical_saas'
  | 'content_ip';

export type SceneId = 'sales' | 'technical' | 'operations' | 'design' | 'content' | 'management' | 'junior';

export type CaseSourceType = 'creator_reference' | 'internal_pattern' | 'market_observation';

export type CaseTagCategory =
  | 'skill'
  | 'route'
  | 'monetization'
  | 'stage'
  | 'asset'
  | 'risk'
  | 'style';

export interface CaseTag {
  id: string;
  label: string;
  category: CaseTagCategory;
}

export interface KnowledgeArticleRef {
  id: string;
  title: string;
  summary: string;
  path: string;
}

export interface MethodologyRule {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
}

export interface RouteDefinition {
  id: RouteId;
  name: string;
  summary: string;
  fitSignals: string[];
  notFitSignals: string[];
  firstDealTemplate: string;
  upgradePath: string;
  risks: string[];
  recommendedArticleIds: string[];
}

export interface SceneDefinition {
  id: SceneId;
  name: string;
  summary: string;
  roleKeywords: string[];
  skillKeywords: string[];
  interestKeywords: string[];
  primaryRoutes: RouteId[];
  secondaryRoutes: RouteId[];
  rejectedRoutes: RouteId[];
  reasonTemplate: string;
  recommendedArticleIds: string[];
}

export interface FaqDefinition {
  id: string;
  question: string;
  answer: string;
  recommendedArticleIds: string[];
}

export interface CaseDefinition {
  id: string;
  title: string;
  routeId: RouteId;
  sceneId: SceneId;
  background: string;
  trigger: string;
  firstDeal: string;
  monetization: string;
  assetUpgrade: string;
  whyItMatches: string[];
  tags: CaseTag[];
  sourceLabel: string;
  sourceType: CaseSourceType;
  sourceUrl?: string;
}

export interface ScoredScene {
  scene: SceneDefinition;
  score: number;
  matchedSignals: string[];
}

export interface CandidateRoute {
  route: RouteDefinition;
  score: number;
  reason: string;
}

export interface RecommendedCase {
  id: string;
  title: string;
  background: string;
  trigger: string;
  firstDeal: string;
  monetization: string;
  assetUpgrade: string;
  sourceLabel: string;
  sourceType: CaseSourceType;
  score: number;
  scoreLabel: 'high' | 'medium' | 'low';
  recommendationReason: string;
  matchedSignals: string[];
  matchedTags: CaseTag[];
}

export interface KnowledgeGuidance {
  scene: string;
  sceneSummary: string;
  sceneReason: string;
  matchedSignals: string[];
  recommendedRoutes: {
    name: string;
    reason: string;
  }[];
  rejectedRoutes: string[];
  recommendedArticles: KnowledgeArticleRef[];
  recommendedCases: RecommendedCase[];
  faqHints: Pick<FaqDefinition, 'id' | 'question' | 'answer'>[];
}

export interface KnowledgeContext {
  resume: ResumeData;
  primaryScene: ScoredScene;
  scoredScenes: ScoredScene[];
  candidateRoutes: CandidateRoute[];
  rejectedRoutes: RouteDefinition[];
  methodologyRules: MethodologyRule[];
  recommendedArticles: KnowledgeArticleRef[];
  recommendedFaqs: FaqDefinition[];
  recommendedCases: RecommendedCase[];
  routeDefinitions: RouteDefinition[];
  guidance: KnowledgeGuidance;
  promptContext: string;
}
