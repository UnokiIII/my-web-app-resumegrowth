import { mkdirSync } from 'fs';
import { existsSync } from 'fs';
import path from 'path';
import { DatabaseSync } from 'node:sqlite';
import { getPaywallDataDir } from './paywall-storage';

const dataDir = getPaywallDataDir();
const dbPath = path.join(dataDir, 'paywall.db');

function ensureDir(dirPath) {
  if (!existsSync(dirPath)) {
    mkdirSync(dirPath, { recursive: true });
  }
}

let dbInstance;

function getDb() {
  if (!dbInstance) {
    ensureDir(dataDir);
    dbInstance = new DatabaseSync(dbPath);
    dbInstance.exec(`
      CREATE TABLE IF NOT EXISTS payment_proofs (
        receipt_id TEXT PRIMARY KEY,
        order_id TEXT NOT NULL,
        report_file_name TEXT,
        payer_note TEXT,
        payer_contact TEXT,
        original_file_name TEXT,
        saved_file_name TEXT,
        image_path TEXT,
        transfer_ref TEXT,
        unlock_code TEXT NOT NULL,
        uploaded_at TEXT NOT NULL,
        redeemed_at TEXT,
        sent_at TEXT
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_proofs_order_id ON payment_proofs(order_id);
    `);
    const columns = dbInstance.prepare(`PRAGMA table_info(payment_proofs)`).all();
    const columnNames = new Set(columns.map((item) => item.name));
    if (!columnNames.has('transfer_ref')) {
      dbInstance.exec(`ALTER TABLE payment_proofs ADD COLUMN transfer_ref TEXT;`);
    }
    if (!columnNames.has('sent_at')) {
      dbInstance.exec(`ALTER TABLE payment_proofs ADD COLUMN sent_at TEXT;`);
    }
    dbInstance.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_proofs_transfer_ref ON payment_proofs(transfer_ref);`);
  }

  return dbInstance;
}

function mapRow(row) {
  if (!row) return null;
  return {
    receiptId: row.receipt_id,
    orderId: row.order_id,
    reportFileName: row.report_file_name,
    payerNote: row.payer_note,
    payerContact: row.payer_contact,
    originalFileName: row.original_file_name,
    savedFileName: row.saved_file_name,
    imagePath: row.image_path,
    transferRef: row.transfer_ref,
    unlockCode: row.unlock_code,
    uploadedAt: row.uploaded_at,
    redeemedAt: row.redeemed_at,
    sentAt: row.sent_at,
  };
}

export function getPaywallDbPath() {
  return dbPath;
}

export function upsertPaymentProof(record) {
  const db = getDb();
  db.prepare(`
    INSERT INTO payment_proofs (
      receipt_id, order_id, report_file_name, payer_note, payer_contact,
      original_file_name, saved_file_name, image_path, transfer_ref, unlock_code, uploaded_at, redeemed_at, sent_at
    ) VALUES (
      @receiptId, @orderId, @reportFileName, @payerNote, @payerContact,
      @originalFileName, @savedFileName, @imagePath, @transferRef, @unlockCode, @uploadedAt, @redeemedAt, @sentAt
    )
    ON CONFLICT(order_id) DO UPDATE SET
      receipt_id = excluded.receipt_id,
      report_file_name = excluded.report_file_name,
      payer_note = excluded.payer_note,
      payer_contact = excluded.payer_contact,
      original_file_name = excluded.original_file_name,
      saved_file_name = excluded.saved_file_name,
      image_path = excluded.image_path,
      transfer_ref = excluded.transfer_ref,
      unlock_code = excluded.unlock_code,
      uploaded_at = excluded.uploaded_at,
      redeemed_at = COALESCE(payment_proofs.redeemed_at, excluded.redeemed_at),
      sent_at = COALESCE(payment_proofs.sent_at, excluded.sent_at)
  `).run(record);
}

export function findPaymentProofByOrder(orderId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM payment_proofs WHERE order_id = ? LIMIT 1`).get(orderId);
  return mapRow(row);
}

export function findPaymentProofByReceipt(receiptId) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM payment_proofs WHERE receipt_id = ? LIMIT 1`).get(receiptId);
  return mapRow(row);
}

export function findPaymentProofByTransferRef(transferRef) {
  const db = getDb();
  const row = db.prepare(`SELECT * FROM payment_proofs WHERE transfer_ref = ? LIMIT 1`).get(transferRef);
  return mapRow(row);
}

export function markUnlockCodeRedeemed(orderId) {
  const db = getDb();
  const redeemedAt = new Date().toISOString();
  db.prepare(`UPDATE payment_proofs SET redeemed_at = ? WHERE order_id = ?`).run(redeemedAt, orderId);
  return redeemedAt;
}

export function markUnlockCodeSent(receiptId) {
  const db = getDb();
  const sentAt = new Date().toISOString();
  db.prepare(`UPDATE payment_proofs SET sent_at = ? WHERE receipt_id = ?`).run(sentAt, receiptId);
  return sentAt;
}

export function setUnlockCodeForOrder(orderId, unlockCode, reportFileName) {
  const db = getDb();
  const existing = findPaymentProofByOrder(orderId);

  if (!existing) {
    return null;
  }

  const uploadedAt = new Date().toISOString();
  const nextReportFileName = reportFileName || existing.reportFileName || '';

  db.prepare(`
    UPDATE payment_proofs
    SET unlock_code = ?,
        report_file_name = ?,
        uploaded_at = ?,
        redeemed_at = NULL,
        sent_at = NULL
    WHERE order_id = ?
  `).run(unlockCode, nextReportFileName, uploadedAt, orderId);

  return findPaymentProofByOrder(orderId);
}

export function listPaymentProofs() {
  const db = getDb();
  const rows = db.prepare(`SELECT * FROM payment_proofs ORDER BY uploaded_at DESC`).all();
  return rows.map(mapRow);
}
