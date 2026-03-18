'use client';

import { motion } from 'framer-motion';
import { 
  ArrowLeft, Download, TrendingUp, Target, Calendar, 
  DollarSign, AlertTriangle, CheckSquare, Star 
} from 'lucide-react';
import { AnalysisResult } from '@/lib/mock-data';
import { cn } from '@/lib/utils';
import { 
  Radar, RadarChart, PolarGrid, PolarAngleAxis, 
  ResponsiveContainer, Cell 
} from 'recharts';

interface ReportViewProps {
  result: AnalysisResult;
  onReset: () => void;
}

const containerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.1 }
  }
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 }
};

export default function ReportView({ result, onReset }: ReportViewProps) {
  const radarData = result.assets.map(asset => ({
    subject: asset.name.split('').slice(0, 6).join('') + (asset.name.length > 6 ? '...' : ''),
    A: asset.potential * 20,
    fullMark: 100,
  }));

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 glass border-b border-border">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <button
            onClick={onReset}
            className="flex items-center gap-2 text-muted hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            返回
          </button>
          <h1 className="font-semibold">你的成长方案</h1>
          <button className="flex items-center gap-2 px-4 py-2 bg-primary hover:bg-primary-hover text-white rounded-lg text-sm transition-all-300">
            <Download className="w-4 h-4" />
            导出 PDF
          </button>
        </div>
      </header>

      {/* Main Content */}
      <motion.main
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="max-w-6xl mx-auto px-6 py-8 pb-20"
      >
        {/* Title */}
        <motion.div variants={itemVariants} className="text-center mb-12">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">
            一人企业成长方案
          </h2>
          <p className="text-muted">基于你的简历分析，为你定制的商业化路径</p>
        </motion.div>

        {/* 1. Assets */}
        <motion.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">优势资产盘点</h3>
          </div>
          
          <div className="grid lg:grid-cols-2 gap-6">
            {/* Radar Chart */}
            <div className="p-6 rounded-2xl bg-card border border-border">
              <h4 className="text-sm font-medium text-muted mb-4">变现潜力评估</h4>
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid stroke="#27272a" />
                    <PolarAngleAxis 
                      dataKey="subject" 
                      tick={{ fill: '#71717a', fontSize: 12 }}
                    />
                    <Radar
                      name="变现潜力"
                      dataKey="A"
                      stroke="#6366f1"
                      fill="#6366f1"
                      fillOpacity={0.3}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Asset Details */}
            <div className="space-y-4">
              {result.assets.map((asset, index) => (
                <div 
                  key={index}
                  className="p-5 rounded-2xl bg-card border border-border hover:border-primary/30 transition-all-300"
                >
                  <div className="flex items-start justify-between mb-3">
                    <h4 className="font-semibold">{asset.name}</h4>
                    <div className="flex items-center gap-1">
                      {[...Array(5)].map((_, i) => (
                        <Star 
                          key={i}
                          className={cn(
                            "w-4 h-4",
                            i < asset.potential ? "fill-primary text-primary" : "text-border"
                          )}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-sm text-muted mb-2">{asset.evidence}</p>
                  <p className="text-sm text-primary">{asset.product}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* 2. Positioning */}
        <motion.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Target className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">一人企业定位</h3>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            <div className="p-6 rounded-2xl bg-primary/10 border border-primary/30">
              <span className="text-xs font-medium text-primary mb-2 block">主定位</span>
              <p className="font-semibold">{result.positioning.primary}</p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border">
              <span className="text-xs font-medium text-muted mb-2 block">备选 A（低风险）</span>
              <p className="font-medium">{result.positioning.alternativeA}</p>
            </div>
            <div className="p-6 rounded-2xl bg-card border border-border">
              <span className="text-xs font-medium text-muted mb-2 block">备选 B（高天花板）</span>
              <p className="font-medium">{result.positioning.alternativeB}</p>
            </div>
          </div>
        </motion.section>

        {/* 3. Growth Path */}
        <motion.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">成长路径</h3>
          </div>

          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-6 top-8 bottom-8 w-px bg-border hidden sm:block" />
            
            <div className="space-y-8">
              {result.growthPath.map((phase, index) => (
                <div key={index} className="relative sm:pl-16">
                  {/* Timeline dot */}
                  <div className="absolute left-0 top-0 w-12 h-12 rounded-full bg-primary/10 border-2 border-primary flex items-center justify-center hidden sm:flex">
                    <span className="text-sm font-bold text-primary">{index + 1}</span>
                  </div>
                  
                  <div className="p-6 rounded-2xl bg-card border border-border">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                        {phase.duration}
                      </span>
                      <h4 className="font-bold">{phase.phase}</h4>
                    </div>
                    <p className="text-muted mb-4">{phase.goal}</p>
                    <ul className="space-y-2 mb-4">
                      {phase.actions.map((action, i) => (
                        <li key={i} className="flex items-start gap-2 text-sm">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 shrink-0" />
                          {action}
                        </li>
                      ))}
                    </ul>
                    <div className="pt-4 border-t border-border">
                      <span className="text-sm text-primary font-medium">
                        里程碑：{phase.milestone}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        {/* 4. Revenue Model */}
        <motion.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">收入模型</h3>
          </div>

          <div className="grid sm:grid-cols-3 gap-4">
            {result.revenueModel.map((model, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-card border border-border"
              >
                <span className="text-xs font-medium text-muted mb-2 block">{model.phase}</span>
                <h4 className="font-semibold mb-2">{model.product}</h4>
                <p className="text-2xl font-bold text-primary mb-4">{model.pricing}</p>
                <div className="space-y-2 text-sm">
                  <p><span className="text-muted">目标客户：</span>{model.target}</p>
                  <p><span className="text-muted">预期收入：</span>{model.expectedIncome}</p>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 5. Risks */}
        <motion.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">风险短板</h3>
          </div>

          <div className="space-y-4">
            {result.risks.map((risk, index) => (
              <div 
                key={index}
                className="p-6 rounded-2xl bg-card border border-border"
              >
                <div className="flex items-start gap-4">
                  <div className="w-8 h-8 rounded-lg bg-red-500/10 flex items-center justify-center shrink-0">
                    <span className="text-red-400 font-bold">{index + 1}</span>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold mb-2">{risk.point}</h4>
                    <p className="text-sm text-muted mb-3">
                      <span className="text-yellow-500">预警信号：</span>{risk.warning}
                    </p>
                    <p className="text-sm">
                      <span className="text-green-500">解决动作：</span>{risk.solution}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </motion.section>

        {/* 6. Checklist */}
        <motion.section variants={itemVariants} className="mb-12">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <CheckSquare className="w-5 h-5 text-primary" />
            </div>
            <h3 className="text-xl font-bold">90天执行清单</h3>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {result.checklist.map((item, index) => (
              <div 
                key={index}
                className="p-5 rounded-2xl bg-card border border-border"
              >
                <span className="text-xs font-medium text-primary mb-3 block">{item.week}</span>
                <ul className="space-y-2">
                  {item.tasks.map((task, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <span className="w-4 h-4 rounded border border-muted mt-0.5 shrink-0" />
                      {task}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </motion.section>

        {/* CTA */}
        <motion.div variants={itemVariants} className="text-center pt-8 border-t border-border">
          <button
            onClick={onReset}
            className="px-8 py-4 bg-primary hover:bg-primary-hover text-white rounded-xl font-medium transition-all-300 glow"
          >
            分析另一份简历
          </button>
        </motion.div>
      </motion.main>
    </div>
  );
}