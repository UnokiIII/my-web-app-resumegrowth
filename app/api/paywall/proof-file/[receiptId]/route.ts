import { readFile } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPaymentProofRecordByReceipt } from '@/lib/paywall-proof-store';
import { getPaywallAdminCookieName, isValidAdminSessionCookie } from '@/lib/paywall';

function inferContentType(filePath: string) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
}

export async function GET(_: Request, { params }: { params: { receiptId: string } }) {
  const cookieStore = await cookies();
  const adminCookie = cookieStore.get(getPaywallAdminCookieName())?.value;
  if (!isValidAdminSessionCookie(adminCookie)) {
    return new NextResponse('Unauthorized', { status: 401 });
  }

  const record = getPaymentProofRecordByReceipt(params.receiptId);
  if (!record?.imagePath) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    const buffer = await readFile(record.imagePath);
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': inferContentType(record.imagePath),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
