'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, FileText, Sparkles, ArrowRight, TrendingUp, Shield, Zap } from 'lucide-react';
import { cn } from '@/lib/utils';
import { ResumeData, AnalysisResult, generateMockAnalysis } from '@/lib/mock-data';
import ReportView from '@/components/ReportView';

export default function Home() {
  const [isDragging, setIsDragging] = useState(false);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await analyzeResume();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) await analyzeResume();
  };

  const analyzeResume = async () => {
    setIsAnalyzing(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 2500));
    
    const mockResume: ResumeData = {
      name: '用户',
      yearsExperience: 5,
      currentRole: '产品经理',
      industry: '互联网/科技',
      skills: [
        { name: '产品策略', level: '精通', context: '从0到1搭建多个产品' },
        { name: '数据分析', level: '熟练', context: '擅长用户行为分析' },
      ],
      achievements: [
        { desc: '主导用户增长项目', metric: 'DAU提升40%', scope: '百万级用户产品' },
      ],
      experience: [
        { company: '某科技公司', role: '高级产品经理', highlights: ['负责核心产品线'] },
      ],
      education: '本科',
      interests: ['AI工具', '一人企业'],
    };
    
    setResult(generateMockAnalysis(mockResume));
    setIsAnalyzing(false);
  };

  if (result) {
    return <ReportView result={result} onReset={() => setResult(null)} />;
  }

  return (
    <main className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative px-6 pt-20 pb-32 overflow-hidden">
        {/* Background gradient */}
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-primary/20 via-background to-background" />
        
        <div className="relative max-w-5xl mx-auto text-center">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <span className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-medium mb-8 border border-primary/20">
              <Sparkles className="w-4 h-4" />
              AI 驱动的职业分析
            </span>
          </motion.div>

          <motion.h1
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight mb-6"
          >
            上传简历，获取你的
            <br />
            <span className="gradient-text">一人企业成长方案</span>
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-lg sm:text-xl text-muted max-w-2xl mx-auto mb-12"
          >
            基于你的经历与技能，AI为你定制专属的商业化路径。
            <br className="hidden sm:block" />
            从优势资产盘点到90天执行清单，每一步都清晰可执行。
          </motion.p>

          {/* Upload Area */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="max-w-xl mx-auto"
          >
            <div
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
              className={cn(
                'relative p-8 sm:p-12 rounded-2xl border-2 border-dashed transition-all-300',
                isDragging
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:border-muted hover:bg-card-hover'
              )}
            >
              {isAnalyzing ? (
                <div className="flex flex-col items-center">
                  <div className="relative mb-6">
                    <div className="w-16 h-16 rounded-full border-4 border-border animate-spin border-t-primary" />
                    <Sparkles className="absolute inset-0 m-auto w-6 h-6 text-primary animate-pulse" />
                  </div>
                  <p className="text-lg font-medium">AI 正在分析你的简历...</p>
                  <p className="text-sm text-muted mt-2">预计需要 10-15 秒</p>
                </div>
              ) : (
                <>
                  <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-primary/10 flex items-center justify-center">
                    <Upload className="w-8 h-8 text-primary" />
                  </div>
                  <p className="text-lg font-medium mb-2">
                    拖拽简历文件到这里
                  </p>
                  <p className="text-sm text-muted mb-6">
                    支持 PDF、Word 格式（最大 10MB）
                  </p>
                  <label className="inline-flex items-center gap-2 px-6 py-3 bg-primary hover:bg-primary-hover text-white rounded-xl cursor-pointer transition-all-300 glow">
                    <FileText className="w-4 h-4" />
                    选择文件
                    <input
                      type="file"
                      accept=".pdf,.doc,.docx"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                  </label>
                </>
              )}
            </div>
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="px-6 py-20 border-t border-border">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-2xl sm:text-3xl font-bold mb-4">你将获得什么</h2>
            <p className="text-muted">6个维度，全方位规划你的一人企业路径</p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: TrendingUp,
                title: '优势资产盘点',
                desc: '识别你最易变现的3个核心能力，明确产品方向',
              },
              {
                icon: Zap,
                title: '精准定位建议',
                desc: '主定位+备选方案，找到最适合你的赛道',
              },
              {
                icon: ArrowRight,
                title: '清晰成长路径',
                desc: '0-3月/3-6月/6-12月三阶段规划，目标明确',
              },
              {
                icon: TrendingUp,
                title: '收入模型设计',
                desc: '从首单到规模化，产品定价与预期收入',
              },
              {
                icon: Shield,
                title: '风险预警与对策',
                desc: '提前识别3大风险点，给出具体解决方案',
              },
              {
                icon: FileText,
                title: '90天执行清单',
                desc: '按周拆解任务，可直接执行的行动指南',
              },
            ].map((feature, index) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                viewport={{ once: true }}
                className="p-6 rounded-2xl bg-card hover:bg-card-hover transition-all-300 border border-border"
              >
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center mb-4">
                  <feature.icon className="w-6 h-6 text-primary" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted">{feature.desc}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="px-6 py-8 border-t border-border">
        <div className="max-w-5xl mx-auto text-center text-sm text-muted">
          <p>© 2026 Resume Analyzer. 基于 AI 的职业分析与规划工具。</p>
        </div>
      </footer>
    </main>
  );
}