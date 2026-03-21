# Knowledge Engine 说明文档

## 1. 当前目标

这个项目不是把简历直接发给模型做泛化建议，而是：

1. 先解析简历
2. 再用知识库做场景判断、路线判断、案例召回
3. 最后把这些上下文交给模型生成报告

核心差异化来自知识库，而不是模型名字。

## 2. 当前结构

知识库目录在 [lib/knowledge](D:/一人企业/archive/temp/my-web-app-resumegrowth/lib/knowledge)。

- `methodology.ts`
  - 存一人企业的方法论规则
  - 包含资产池、先第一单、先服务后产品、现金流优先、足够阈值等
- `routes.ts`
  - 存路线池定义
  - 例如项目制交付、标准化服务、顾问、代运营、工具产品、内容/IP
- `scenes.ts`
  - 存背景场景映射
  - 例如销售、技术、运营、设计、内容、管理、初级
- `faqs.ts`
  - 存解释型 FAQ
  - 用于解释为什么不建议 IP、为什么不建议直接做 SaaS 等
- `cases.ts`
  - 存案例库
  - 包括 creator reference 和内部模式案例
- `types.ts`
  - 存知识库层的类型定义

运行时引擎在 [lib/knowledge-engine.ts](D:/一人企业/archive/temp/my-web-app-resumegrowth/lib/knowledge-engine.ts)。

## 3. 数据流

API 入口在 [app/api/analyze/route.ts](D:/一人企业/archive/temp/my-web-app-resumegrowth/app/api/analyze/route.ts)。

当前流程是：

1. 上传简历
2. 提取文本
3. `parseResumeText`
4. `buildKnowledgeContext`
5. `analyzeResumeByModel`
6. 返回报告结果和 `knowledgeGuidance`

其中 `buildKnowledgeContext` 会产出：

- `primaryScene`
- `candidateRoutes`
- `rejectedRoutes`
- `recommendedArticles`
- `recommendedFaqs`
- `recommendedCases`
- `promptContext`

## 4. 案例库现在具备的能力

案例库现在不是简单列表，而是结构化推荐系统。

每个案例包含：

- 基础信息
  - `title`
  - `background`
  - `trigger`
  - `firstDeal`
  - `monetization`
  - `assetUpgrade`
- 路线与场景
  - `routeId`
  - `sceneId`
- 标签体系
  - `tags`
  - `category`
- 来源信息
  - `sourceLabel`
  - `sourceType`
- 推荐依据
  - `whyItMatches`

运行时推荐结果还会多出：

- `score`
- `scoreLabel`
- `recommendationReason`
- `matchedSignals`
- `matchedTags`

## 5. 案例筛选逻辑

当前筛选逻辑在 [lib/knowledge-engine.ts](D:/一人企业/archive/temp/my-web-app-resumegrowth/lib/knowledge-engine.ts) 中，核心评分项有：

1. 场景是否一致
2. 路线是否一致
3. 标签是否命中
4. 经验密度是否支持该案例

当前策略是优先保守匹配，不追求案例数量，最多推荐 3 个。

## 6. Creator Reference 的作用

你补充的 4 个 creator 现在被拆成两类使用：

1. 方法论原型
   - Dan Koe: 差异化来自价值逻辑
   - Iman Gadzhi: 先现金流后粉丝规模
   - Justin Welsh: 内容要系统化
   - Paul Jarvis: 先定义足够

2. 案例原型
   - 作为案例召回时的高层参考，不是机械模板
   - 用来帮助模型解释为什么推荐某条路径

## 7. 报告页现在能展示什么

报告页在 [components/ReportView.tsx](D:/一人企业/archive/temp/my-web-app-resumegrowth/components/ReportView.tsx)。

当前知识库区块能展示：

- 匹配场景
- 推荐阅读
- FAQ
- 相似案例
  - 匹配分
  - 推荐理由
  - 触发条件
  - 首单打法
  - 变现方式
  - 资产升级
  - 命中标签
  - 命中信号

## 8. 适合下一步做什么

最值得继续做的是：

1. 接案例详情页
2. 接 CMS
3. 给每个案例加真实来源链接和截图
4. 给案例增加发布时间、可信度和适用范围

## 9. 当前状态

当前改动只在本地：

- 本地目录：`D:\\一人企业\\archive\\temp\\my-web-app-resumegrowth`
- 没有 push 到 GitHub
- 没有触发 Vercel 部署

类型检查 `npx tsc --noEmit` 已通过。
