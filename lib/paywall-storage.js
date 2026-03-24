import os from 'os';
import path from 'path';

function normalizeCustomDir(input) {
  const value = input?.trim();
  return value ? path.resolve(value) : null;
}

export function getPaywallStorageBaseDir() {
  const customDir = normalizeCustomDir(process.env.PAYWALL_STORAGE_DIR);
  if (customDir) {
    return customDir;
  }

  if (process.env.VERCEL) {
    return path.join(os.tmpdir(), 'resumegrowth-paywall');
  }

  return process.cwd();
}

export function getPaywallDataDir() {
  return path.join(getPaywallStorageBaseDir(), 'data');
}

export function getPaywallProofRootDir() {
  return path.join(getPaywallStorageBaseDir(), 'tmp', 'payment-proofs');
}
