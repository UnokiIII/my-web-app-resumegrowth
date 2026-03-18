# Resume Analyzer | 简历分析产品站

基于 Next.js 14 构建的简历分析产品，上传简历即可获取 AI 生成的一人企业成长方案。

## 功能特性

- 📄 **简历上传**：支持拖拽上传 PDF/Word 文件
- 🤖 **AI 分析**：自动生成 6 维度成长方案
- 📊 **可视化报告**：
  - 优势资产雷达图
  - 成长路径时间轴
  - 收入模型卡片
  - 风险预警清单
  - 90天执行清单
- 🎨 **深色主题**：Linear/Vercel 风格设计
- 📱 **响应式布局**：完美适配移动端

## 技术栈

- **框架**：Next.js 14 + React 18
- **语言**：TypeScript
- **样式**：Tailwind CSS
- **UI 组件**：shadcn/ui 风格
- **动画**：Framer Motion
- **图表**：Recharts

## 快速开始

### 1. 安装依赖

```bash
cd resume-analyzer
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

访问 http://localhost:3000

### 3. 构建生产版本

```bash
npm run build
npm start
```

## 项目结构

```
resume-analyzer/
├── app/                    # Next.js App Router
│   ├── globals.css        # 全局样式
│   ├── layout.tsx         # 根布局
│   └── page.tsx           # 首页（Landing Page）
├── components/            # 组件
│   └── ReportView.tsx     # 分析报告展示组件
├── lib/                   # 工具函数
│   ├── utils.ts           # 通用工具
│   └── mock-data.ts       # 模拟数据生成
├── package.json           # 依赖配置
├── tailwind.config.ts     # Tailwind 配置
└── README.md             # 项目说明
```

## 使用流程

1. 在首页拖拽或点击上传简历文件
2. 等待 AI 分析（约 10-15 秒）
3. 查看生成的 6 维度成长方案：
   - 优势资产盘点（含雷达图）
   - 一人企业定位
   - 成长路径（时间轴）
   - 收入模型
   - 风险短板
   - 90天执行清单
4. 可导出 PDF 报告（开发中）

## 后续开发计划

- [ ] 接入真实 AI API（Claude/OpenAI）
- [ ] PDF 导出功能
- [ ] 用户登录与历史记录
- [ ] 支付集成
- [ ] 更多可视化图表

## 设计参考

- 深色主题配色：#0a0a0f（背景）、#fafafa（文字）、#6366f1（主色）
- 风格参考：Linear、Vercel、Notion
- 字体：Inter

## License

MIT