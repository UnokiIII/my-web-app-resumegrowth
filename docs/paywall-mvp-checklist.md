# 1 元解锁执行版：上线前清单

## 当前最终逻辑

- 免费可看：
  - 主定位 / 备选路径
  - 路线判断
  - 第一单路径
  - 成长路径里的“怎么做”
- 1 元解锁后可看：
  - 成长路径里的“去哪找”
  - 成长路径里的“产出物”
  - PDF 导出

## 用户侧流程

1. 用户生成报告
2. 点击锁定内容或 PDF 导出
3. 打开解锁弹窗
4. 扫微信收款码支付 1 元
5. 扫“添加微信好友”二维码
6. 把订单号发给你
7. 你在后台为该订单生成一次性解锁码并发给用户
8. 用户回到当前页面输入解锁码
9. 解锁当前报告

## 一次性解锁码规则

- 一单一码
- 后台手动生成
- 输入成功后立即永久失效
- 页面文案固定为：
  - 解锁码为一次性使用
  - 输入成功后立即失效
  - 请确认当前设备和页面无误后再使用
  - 解锁后请尽快导出并保存 PDF

## 后台页功能

后台地址：
`/admin/paywall`

后台密码环境变量：
`PAYWALL_ADMIN_PASSWORD`

当前后台支持：
- 密码登录
- 按订单号直接生成一次性解锁码
- 查看订单号 / 回执编号 / 关联报告
- 复制解锁码
- 标记“已手动发送”
- 查看是否已兑换
- 查看付款截图留档（如有历史数据）

## 需要准备的文件

这两个文件会随仓库一起提交：
- `public/wechat-pay-qr.jpg`
- `public/wechat-add-friend-qr.png`

## 环境变量

```env
DASHSCOPE_API_KEY=your_dashscope_key
NEXT_PUBLIC_PAYWALL_PRICE_LABEL=1 元
NEXT_PUBLIC_PAYWALL_PAYMENT_ENTRY_MODE=wechat-manual
PAYWALL_ADMIN_PASSWORD=RG-ADMIN-2026
```

## 数据存储

数据库文件：
`data/paywall.db`

付款截图目录：
`tmp/payment-proofs`

这两类数据仍然不提交到仓库。

## 提交 GitHub 前确认

- `.env.local` 不提交
- `data/paywall.db` 不提交
- `tmp/payment-proofs` 不提交
- 后台密码已经改成你自己的值
- 本地构建和类型检查通过

## 上线后建议

- 把后台密码改成独立强密码
- 定期备份 `data/paywall.db`
- 如后续有营业执照，再把人工发码升级成正式支付回调
