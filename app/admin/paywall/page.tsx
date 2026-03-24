import { cookies } from 'next/headers';
import type { ReactNode } from 'react';
import { AlertTriangle, FileText, KeyRound, Lock, QrCode, Search, ShieldCheck } from 'lucide-react';
import PaywallAdminActions from '@/components/admin/paywall-admin-actions';
import PaywallGenerateCodeForm from '@/components/admin/paywall-generate-code-form';
import { getPaymentProofRecords, getProofDbPath, getProofRootPath, migrateJsonProofsToDb, type PaymentProofRecord } from '@/lib/paywall-proof-store';
import { getPaywallAdminCookieName, isValidAdminSessionCookie } from '@/lib/paywall';

export const dynamic = 'force-dynamic';

function LoginCard(props: { error?: string }) {
  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-md rounded-[28px] border border-white/10 bg-white/[0.03] p-6 shadow-[0_24px_80px_rgba(0,0,0,0.35)]">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
          <ShieldCheck className="h-3.5 w-3.5" />
          Admin Login
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">输入后台访问密码</h1>
        <p className="mt-3 text-sm leading-7 text-white/60">
          后台页只给你自己管理订单、生成一次性解锁码、复制解锁码和标记发送状态，不对普通用户开放。
        </p>

        <form action="/api/admin/login?next=/admin/paywall" method="post" className="mt-6 space-y-4">
          <div className="space-y-2">
            <label htmlFor="password" className="text-sm text-white/75">
              后台密码
            </label>
            <input
              id="password"
              name="password"
              type="password"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.06]"
              placeholder="输入后台访问密码"
            />
          </div>

          {props.error ? (
            <div className="rounded-2xl border border-rose-400/20 bg-rose-400/10 px-4 py-3 text-sm text-rose-100">
              {props.error}
            </div>
          ) : null}

          <button
            type="submit"
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-white px-4 py-3 text-sm font-medium text-black transition hover:bg-white/90"
          >
            <Lock className="h-4 w-4" />
            进入后台
          </button>
        </form>
      </div>
    </main>
  );
}

function StatusBadge(props: { children: ReactNode; tone: 'default' | 'amber' | 'sky' | 'emerald' }) {
  const toneClass =
    props.tone === 'amber'
      ? 'border-amber-400/20 bg-amber-400/10 text-amber-100'
      : props.tone === 'sky'
        ? 'border-sky-400/20 bg-sky-400/10 text-sky-100'
        : props.tone === 'emerald'
          ? 'border-emerald-400/20 bg-emerald-400/10 text-emerald-100'
          : 'border-white/10 bg-white/5 text-white/70';

  return <div className={`rounded-full border px-3 py-1.5 text-sm ${toneClass}`}>{props.children}</div>;
}

