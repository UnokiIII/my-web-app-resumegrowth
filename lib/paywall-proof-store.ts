import { randomBytes } from 'crypto';
import { mkdir, readdir, readFile, unlink } from 'fs/promises';
import path from 'path';
import {
  findPaymentProofByOrder,
  findPaymentProofByReceipt,
  findPaymentProofByTransferRef,
  getPaywallDbPath,
  listPaymentProofs,
  markUnlockCodeRedeemed,
  markUnlockCodeSent,
  setUnlockCodeForOrder,
  upsertPaymentProof,
} from './paywall-db';
import { getPaywallProofRootDir } from './paywall-storage';

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

const proofRoot = getPaywallProofRootDir();

export async function ensureProofRoot() {
  await mkdir(proofRoot, { recursive: true });
  return proofRoot;
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
    const existingByTransferRef = findPaymentProofByTransferRef(normalizedTransferRef);
    if (existingByTransferRef && existingByTransferRef.orderId !== input.orderId) {
      return {
        ok: false as const,
        reason: 'duplicate_transfer_ref' as const,
        existingOrderId: existingByTransferRef.orderId,
      };
    }
  }

  const existing = findPaymentProofByOrder(input.orderId);
  const receiptId = existing?.receiptId || buildReceiptId(input.orderId);

  upsertPaymentProof({
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
    record: findPaymentProofByOrder(input.orderId),
  };
}

export function ensureUnlockOrderRecord(input: { orderId: string; reportFileName: string }) {
  const existing = findPaymentProofByOrder(input.orderId);
  if (existing) {
    return existing;
  }

  const receiptId = buildReceiptId(input.orderId);
  upsertPaymentProof({
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

  return findPaymentProofByOrder(input.orderId);
}

export function generateOrderUnlockCode(input: { orderId: string; reportFileName: string }) {
  const existing = findPaymentProofByOrder(input.orderId);
  const nextUnlockCode = buildUnlockCode();
  const nextReportFileName = input.reportFileName || existing?.reportFileName || '未命名报告';

  if (existing) {
    return setUnlockCodeForOrder(input.orderId, nextUnlockCode, nextReportFileName);
  }

  const receiptId = buildReceiptId(input.orderId);
  upsertPaymentProof({
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

  return findPaymentProofByOrder(input.orderId);
}

export async function redeemOrderUnlockCode(orderId: string, code: string) {
  const record = findPaymentProofByOrder(orderId);
  if (!record) return { ok: false as const, reason: 'not_found' as const };
  if (!record.unlockCode?.trim()) return { ok: false as const, reason: 'code_not_generated' as const };
  if (record.redeemedAt) return { ok: false as const, reason: 'already_redeemed' as const };
  if (record.unlockCode !== code.trim()) return { ok: false as const, reason: 'invalid_code' as const };

  const redeemedAt = markUnlockCodeRedeemed(orderId);
  return {
    ok: true as const,
    record: {
      ...record,
      redeemedAt,
    },
  };
}

export function getProofRootPath() {
  return proofRoot;
}

export function getProofDbPath() {
  return getPaywallDbPath();
}

export function getPaymentProofRecordByReceipt(receiptId: string) {
  return findPaymentProofByReceipt(receiptId);
}

export function getPaymentProofRecords() {
  return listPaymentProofs();
}

export function markPaymentProofSent(receiptId: string) {
  const record = findPaymentProofByReceipt(receiptId);
  if (!record) return null;
  const sentAt = markUnlockCodeSent(receiptId);
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

    upsertPaymentProof({
      receiptId: record.receiptId,
      orderId: record.orderId,
      reportFileName: record.reportFileName,
      payerNote: record.payerNote,
      payerContact: record.payerContact,
      originalFileName: record.originalFileName,
      savedFileName: record.savedFileName,
      imagePath: path.join(proofRoot, record.savedFileName),
      transferRef: '',
      unlockCode: record.unlockCode || '',
      uploadedAt: record.uploadedAt,
      redeemedAt: record.redeemedAt || null,
      sentAt: null,
    });

    await unlink(metaPath);
  }
}
