'use client';

import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Download,
  TrendingUp,
  Target,
  Calendar,
  DollarSign,
  AlertTriangle,
  CheckSquare,
  Star,
  Sparkles,
  CheckCircle2,
} from 'lucide-react';
import { AnalysisResult } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, ResponsiveContainer, Radar as RechartsRadar } from 'recharts';

interface AnalysisMeta {
  providerKind: 'openai-compatible' | 'openai-native' | 'anthropic-native' | 'gemini-native';
  requestedModelId: string;
  resolvedModelId: string;
  availableModelsSample?: string[];
}

interface ReportViewProps {
  result: AnalysisResult;
  analysisMeta?: AnalysisMeta | null;
  onReset: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.08 },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 16 },
  visible: { opacity: 1, y: 0 },
};

function getAssetPriority(name: string): number {
  const lower = name.toLowerCase();
  // 高优先级：设计/项目/交付类
  if (/设计|视觉|平面|品牌|项目|交付|执行|策划/.test(lower)) return 3;
  // 中优先级：顾问/咨询/培训
  if (/顾问|咨询|培训|陪跑|教学/.test(lower)) return 2;
  // 低优先级：内容/运营/社媒类
  if (/内容|运营|社媒|新媒体|粉丝|账号|自媒体/.test(lower)) return 0;
  return 1; // 默认中等
}

function sortAssetsByPriority(assets: AnalysisResult['assets']) {
  return [...assets].sort((a, b) => {
    const diff = getAssetPriority(b.name) - getAssetPriority(a.name);
    if (diff !== 0) return diff;
    // 同优先级按潜力值排序
    return (b.potential || 0) - (a.potential || 0);
  });
}

