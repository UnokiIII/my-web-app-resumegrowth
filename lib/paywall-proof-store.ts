import { randomBytes } from 'crypto';
import { mkdir, readdir, readFile, unlink } from 'fs/promises';
import path from 'path';
import {
  findPaymentProofByOrder as findPaymentProofByOrderLocal,
  findPaymentProofByReceipt as findPaymentProofByReceiptLocal,
  findPaymentProofByTransferRef as findPaymentProofByTransferRefLocal,
  getPaywallDbPath as getPaywallDbPathLocal,
  listPaymentProofs as listPaymentProofsLocal,
  markUnlockCodeRedeemed as markUnlockCodeRedeemedLocal,
  markUnlockCodeSent as markUnlockCodeSentLocal,
  setUnlockCodeForOrder as setUnlockCodeForOrderLocal,
  upsertPaymentProof as upsertPaymentProofLocal,
} from './paywall-db';
import { getPaywallProofRootDir } from './paywall-storage';
import { getSupabaseBucket, getSupabaseServerClient, getSupabaseUrl, isSupabaseConfigured } from './supabase-server';

export interface PaymentProofRecord {
  receiptId: string;
  orderId: string;
  reportFileName: string;
  payerNote: string;
  payerContact: string;
  originalFileName: string;
  savedFileName: string;
  imagePath: string;
  transferRef: string | null;
  unlockCode: string;
  uploadedAt: string;
  redeemedAt: string | null;
  sentAt: string | null;
}

type SupabaseProofRow = {
  receipt_id: string;
  order_id: string;
  report_file_name: string | null;
  payer_note: string | null;
  payer_contact: string | null;
  original_file_name: string | null;
  saved_file_name: string | null;
  image_path: string | null;
  transfer_ref: string | null;
  unlock_code: string | null;
  uploaded_at: string;
  redeemed_at: string | null;
  sent_at: string | null;
};

const proofRoot = getPaywallProofRootDir();

function safeBaseName(input: string) {
  return input.replace(/[^\w\u4e00-\u9fa5-]+/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '') || 'proof';
}

function buildReceiptId(orderId: string) {
  const compactOrderId = safeBaseName(orderId).slice(0, 32) || 'order';
  const stamp = Date.now().toString(36).toUpperCase();
  return `PF-${compactOrderId}-${stamp}`;
}

function buildUnlockCode() {
  return `RG-${randomBytes(3).toString('hex').toUpperCase()}`;
}

function mapSupabaseRow(row: SupabaseProofRow | null): PaymentProofRecord | null {
  if (!row) return null;

  return {
    receiptId: row.receipt_id,
    orderId: row.order_id,
    reportFileName: row.report_file_name || '',
    payerNote: row.payer_note || '',
    payerContact: row.payer_contact || '',
    originalFileName: row.original_file_name || '',
    savedFileName: row.saved_file_name || '',
    imagePath: row.image_path || '',
    transferRef: row.transfer_ref,
    unlockCode: row.unlock_code || '',
    uploadedAt: row.uploaded_at,
    redeemedAt: row.redeemed_at,
    sentAt: row.sent_at,
  };
}

function toSupabaseRow(record: PaymentProofRecord) {
  return {
    receipt_id: record.receiptId,
    order_id: record.orderId,
    report_file_name: record.reportFileName || null,
    payer_note: record.payerNote || null,
    payer_contact: record.payerContact || null,
    original_file_name: record.originalFileName || null,
    saved_file_name: record.savedFileName || null,
    image_path: record.imagePath || null,
    transfer_ref: record.transferRef || null,
    unlock_code: record.unlockCode || '',
    uploaded_at: record.uploadedAt,
    redeemed_at: record.redeemedAt,
    sent_at: record.sentAt,
  };
}

export async function ensureProofRoot() {
  await mkdir(proofRoot, { recursive: true });
  return proofRoot;
}

async function upsertProofRecord(record: PaymentProofRecord) {
  if (!isSupabaseConfigured()) {
    upsertPaymentProofLocal(record);
    return findPaymentProofByOrderLocal(record.orderId) as PaymentProofRecord | null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error('Supabase 未正确配置。');
  }

  const { error } = await client.from('payment_proofs').upsert(toSupabaseRow(record), { onConflict: 'order_id' });
  if (error) {
    throw new Error(`写入 Supabase 失败：${error.message}`);
  }

  return findPaymentProofByOrder(record.orderId);
}

