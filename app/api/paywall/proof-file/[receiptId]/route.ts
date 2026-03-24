import { readFile } from 'fs/promises';
import path from 'path';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { getPaymentProofRecordByReceipt } from '@/lib/paywall-proof-store';
import { getPaywallAdminCookieName, isValidAdminSessionCookie } from '@/lib/paywall';
import { getSupabaseBucket, getSupabaseServerClient, isSupabaseConfigured } from '@/lib/supabase-server';

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

  const record = await getPaymentProofRecordByReceipt(params.receiptId);
  if (!record?.imagePath) {
    return new NextResponse('Not found', { status: 404 });
  }

  try {
    if (path.isAbsolute(record.imagePath)) {
      const buffer = await readFile(record.imagePath);
      return new NextResponse(buffer, {
        status: 200,
        headers: {
          'Content-Type': inferContentType(record.imagePath),
          'Cache-Control': 'no-store',
        },
      });
    }

    if (!isSupabaseConfigured()) {
      return new NextResponse('Not found', { status: 404 });
    }

    const client = getSupabaseServerClient();
    if (!client) {
      return new NextResponse('Storage unavailable', { status: 500 });
    }

    const { data, error } = await client.storage.from(getSupabaseBucket()).download(record.imagePath);
    if (error || !data) {
      return new NextResponse('Not found', { status: 404 });
    }

    const buffer = Buffer.from(await data.arrayBuffer());
    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': data.type || inferContentType(record.imagePath),
        'Cache-Control': 'no-store',
      },
    });
  } catch {
    return new NextResponse('Not found', { status: 404 });
  }
}