export default function ReportView({ result, analysisMeta, onReset }: ReportViewProps) {
  // 强制按业务优先级排序
  const sortedAssets = sortAssetsByPriority(result.assets);

  const handleExportPdf = () => {
    if (typeof window !== 'undefined') {
      const previousTitle = document.title;
      document.title = '一人企业成长方案';
      window.print();
      setTimeout(() => {
        document.title = previousTitle;
      }, 300);
    }
  };

  const radarData = sortedAssets.map((asset) => ({
    subject: asset.name.slice(0, 8) + (asset.name.length > 8 ? '...' : ''),
    value: asset.potential * 20,
    fullMark: 100,
  }));

  return (
    <main className="min-h-screen bg-[#0b0d12] text-white">
      <header className="print:hidden border-b border-white/10 bg-[#0b0d12]/95 backdrop-blur px-6 py-4 sticky top-0 z-50">
        <div className="mx-auto max-w-6xl flex items-center justify-between gap-4">
          <button
            onClick={onReset}
            className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/75 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            返回
          </button>

          <div className="hidden sm:flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
            <Sparkles className="h-4 w-4" />
            你的成长方案
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

      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="print-report"
      >
        <section className="px-6 pb-10 pt-14 sm:pt-16">
          <div className="mx-auto max-w-6xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-white/85">
              <Sparkles className="h-4 w-4" />
              一人企业成长方案
            </div>

            <h1 className="text-4xl font-semibold leading-[1.12] tracking-tight sm:text-5xl lg:text-6xl">
              一人企业成长方案
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base text-white/65 sm:text-lg">
              基于你的简历分析，为你定制的商业化路径。
              <br className="hidden sm:block" />
              从优势资产盘点到 90 天执行清单，每一步都尽量做到清晰、可执行。
            </p>

            <div className="mt-8 flex flex-wrap justify-center gap-3 text-sm text-white/75">
              {['结构化报告', '个性化路线', '可落地行动清单'].map((item) => (
                <span key={item} className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <motion.section variants={itemVariants} className="px-6 pb-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <TrendingUp className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">优势资产盘点</h2>
            </div>

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
                {sortedAssets.map((asset, index) => (
                  <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="mb-3 flex items-start justify-between gap-4">
                      <h3 className="text-lg font-medium">{asset.name}</h3>
                      <div className="flex items-center gap-1 shrink-0">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={cn('h-4 w-4', i < asset.potential ? 'fill-white text-white' : 'text-white/20')}
                          />
                        ))}
                      </div>
                    </div>
                    <p className="mb-2 text-sm leading-relaxed text-white/60">{asset.evidence}</p>
                    <p className="text-sm leading-relaxed text-white/82">{asset.product}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <Target className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">一人企业定位</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div className="rounded-3xl border border-white/20 bg-white/[0.08] p-6">
                <span className="mb-2 block text-xs text-white/55">主定位</span>
                <p className="text-lg font-medium leading-relaxed">{result.positioning.primary}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <span className="mb-2 block text-xs text-white/55">备选 A（低风险）</span>
                <p className="leading-relaxed text-white/85">{result.positioning.alternativeA}</p>
              </div>
              <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                <span className="mb-2 block text-xs text-white/55">备选 B（高天花板）</span>
                <p className="leading-relaxed text-white/85">{result.positioning.alternativeB}</p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <Calendar className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">成长路径</h2>
            </div>

            <div className="space-y-5">
              {result.growthPath.map((phase, index) => (
                <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6 sm:p-7">
                  <div className="mb-4 flex flex-wrap items-center gap-3">
                    <span className="inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-white/15 bg-white/10 px-3 text-sm font-medium">
                      {index + 1}
                    </span>
                    <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm text-white/70">
                      {phase.duration}
                    </span>
                    <h3 className="text-lg font-medium">{phase.phase}</h3>
                  </div>
                  <p className="mb-4 leading-relaxed text-white/68">{phase.goal}</p>
                  <ul className="mb-4 space-y-2">
                    {phase.actions.map((action, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-white/82">
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
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <DollarSign className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">收入模型</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {result.revenueModel.map((model, index) => (
                <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <span className="mb-2 block text-xs text-white/55">{model.phase}</span>
                  <h3 className="mb-2 text-lg font-medium">{model.product}</h3>
                  <p className="mb-4 text-xl font-semibold text-white">{model.pricing}</p>
                  <div className="space-y-2 text-sm leading-relaxed text-white/72">
                    <p><span className="text-white/50">目标客户：</span>{model.target}</p>
                    <p><span className="text-white/50">预期收入：</span>{model.expectedIncome}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section variants={itemVariants} className="px-6 py-8">
          <div className="mx-auto max-w-6xl">
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">风险短板</h2>
            </div>

            <div className="space-y-4">
              {result.risks.map((risk, index) => (
                <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.03] p-6">
                  <div className="flex items-start gap-4">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-white/10 text-sm font-medium">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="mb-2 text-lg font-medium">{risk.point}</h3>
                      <p className="mb-3 text-sm leading-relaxed text-white/65">
                        <span className="text-white/45">预警信号：</span>{risk.warning}
                      </p>
                      <p className="text-sm leading-relaxed text-white/82">
                        <span className="text-white/45">解决动作：</span>{risk.solution}
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
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/10 border border-white/10">
                <CheckSquare className="h-5 w-5" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">90天执行清单</h2>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {result.checklist.map((item, index) => (
                <div key={index} className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
                  <span className="mb-3 block text-xs text-white/55">{item.week}</span>
                  <ul className="space-y-2">
                    {item.tasks.map((task, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm leading-relaxed text-white/82">
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

        <motion.div variants={itemVariants} className="print:hidden px-6 pb-16 pt-8 text-center">
          <button
            onClick={onReset}
            className="inline-flex items-center justify-center rounded-2xl bg-white px-8 py-4 text-sm font-medium text-black transition-all hover:bg-white/90"
          >
            分析另一份简历
          </button>
        </motion.div>
      </motion.div>
    </main>
  );
}