async function findPaymentProofByOrder(orderId: string) {
  if (!isSupabaseConfigured()) {
    return findPaymentProofByOrderLocal(orderId) as PaymentProofRecord | null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error('Supabase 未正确配置。');
  }

  const { data, error } = await client
    .from('payment_proofs')
    .select('*')
    .eq('order_id', orderId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`查询订单失败：${error.message}`);
  }

  return mapSupabaseRow(data as SupabaseProofRow | null);
}

export async function getPaymentProofRecordByReceipt(receiptId: string) {
  if (!isSupabaseConfigured()) {
    return findPaymentProofByReceiptLocal(receiptId) as PaymentProofRecord | null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error('Supabase 未正确配置。');
  }

  const { data, error } = await client
    .from('payment_proofs')
    .select('*')
    .eq('receipt_id', receiptId)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`查询回执失败：${error.message}`);
  }

  return mapSupabaseRow(data as SupabaseProofRow | null);
}

async function findPaymentProofByTransferRef(transferRef: string) {
  if (!isSupabaseConfigured()) {
    return findPaymentProofByTransferRefLocal(transferRef) as PaymentProofRecord | null;
  }

  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error('Supabase 未正确配置。');
  }

  const { data, error } = await client
    .from('payment_proofs')
    .select('*')
    .eq('transfer_ref', transferRef)
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`查询转账单号失败：${error.message}`);
  }

  return mapSupabaseRow(data as SupabaseProofRow | null);
}

export async function getPaymentProofRecords() {
  if (!isSupabaseConfigured()) {
    return listPaymentProofsLocal() as PaymentProofRecord[];
  }

  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error('Supabase 未正确配置。');
  }

  const { data, error } = await client
    .from('payment_proofs')
    .select('*')
    .order('uploaded_at', { ascending: false });

  if (error) {
    throw new Error(`读取订单列表失败：${error.message}`);
  }

  return (data || [])
    .map((row) => mapSupabaseRow(row as SupabaseProofRow))
    .filter(Boolean) as PaymentProofRecord[];
}

export async function createOrUpdateProofRecord(input: {
  orderId: string;
  reportFileName: string;
  payerNote: string;
  payerContact: string;
  transferRef: string;
  originalFileName: string;
  savedFileName: string;
  imagePath: string;
}) {
  await ensureProofRoot();

  const normalizedTransferRef = input.transferRef.trim();
  if (normalizedTransferRef) {
    const existingByTransferRef = await findPaymentProofByTransferRef(normalizedTransferRef);
    if (existingByTransferRef && existingByTransferRef.orderId !== input.orderId) {
      return {
        ok: false as const,
        reason: 'duplicate_transfer_ref' as const,
        existingOrderId: existingByTransferRef.orderId,
      };
    }
  }

  const existing = await findPaymentProofByOrder(input.orderId);
  const receiptId = existing?.receiptId || buildReceiptId(input.orderId);

  const record = await upsertProofRecord({
    receiptId,
    orderId: input.orderId,
    reportFileName: input.reportFileName,
    payerNote: input.payerNote,
    payerContact: input.payerContact,
    originalFileName: input.originalFileName,
    savedFileName: input.savedFileName,
    imagePath: input.imagePath,
    transferRef: normalizedTransferRef || null,
    unlockCode: existing?.unlockCode || '',
    uploadedAt: new Date().toISOString(),
    redeemedAt: existing?.redeemedAt || null,
    sentAt: existing?.sentAt || null,
  });

  return {
    ok: true as const,
    record,
  };
}

export async function ensureUnlockOrderRecord(input: { orderId: string; reportFileName: string }) {
  const existing = await findPaymentProofByOrder(input.orderId);
  if (existing) {
    return existing;
  }

  const receiptId = buildReceiptId(input.orderId);
  return upsertProofRecord({
    receiptId,
    orderId: input.orderId,
    reportFileName: input.reportFileName,
    payerNote: '',
    payerContact: '',
    originalFileName: '',
    savedFileName: '',
    imagePath: '',
    transferRef: null,
    unlockCode: '',
    uploadedAt: new Date().toISOString(),
    redeemedAt: null,
    sentAt: null,
  });
}

