export const CASE_DETAIL_FIELDS = [
  { key: 'id', type: 'string', required: true, description: '案例唯一 ID' },
  { key: 'title', type: 'string', required: true, description: '案例标题' },
  { key: 'summary', type: 'string', required: false, description: '案例摘要，可用于列表页' },
  { key: 'routeId', type: 'enum', required: true, description: '主路线 ID' },
  { key: 'sceneId', type: 'enum', required: true, description: '主场景 ID' },
  { key: 'background', type: 'text', required: true, description: '案例背景' },
  { key: 'trigger', type: 'text', required: true, description: '适用触发条件' },
  { key: 'firstDeal', type: 'text', required: true, description: '第一单打法' },
  { key: 'monetization', type: 'text', required: true, description: '变现方式' },
  { key: 'assetUpgrade', type: 'text', required: true, description: '资产升级方向' },
  { key: 'whyItMatches', type: 'string[]', required: true, description: '推荐依据' },
  { key: 'tags', type: 'CaseTag[]', required: true, description: '标签数组' },
  { key: 'sourceLabel', type: 'string', required: true, description: '来源标签' },
  { key: 'sourceType', type: 'enum', required: true, description: '来源类型' },
  { key: 'sourceUrl', type: 'string', required: false, description: '外部来源链接' },
  { key: 'body', type: 'richtext', required: false, description: '案例详情正文' },
  { key: 'proof', type: 'object[]', required: false, description: '截图、数据、引用等证明材料' },
  { key: 'status', type: 'enum', required: false, description: 'draft | published | archived' },
];

export const CMS_CASE_SCHEMA = {
  collection: 'knowledge_cases',
  displayField: 'title',
  fields: CASE_DETAIL_FIELDS,
};
