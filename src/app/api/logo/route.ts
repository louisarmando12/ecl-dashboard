import { NextResponse } from 'next/server';
import prisma from '@/lib/prisma';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const team = searchParams.get('team');
  
  if (!team) {
    return new NextResponse('Missing team parameter', { status: 400 });
  }

  const slug = team.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
  let logoUrl = `/teams/${slug}.png`;

  if (process.env.BLOB_READ_WRITE_TOKEN) {
    try {
      const settings = await prisma.systemSettings.findFirst();
      if (settings && settings.logoUrls) {
        const logoUrls = JSON.parse(settings.logoUrls);
        if (logoUrls[slug]) {
          logoUrl = logoUrls[slug];
        }
      }
    } catch (e) {
      console.error('Error fetching logo URL from DB:', e);
    }
  }

  return NextResponse.redirect(new URL(logoUrl, req.url), {
    status: 302,
    headers: {
      'Cache-Control': 'public, max-age=86400, stale-while-revalidate=86400',
    },
  });
}
