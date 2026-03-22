'use client';

import { useState, type ComponentType } from 'react';
import { motion } from 'framer-motion';
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  CheckSquare,
  DollarSign,
  Download,
  Sparkles,
  Star,
  Target,
  TrendingUp,
} from 'lucide-react';
import { PolarAngleAxis, PolarGrid, Radar as RechartsRadar, RadarChart, ResponsiveContainer } from 'recharts';
import type { AnalysisResult, StrategyOption } from '@/lib/mock-data';
import { cn } from '@/lib/utils';

interface AnalysisMeta {
  providerKind: 'openai-compatible' | 'openai-native' | 'anthropic-native' | 'gemini-native';
  requestedModelId: string;
  resolvedModelId: string;
  availableModelsSample?: string[];
  fallbackFromModelId?: string;
  attemptedModelIds?: string[];
}

interface ReportViewProps {
  result: AnalysisResult;
  analysisMeta?: AnalysisMeta | null;
  reportFileName?: string | null;
  onReset: () => void;
}

const FRONTEND_VERSION = process.env.NEXT_PUBLIC_FRONTEND_VERSION || 'local-dev';

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.08 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function buildFallbackStrategyOptions(result: AnalysisResult): StrategyOption[] {
  if (!result.routeSelection) return [];

  return [
    {
      id: 'primary',
      label: '主定位',
      title: result.positioning.primary,
      summary: '当前报告只返回了一套主方案，尚未生成可切换的备选方案。',
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

function SectionTitle(props: { icon: ComponentType<{ className?: string }>; title: string }) {
  const Icon = props.icon;
  return (
    <div className="mb-6 flex items-center gap-3">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/10 bg-white/10">
        <Icon className="h-5 w-5" />
      </div>
      <h2 className="text-2xl font-semibold tracking-tight">{props.title}</h2>
    </div>
  );
}

function PrintMetaRow(props: { label: string; value: string }) {
  return (
    <div className="print-card">
      <div className="print-meta-label">{props.label}</div>
      <div className="print-meta-value">{props.value}</div>
    </div>
  );
}

function PrintStrategySection(props: { option: StrategyOption }) {
  const { option } = props;

  return (
    <section className="print-strategy-block">
      <div className="print-strategy-header">
        <div className="print-strategy-badge">{option.label}</div>
        <h2 className="print-strategy-title">{option.title}</h2>
        <p className="print-strategy-summary">{option.summary}</p>
      </div>

      <div className="print-grid-2">
        <div className="print-card">
          <div className="print-section-title">路线判断</div>
          <div className="print-main-route">{option.routeSelection.mainRoute}</div>
          <p className="print-paragraph">{option.routeSelection.reason}</p>
          {option.routeSelection.secondaryRoutes.length > 0 && (
            <>
              <div className="print-inline-label">备选路线</div>
              <div className="print-chip-list">
                {option.routeSelection.secondaryRoutes.map((route) => (
                  <span key={`${option.id}-secondary-${route}`} className="print-chip">
                    {route}
                  </span>
                ))}
              </div>
            </>
          )}
          {option.routeSelection.rejectedRoutes.length > 0 && (
            <>
              <div className="print-inline-label">当前不优先</div>
              <div className="print-chip-list">
                {option.routeSelection.rejectedRoutes.map((route) => (
                  <span key={`${option.id}-rejected-${route}`} className="print-chip muted">
                    {route}
                  </span>
                ))}
              </div>
            </>
          )}
        </div>

        {option.firstDealPlan && (
          <div className="print-card">
            <div className="print-section-title">第一单路径</div>
            <div className="print-detail-row">
              <span>目标客户</span>
              <p>{option.firstDealPlan.targetCustomer}</p>
            </div>
            <div className="print-detail-row">
              <span>去哪里找</span>
              <p>{option.firstDealPlan.whereToFind}</p>
            </div>
            <div className="print-detail-row">
              <span>怎么切入</span>
              <p>{option.firstDealPlan.approach}</p>
            </div>
            <div className="print-detail-row">
              <span>怎么成交</span>
              <p>{option.firstDealPlan.closing}</p>
            </div>
          </div>
        )}
      </div>

      {option.knowledgeGuidance && (
        <div className="print-grid-2">
          <div className="print-card">
            <div className="print-section-title">知识库依据</div>
            <div className="print-detail-row">
              <span>匹配场景</span>
              <p>{option.knowledgeGuidance.scene}</p>
            </div>
            <p className="print-paragraph">{option.knowledgeGuidance.sceneSummary}</p>
            <p className="print-paragraph subtle">{option.knowledgeGuidance.sceneReason}</p>
            {option.knowledgeGuidance.matchedSignals.length > 0 && (
              <>
                <div className="print-inline-label">命中信号</div>
                <div className="print-chip-list">
                  {option.knowledgeGuidance.matchedSignals.map((signal) => (
                    <span key={`${option.id}-signal-${signal}`} className="print-chip">
                      {signal}
                    </span>
                  ))}
                </div>
              </>
            )}
            {option.knowledgeGuidance.recommendedRoutes.length > 0 && (
              <div className="print-mini-list">
                {option.knowledgeGuidance.recommendedRoutes.map((route) => (
                  <div key={`${option.id}-route-${route.name}`} className="print-mini-item">
                    <strong>{route.name}</strong>
                    <p>{route.reason}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="print-card">
            <div className="print-section-title">推荐阅读与 FAQ</div>
            <div className="print-mini-list">
              {option.knowledgeGuidance.recommendedArticles.map((article) => (
                <div key={`${option.id}-article-${article.id}`} className="print-mini-item">
                  <strong>{article.title}</strong>
                  <p>{article.summary}</p>
                </div>
              ))}
            </div>
            {option.knowledgeGuidance.faqHints.length > 0 && (
              <div className="print-mini-list">
                {option.knowledgeGuidance.faqHints.map((faq) => (
                  <div key={`${option.id}-faq-${faq.id}`} className="print-mini-item">
                    <strong>{faq.question}</strong>
                    <p>{faq.answer}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {option.knowledgeGuidance && option.knowledgeGuidance.recommendedCases.length > 0 && (
        <div className="print-card">
          <div className="print-section-title">相似案例</div>
          <div className="print-grid-3">
            {option.knowledgeGuidance.recommendedCases.map((item) => (
              <div key={`${option.id}-case-${item.id}`} className="print-mini-item">
                <strong>{item.title}</strong>
                <p>推荐理由：{item.recommendationReason}</p>
                <p>首单打法：{item.firstDeal}</p>
                <p>变现方式：{item.monetization}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="print-grid-2">
        <div className="print-card">
          <div className="print-section-title">成长路径</div>
          <div className="print-mini-list">
            {option.growthPath.map((phase) => (
              <div key={`${option.id}-${phase.phase}`} className="print-mini-item">
                <strong>
                  {phase.phase} · {phase.duration}
                </strong>
                <p>{phase.goal}</p>
                <p>{phase.actions.join('；')}</p>
                <p>里程碑：{phase.milestone}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="print-card">
          <div className="print-section-title">收入模型</div>
          <div className="print-mini-list">
            {option.revenueModel.map((model) => (
              <div key={`${option.id}-${model.phase}-${model.product}`} className="print-mini-item">
                <strong>
                  {model.phase} · {model.product}
                </strong>
                <p>定价：{model.pricing}</p>
                <p>目标客户：{model.target}</p>
                <p>预期收入：{model.expectedIncome}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="print-grid-2">
        <div className="print-card">
          <div className="print-section-title">风险短板</div>
          <div className="print-mini-list">
            {option.risks.map((risk) => (
              <div key={`${option.id}-${risk.point}`} className="print-mini-item">
                <strong>{risk.point}</strong>
                <p>预警：{risk.warning}</p>
                <p>解决：{risk.solution}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="print-card">
          <div className="print-section-title">90 天行动清单</div>
          <div className="print-mini-list">
            {option.checklist.map((item) => (
              <div key={`${option.id}-${item.week}`} className="print-mini-item">
                <strong>{item.week}</strong>
                <p>{item.tasks.join('；')}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

export default function ReportView({ result, analysisMeta, reportFileName, onReset }: ReportViewProps) {
  const strategyOptions = result.strategyOptions?.length ? result.strategyOptions : buildFallbackStrategyOptions(result);
  const [activeStrategyId, setActiveStrategyId] = useState<StrategyOption['id']>(strategyOptions[0]?.id || 'primary');
  const activeStrategy = strategyOptions.find((item) => item.id === activeStrategyId) || strategyOptions[0];
  const actualModelLabel = analysisMeta?.resolvedModelId || analysisMeta?.requestedModelId || 'qwen3.5-flash';
  const modelSwitchLabel =
    analysisMeta?.fallbackFromModelId && analysisMeta.fallbackFromModelId !== analysisMeta.resolvedModelId
      ? `${analysisMeta.fallbackFromModelId} → ${analysisMeta.resolvedModelId}`
      : null;

  const screenAssets = activeStrategy?.assets?.length ? activeStrategy.assets : result.assets;
  const printAssets = result.assets;
  const activeRouteSelection = activeStrategy?.routeSelection;
  const activeFirstDealPlan = activeStrategy?.firstDealPlan;
  const activeKnowledgeGuidance = activeStrategy?.knowledgeGuidance;
  const activeGrowthPath = activeStrategy?.growthPath || result.growthPath;
  const activeRevenueModel = activeStrategy?.revenueModel || result.revenueModel;
  const activeRisks = activeStrategy?.risks || result.risks;
  const activeChecklist = activeStrategy?.checklist || result.checklist;

  const radarData = screenAssets.map((asset) => ({
    subject: asset.name.slice(0, 8) + (asset.name.length > 8 ? '...' : ''),
    value: asset.potential * 20,
    fullMark: 100,
  }));

  const handleExportPdf = () => {
    if (typeof window === 'undefined') return;
    const previousTitle = document.title;
    document.title = '一人企业成长方案-完整方案';
    window.print();
    setTimeout(() => {
      document.title = previousTitle;
    }, 300);
  };

  return (
    <main className="min-h-screen bg-[#0b0d12] text-white">
      <div className="fixed right-4 top-4 z-[60] rounded-2xl border border-amber-400/35 bg-[#16120a]/90 px-4 py-2 text-xs text-amber-100 shadow-[0_12px_40px_rgba(0,0,0,0.35)] backdrop-blur print:hidden">
        <div className="text-[10px] uppercase tracking-[0.2em] text-amber-300/75">Frontend Version</div>
        <div className="mt-1 font-mono text-sm font-semibold text-amber-50">{FRONTEND_VERSION}</div>
      </div>
      <header className="sticky top-0 z-50 border-b border-white/10 bg-[#0b0d12]/95 px-6 py-4 backdrop-blur print:hidden">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>

          <div className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85 sm:flex">
            <Sparkles className="h-4 w-4" />
            {activeStrategy ? `${activeStrategy.label} · ${activeStrategy.routeSelection.mainRoute}` : '你的成长方案'}
          </div>

          <button
            onClick={handleExportPdf}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-4 py-2 text-sm font-medium text-black transition-all hover:bg-white/90"
          >
            <Download className="h-4 w-4" />
            导出 PDF
          </button>
        </div>
      </header>

      <div className="report-screen-only">
        <motion.div variants={containerVariants} initial="hidden" animate="visible" className="print-report">
        <section className="px-6 pb-10 pt-14 sm:pt-16">
          <div className="mx-auto max-w-6xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
              <Sparkles className="h-4 w-4" />
              一人企业成长方案
            </div>
            <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">一人企业成长方案</h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-white/65 sm:text-lg">
              主定位优先展示，备选 A 和备选 B 可切换查看。切换后，路线判断、知识库依据、案例和行动清单都会同步变化。
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/75">
              {['结构化报告', '知识库驱动', '可切换方案视图'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item}
                </span>
              ))}
            </div>

            <div className="mx-auto mt-8 grid max-w-3xl gap-4 text-left sm:grid-cols-2">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">分析简历</div>
                <div className="text-base font-medium text-white">{reportFileName || '当前会话上传的简历'}</div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                <div className="mb-2 text-xs uppercase tracking-[0.18em] text-white/45">实际调用模型</div>
                <div className="text-base font-medium text-white">{actualModelLabel}</div>
                {modelSwitchLabel && <div className="mt-2 text-sm text-amber-200/85">自动切换：{modelSwitchLabel}</div>}
              </div>
            </div>
          </div>
        </section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle icon={Target} title="一人企业定位" />
            <div className="grid gap-4 sm:grid-cols-3">
              {strategyOptions.map((option) => {
                const isActive = option.id === activeStrategy?.id;

                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setActiveStrategyId(option.id)}
                    className={cn(
                      'rounded-3xl border p-6 text-left transition-all',
                      isActive
                        ? 'border-white/20 bg-white/[0.08] shadow-[0_0_0_1px_rgba(255,255,255,0.05)]'
                        : 'border-white/10 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.05]'
                    )}
                  >
                    <div className="mb-3 flex items-center justify-between gap-3">
                      <span className="text-xs text-white/55">{option.label}</span>
                      <span
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs',
                          isActive ? 'border-white/20 bg-white/10 text-white/80' : 'border-white/10 bg-white/5 text-white/45'
                        )}
                      >
                        {isActive ? '当前查看' : '点击切换'}
                      </span>
                    </div>
                    <p className={cn('text-lg leading-relaxed', isActive ? 'font-medium text-white' : 'text-white/85')}>{option.title}</p>
                    <div className="mt-3 inline-flex rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/70">
                      {option.routeSelection.mainRoute}
                    </div>
                    <p className="mt-4 text-sm leading-relaxed text-white/60">{option.summary}</p>
                  </button>
                );
              })}
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 pb-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle icon={TrendingUp} title="优势资产盘点" />
            <div className="grid gap-6 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                <p className="mb-4 text-sm text-white/60">变现潜力评估</p>
                <div className="h-72">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="rgba(255,255,255,0.12)" />
                      <PolarAngleAxis dataKey="subject" tick={{ fill: 'rgba(255,255,255,0.55)', fontSize: 12 }} />
                      <RechartsRadar dataKey="value" stroke="#ffffff" fill="#ffffff" fillOpacity={0.12} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>

              <div className="space-y-4">
                {screenAssets.map((asset, index) => (
                  <div key={`${asset.name}-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-medium">{asset.name}</h3>
                      <div className="flex shrink-0 items-center gap-1">
                        {[...Array(5)].map((_, i) => (
                          <Star key={i} className={cn('h-4 w-4', i < asset.potential ? 'fill-white text-white' : 'text-white/20')} />
                        ))}
                      </div>
                    </div>
                    {asset.strategyReason && <p className="mb-2 text-xs leading-relaxed text-amber-200/80">{asset.strategyReason}</p>}
                    <p className="mb-2 text-sm leading-relaxed text-white/60">{asset.evidence}</p>
                    <p className="text-sm leading-relaxed text-white/82">{asset.product}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        {activeRouteSelection && (
          <motion.section variants={itemVariants} className="px-6 py-8">
            <div className="mx-auto max-w-6xl">
              <SectionTitle icon={Sparkles} title="路线判断" />

              <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="mb-2 text-xs text-white/55">主路线</div>
                  <div className="mb-3 text-xl font-semibold text-white">{activeRouteSelection.mainRoute}</div>
                  <p className="text-sm leading-relaxed text-white/70">{activeRouteSelection.reason}</p>

                  {activeRouteSelection.secondaryRoutes.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs text-white/55">备选路线</div>
                      <div className="flex flex-wrap gap-2">
                        {activeRouteSelection.secondaryRoutes.map((route) => (
                          <span key={route} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/75">
                            {route}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeRouteSelection.rejectedRoutes.length > 0 && (
                    <div className="mt-5">
                      <div className="mb-2 text-xs text-white/55">当前不推荐</div>
                      <div className="flex flex-wrap gap-2">
                        {activeRouteSelection.rejectedRoutes.map((route) => (
                          <span key={route} className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/55">
                            {route}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {activeFirstDealPlan && (
                  <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                    <div className="mb-3 text-xs text-white/55">第一单路径</div>
                    <div className="space-y-4 text-sm leading-relaxed text-white/78">
                      <div>
                        <div className="mb-1 text-xs text-white/50">目标客户</div>
                        <div>{activeFirstDealPlan.targetCustomer}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-white/50">去哪里找</div>
                        <div>{activeFirstDealPlan.whereToFind}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-white/50">怎么切入</div>
                        <div>{activeFirstDealPlan.approach}</div>
                      </div>
                      <div>
                        <div className="mb-1 text-xs text-white/50">怎么成交</div>
                        <div>{activeFirstDealPlan.closing}</div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </motion.section>
        )}

        {activeKnowledgeGuidance && (
          <motion.section variants={itemVariants} className="px-6 py-8">
            <div className="mx-auto max-w-6xl">
              <SectionTitle icon={Sparkles} title="知识库依据" />

              <div className="grid gap-4 lg:grid-cols-[0.9fr_1.1fr]">
                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="mb-2 block text-xs text-white/55">匹配场景</span>
                  <h3 className="mb-3 text-lg font-medium">{activeKnowledgeGuidance.scene}</h3>
                  <p className="mb-3 text-sm leading-relaxed text-white/82">{activeKnowledgeGuidance.sceneSummary}</p>
                  <p className="text-sm leading-relaxed text-white/70">{activeKnowledgeGuidance.sceneReason}</p>

                  {activeKnowledgeGuidance.matchedSignals.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs text-white/55">命中信号</div>
                      <div className="flex flex-wrap gap-2">
                        {activeKnowledgeGuidance.matchedSignals.map((signal) => (
                          <span key={signal} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                            {signal}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeKnowledgeGuidance.recommendedRoutes.length > 0 && (
                    <div className="mt-4 space-y-3">
                      <div className="text-xs text-white/55">为什么更适合这些路线</div>
                      {activeKnowledgeGuidance.recommendedRoutes.map((route) => (
                        <div key={route.name} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-1 text-sm font-medium text-white">{route.name}</div>
                          <div className="text-sm leading-relaxed text-white/65">{route.reason}</div>
                        </div>
                      ))}
                    </div>
                  )}

                  {activeKnowledgeGuidance.rejectedRoutes.length > 0 && (
                    <div className="mt-4">
                      <div className="mb-2 text-xs text-white/55">当前不优先的路线</div>
                      <div className="flex flex-wrap gap-2">
                        {activeKnowledgeGuidance.rejectedRoutes.map((route) => (
                          <span key={route} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/60">
                            {route}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="mb-3 block text-xs text-white/55">推荐继续阅读</span>
                  <div className="space-y-3">
                    {activeKnowledgeGuidance.recommendedArticles.map((article) => (
                      <div key={article.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-1 text-sm font-medium text-white">{article.title}</div>
                        <div className="text-sm leading-relaxed text-white/65">{article.summary}</div>
                        <div className="mt-2 text-xs text-white/40">{article.path}</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="mt-4 grid gap-4 md:grid-cols-3">
                {activeKnowledgeGuidance.faqHints.map((faq) => (
                  <div key={faq.id} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                    <div className="mb-2 text-sm font-medium text-white">{faq.question}</div>
                    <div className="text-sm leading-relaxed text-white/65">{faq.answer}</div>
                  </div>
                ))}
              </div>

              {activeKnowledgeGuidance.recommendedCases.length > 0 && (
                <div className="mt-4 rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="mb-3 block text-xs text-white/55">相似案例</span>
                  <div className="space-y-4">
                    {activeKnowledgeGuidance.recommendedCases.map((item) => (
                      <div key={item.id} className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-1 flex items-center justify-between gap-3">
                          <div className="text-sm font-medium text-white">{item.title}</div>
                          <div className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/70">
                            匹配分 {item.score}
                          </div>
                        </div>
                        <div className="text-sm leading-relaxed text-white/65">背景：{item.background}</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/75">推荐理由：{item.recommendationReason}</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/75">触发条件：{item.trigger}</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/75">首单打法：{item.firstDeal}</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/75">变现方式：{item.monetization}</div>
                        <div className="mt-2 text-sm leading-relaxed text-white/75">资产升级：{item.assetUpgrade}</div>
                        <div className="mt-3 flex flex-wrap gap-2">
                          {item.matchedTags.map((tag) => (
                            <span key={`${item.id}-${tag.id}`} className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-white/65">
                              {tag.label}
                            </span>
                          ))}
                        </div>
                        {item.matchedSignals.length > 0 && (
                          <div className="mt-3 text-xs leading-relaxed text-white/45">命中信号：{item.matchedSignals.join(' / ')}</div>
                        )}
                        <div className="mt-2 text-xs text-white/40">{item.sourceLabel}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </motion.section>
        )}

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle icon={Calendar} title="成长路径" />
            <div className="space-y-5">
              {activeGrowthPath.map((phase, index) => (
                <div key={`${phase.phase}-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">{phase.duration}</span>
                    <h3 className="text-lg font-medium">{phase.phase}</h3>
                  </div>
                  <p className="mb-4 leading-relaxed text-white/68">{phase.goal}</p>
                  <ul className="mb-4 space-y-2">
                    {phase.actions.map((action, itemIndex) => (
                      <li key={itemIndex} className="flex items-start gap-2 text-sm leading-relaxed text-white/82">
                        <span className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-white/70" />
                        {action}
                      </li>
                    ))}
                  </ul>
                  <div className="border-t border-white/10 pt-4 text-sm text-white/82">
                    <span className="text-white/55">里程碑：</span>
                    {phase.milestone}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle icon={DollarSign} title="收入模型" />
            <div className="grid gap-4 sm:grid-cols-3">
              {activeRevenueModel.map((model, index) => (
                <div key={`${model.phase}-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="mb-2 block text-xs text-white/55">{model.phase}</span>
                  <h3 className="mb-2 text-lg font-medium">{model.product}</h3>
                  <p className="mb-4 text-xl font-semibold text-white">{model.pricing}</p>
                  <div className="space-y-2 text-sm leading-relaxed text-white/72">
                    <p>
                      <span className="text-white/50">目标客户：</span>
                      {model.target}
                    </p>
                    <p>
                      <span className="text-white/50">预期收入：</span>
                      {model.expectedIncome}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle icon={AlertTriangle} title="风险短板" />
            <div className="space-y-4">
              {activeRisks.map((risk, index) => (
                <div key={`${risk.point}-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-2 text-lg font-medium">{risk.point}</h3>
                      <p className="mb-3 text-sm leading-relaxed text-white/65">
                        <span className="text-white/45">预警信号：</span>
                        {risk.warning}
                      </p>
                      <p className="text-sm leading-relaxed text-white/82">
                        <span className="text-white/45">解决动作：</span>
                        {risk.solution}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <SectionTitle icon={CheckSquare} title="90 天行动清单" />
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {activeChecklist.map((item, index) => (
                <div key={`${item.week}-${index}`} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="mb-3 block text-xs text-white/55">{item.week}</span>
                  <ul className="space-y-2">
                    {item.tasks.map((task, taskIndex) => (
                      <li key={taskIndex} className="flex items-start gap-2 text-sm leading-relaxed text-white/82">
                        <span className="mt-1 h-4 w-4 shrink-0 rounded border border-white/20" />
                        {task}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.div variants={itemVariants} className="px-6 pb-16 pt-8 text-center print:hidden">
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-sm font-medium text-black transition-all hover:bg-white/90"
          >
            分析另一份简历
          </button>
        </motion.div>
        </motion.div>
      </div>

      <div className="report-print-only">
        <div className="report-print-page">
          <section className="print-cover-block">
            <div className="print-kicker">一人企业成长方案</div>
            <h1>完整方案导出</h1>
            <p>导出包含主定位、备选 A、备选 B 三套方案，并同步给出对应的路线判断、知识库依据、相似案例、成长路径、收入模型、风险短板和 90 天行动清单。</p>
          </section>

          <section className="print-block">
            <div className="print-section-title">共享资产池</div>
            <div className="print-grid-2">
              {printAssets.map((asset) => (
                <div key={`print-asset-${asset.name}`} className="print-card">
                  <div className="print-main-route">{asset.name}</div>
                  <p className="print-paragraph">{asset.evidence}</p>
                  <p className="print-paragraph subtle">{asset.product}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="print-block">
            <div className="print-section-title">方案总览</div>
            <div className="print-grid-3">
              {strategyOptions.map((option) => (
                <div key={`print-summary-${option.id}`} className="print-card">
                  <div className="print-strategy-badge">{option.label}</div>
                  <div className="print-main-route">{option.title}</div>
                  <p className="print-paragraph">{option.summary}</p>
                  <div className="print-inline-label">主路线</div>
                  <p className="print-paragraph">{option.routeSelection.mainRoute}</p>
                </div>
              ))}
            </div>
          </section>

          {strategyOptions.map((option) => (
            <PrintStrategySection key={`print-strategy-${option.id}`} option={option} />
          ))}
        </div>
      </div>
    </main>
  );
}