export async function generateOrderUnlockCode(input: { orderId: string; reportFileName: string }) {
  const existing = await findPaymentProofByOrder(input.orderId);
  const nextUnlockCode = buildUnlockCode();
  const nextReportFileName = input.reportFileName || existing?.reportFileName || '未命名报告';

  if (!isSupabaseConfigured()) {
    if (existing) {
      return setUnlockCodeForOrderLocal(input.orderId, nextUnlockCode, nextReportFileName) as PaymentProofRecord | null;
    }

    const receiptId = buildReceiptId(input.orderId);
    await upsertProofRecord({
      receiptId,
      orderId: input.orderId,
      reportFileName: nextReportFileName,
      payerNote: '',
      payerContact: '',
      originalFileName: '',
      savedFileName: '',
      imagePath: '',
      transferRef: null,
      unlockCode: nextUnlockCode,
      uploadedAt: new Date().toISOString(),
      redeemedAt: null,
      sentAt: null,
    });

    return findPaymentProofByOrderLocal(input.orderId) as PaymentProofRecord | null;
  }

  const receiptId = existing?.receiptId || buildReceiptId(input.orderId);
  return upsertProofRecord({
    receiptId,
    orderId: input.orderId,
    reportFileName: nextReportFileName,
    payerNote: existing?.payerNote || '',
    payerContact: existing?.payerContact || '',
    originalFileName: existing?.originalFileName || '',
    savedFileName: existing?.savedFileName || '',
    imagePath: existing?.imagePath || '',
    transferRef: existing?.transferRef || null,
    unlockCode: nextUnlockCode,
    uploadedAt: new Date().toISOString(),
    redeemedAt: null,
    sentAt: null,
  });
}

export async function redeemOrderUnlockCode(orderId: string, code: string) {
  const record = await findPaymentProofByOrder(orderId);
  if (!record) return { ok: false as const, reason: 'not_found' as const };
  if (!record.unlockCode?.trim()) return { ok: false as const, reason: 'code_not_generated' as const };
  if (record.redeemedAt) return { ok: false as const, reason: 'already_redeemed' as const };
  if (record.unlockCode !== code.trim()) return { ok: false as const, reason: 'invalid_code' as const };

  const redeemedAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    markUnlockCodeRedeemedLocal(orderId);
  } else {
    const client = getSupabaseServerClient();
    if (!client) {
      throw new Error('Supabase 未正确配置。');
    }

    const { error } = await client
      .from('payment_proofs')
      .update({ redeemed_at: redeemedAt })
      .eq('order_id', orderId);

    if (error) {
      throw new Error(`更新解锁状态失败：${error.message}`);
    }
  }

  return {
    ok: true as const,
    record: {
      ...record,
      redeemedAt,
    },
  };
}

export function getProofRootPath() {
  if (isSupabaseConfigured()) {
    return `supabase://${getSupabaseBucket()}`;
  }

  return proofRoot;
}

export function getProofDbPath() {
  if (isSupabaseConfigured()) {
    return `${getSupabaseUrl()}/rest/v1/payment_proofs`;
  }

  return getPaywallDbPathLocal();
}

export async function markPaymentProofSent(receiptId: string) {
  const record = await getPaymentProofRecordByReceipt(receiptId);
  if (!record) return null;

  const sentAt = new Date().toISOString();

  if (!isSupabaseConfigured()) {
    markUnlockCodeSentLocal(receiptId);
    return {
      ...record,
      sentAt,
    };
  }

  const client = getSupabaseServerClient();
  if (!client) {
    throw new Error('Supabase 未正确配置。');
  }

  const { error } = await client
    .from('payment_proofs')
    .update({ sent_at: sentAt })
    .eq('receipt_id', receiptId);

  if (error) {
    throw new Error(`更新发送状态失败：${error.message}`);
  }

  return {
    ...record,
    sentAt,
  };
}

export async function migrateJsonProofsToDb() {
  await ensureProofRoot();
  const files = await readdir(proofRoot);
  const jsonFiles = files.filter((name) => name.endsWith('.json'));

  for (const fileName of jsonFiles) {
    const metaPath = path.join(proofRoot, fileName);
    const raw = await readFile(metaPath, 'utf8');
    const record = JSON.parse(raw) as {
      receiptId: string;
      orderId: string;
      reportFileName: string;
      payerNote: string;
      payerContact: string;
      originalFileName: string;
      savedFileName: string;
      unlockCode?: string;
      uploadedAt: string;
      redeemedAt?: string | null;
    };

    await upsertProofRecord({
      receiptId: record.receiptId,
      orderId: record.orderId,
      reportFileName: record.reportFileName,
      payerNote: record.payerNote,
      payerContact: record.payerContact,
      originalFileName: record.originalFileName,
      savedFileName: record.savedFileName,
      imagePath: path.join(proofRoot, record.savedFileName),
      transferRef: null,
      unlockCode: record.unlockCode || '',
      uploadedAt: record.uploadedAt,
      redeemedAt: record.redeemedAt || null,
      sentAt: null,
    });

    await unlink(metaPath);
  }
}