export default async function PaywallAdminPage(props: {
  searchParams?: Promise<{ error?: string; q?: string }> | { error?: string; q?: string };
}) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(getPaywallAdminCookieName())?.value;
  const searchParams = props.searchParams ? await props.searchParams : undefined;

  if (!isValidAdminSessionCookie(adminCookie)) {
    const error = searchParams?.error === 'invalid-password' ? '后台密码错误，请重新输入。' : undefined;
    return <LoginCard error={error} />;
  }

  let allRecords: PaymentProofRecord[] = [];
  let storageError: string | null = null;

  try {
    await migrateJsonProofsToDb();
    allRecords = await getPaymentProofRecords();
  } catch (error) {
    storageError = error instanceof Error ? error.message : '后台存储初始化失败，请稍后重试。';
  }

  const rawQuery = typeof searchParams?.q === 'string' ? searchParams.q.trim() : '';
  const keyword = rawQuery.toLowerCase();
  const records = keyword
    ? allRecords.filter((item) =>
        [item.orderId, item.receiptId, item.reportFileName, item.transferRef]
          .filter(Boolean)
          .some((value) => String(value).toLowerCase().includes(keyword))
      )
    : allRecords;

  const pendingGenerateCount = allRecords.filter((item) => !item.unlockCode?.trim()).length;
  const pendingSendCount = allRecords.filter((item) => item.unlockCode?.trim() && !item.sentAt).length;
  const redeemedCount = allRecords.filter((item) => item.redeemedAt).length;

  return (
    <main className="min-h-screen bg-[#0b0d12] px-4 py-10 text-white sm:px-6">
      <div className="mx-auto max-w-6xl">
        <div className="mb-8 flex flex-wrap items-end justify-between gap-4">
          <div>
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
              <ShieldCheck className="h-3.5 w-3.5" />
              Paywall Admin
            </div>
            <h1 className="text-3xl font-semibold tracking-tight">一次性解锁码后台</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-white/60">
              这页只做三件事：按订单号生成一次性解锁码、复制后手动发给用户、确认这笔解锁码是否已经兑换。
            </p>
          </div>

          <div className="rounded-3xl border border-white/10 bg-white/[0.03] px-5 py-4 text-sm text-white/65">
            <div>
              数据库：<span className="font-mono text-white/80">{getProofDbPath()}</span>
            </div>
            <div className="mt-2">
              回执目录：<span className="font-mono text-white/80">{getProofRootPath()}</span>
            </div>
          </div>
        </div>

        {storageError ? (
          <div className="mb-6 rounded-[28px] border border-rose-400/20 bg-rose-400/10 p-5 sm:p-6">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-rose-400/20 bg-rose-400/10 px-3 py-1.5 text-xs text-rose-100">
              <AlertTriangle className="h-3.5 w-3.5" />
              存储异常
            </div>
            <div className="text-sm leading-7 text-rose-50/90">
              后台页面已经打开，但订单存储初始化失败，所以暂时无法读取或生成解锁码。
              <br />
              原因：{storageError}
            </div>
          </div>
        ) : null}

        <div className="mb-6 grid gap-4 sm:grid-cols-4">
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">订单总数</div>
            <div className="mt-3 text-3xl font-semibold text-white">{allRecords.length}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">未生成解锁码</div>
            <div className="mt-3 text-3xl font-semibold text-amber-100">{pendingGenerateCount}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">待手动发码</div>
            <div className="mt-3 text-3xl font-semibold text-sky-100">{pendingSendCount}</div>
          </div>
          <div className="rounded-3xl border border-white/10 bg-white/[0.03] p-5">
            <div className="text-xs uppercase tracking-[0.18em] text-white/40">已兑换</div>
            <div className="mt-3 text-3xl font-semibold text-emerald-100">{redeemedCount}</div>
          </div>
        </div>

        <div className="mb-6">
          <PaywallGenerateCodeForm />
        </div>

        <div className="mb-6 rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
          <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white/70">
            <Search className="h-3.5 w-3.5" />
            订单号搜索
          </div>

          <form action="/admin/paywall" method="get" className="grid gap-4 md:grid-cols-[1fr_auto_auto]">
            <input
              type="text"
              name="q"
              defaultValue={rawQuery}
              placeholder="输入订单号、回执编号、报告名或转账单号"
              className="w-full rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm text-white outline-none transition-all placeholder:text-white/25 focus:border-white/20 focus:bg-white/[0.06]"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-medium text-black transition hover:bg-white/90"
            >
              <Search className="h-4 w-4" />
              搜索
            </button>
            <a
              href="/admin/paywall"
              className="inline-flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 px-5 py-3 text-sm text-white/75 transition hover:bg-white/10 hover:text-white"
            >
              清空
            </a>
          </form>

          <div className="mt-4 text-sm text-white/55">
            {rawQuery
              ? `当前关键字：${rawQuery}，共匹配到 ${records.length} 条订单记录。`
              : `当前共 ${allRecords.length} 条订单记录。`}
          </div>
        </div>

        <div className="space-y-4">
          {records.length === 0 ? (
            <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] px-6 py-12 text-center text-white/55">
              {rawQuery
                ? '没有找到匹配的订单记录，请换个关键字再试。'
                : '还没有订单记录。先在前台打开一次解锁弹窗，系统会先为当前报告创建订单号。'}
            </div>
          ) : (
            records.map((record) => {
              const hasUnlockCode = Boolean(record.unlockCode?.trim());

              return (
                <article key={record.receiptId} className="rounded-[28px] border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                  <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
                    <div className="space-y-4">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <div className="text-xs uppercase tracking-[0.18em] text-white/40">订单号</div>
                          <div className="mt-2 text-xl font-semibold text-white">{record.orderId}</div>
                        </div>
                        <div className="rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-sm text-white/70">
                          回执编号：<span className="font-mono">{record.receiptId}</span>
                        </div>
                      </div>

                      <div className="grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-2 flex items-center gap-2 text-xs uppercase tracking-[0.16em] text-white/35">
                            <FileText className="h-3.5 w-3.5" />
                            关联报告
                          </div>
                          <div className="text-sm leading-7 text-white/80">{record.reportFileName || '未登记'}</div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                          <div className="mb-2 text-xs uppercase tracking-[0.16em] text-white/35">留档信息</div>
                          <div className="text-sm leading-7 text-white/80">转账单号：{record.transferRef || '未登记'}</div>
                          <div className="text-sm leading-7 text-white/70">备注：{record.payerNote || '未填写'}</div>
                          <div className="text-sm leading-7 text-white/60">联系方式：{record.payerContact || '未填写'}</div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-2 flex items-center gap-2 text-sm font-medium text-white">
                          <KeyRound className="h-4 w-4" />
                          一次性解锁码
                        </div>
                        {hasUnlockCode ? (
                          <>
                            <div className="font-mono text-xl font-semibold text-amber-100">{record.unlockCode}</div>
                            <div className="mt-2 text-sm leading-6 text-white/55">
                              这个码只对应当前订单。用户输入成功后会立刻永久失效，请提醒对方在当前设备确认无误后再使用，并尽快导出 PDF。
                            </div>
                          </>
                        ) : (
                          <div className="text-sm leading-6 text-white/55">
                            当前还没有生成解锁码。你可以点击下面的按钮直接为这笔订单生成一次性解锁码。
                          </div>
                        )}
                        <div className="mt-4">
                          <PaywallAdminActions
                            receiptId={record.receiptId}
                            orderId={record.orderId}
                            reportFileName={record.reportFileName || '未命名报告'}
                            unlockCode={record.unlockCode || null}
                            sentAt={record.sentAt}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 text-xs uppercase tracking-[0.16em] text-white/35">状态</div>
                        <div className="space-y-3">
                          {!hasUnlockCode ? <StatusBadge tone="amber">未生成解锁码</StatusBadge> : null}
                          {hasUnlockCode && !record.sentAt ? <StatusBadge tone="sky">待手动发码</StatusBadge> : null}
                          {record.sentAt ? <StatusBadge tone="sky">已手动发送</StatusBadge> : null}
                          {record.redeemedAt ? <StatusBadge tone="emerald">已兑换</StatusBadge> : <StatusBadge tone="default">未兑换</StatusBadge>}

                          {record.sentAt ? <div className="text-xs leading-6 text-white/55">发码时间：{record.sentAt}</div> : null}
                          {record.redeemedAt ? <div className="text-xs leading-6 text-white/55">兑换时间：{record.redeemedAt}</div> : null}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4">
                        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-white">
                          <QrCode className="h-4 w-4" />
                          付款截图
                        </div>
                        {record.imagePath ? (
                          <img
                            src={`/api/paywall/proof-file/${record.receiptId}`}
                            alt={`付款截图-${record.receiptId}`}
                            className="w-full rounded-2xl border border-white/10 bg-black object-cover"
                          />
                        ) : (
                          <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.03] px-4 py-10 text-sm leading-7 text-white/50">
                            当前这笔订单没有站内上传的付款截图。
                            <br />
                            这不影响你直接生成解锁码，并通过微信手动发给用户。
                          </div>
                        )}
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-black/20 p-4 text-xs leading-6 text-white/45">
                        原始图片：{record.originalFileName || '未登记'}
                        <br />
                        存储路径：{record.imagePath || '未上传'}
                        <br />
                        创建时间：{record.uploadedAt}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </main>
  );
}
