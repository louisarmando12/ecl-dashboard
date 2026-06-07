import { NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';
import prisma from '@/lib/prisma';
import { put } from '@vercel/blob';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const teams = body.teams as string[];

    if (!Array.isArray(teams)) {
      return NextResponse.json({ error: 'Invalid teams format' }, { status: 400 });
    }

    let settings = await prisma.systemSettings.findFirst();
    if (!settings) {
      settings = await prisma.systemSettings.create({ data: {} });
    }

    let logoUrls: Record<string, string> = {};
    try {
      logoUrls = JSON.parse(settings.logoUrls || '{}');
    } catch (e) {}

    const results = [];

    for (const team of teams) {
      const slug = team.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

      // Check if already in DB
      if (logoUrls[slug]) {
        results.push({ team, status: 'exists', file: logoUrls[slug] });
        continue;
      }

      // Check local FS if not using Blob
      if (!process.env.BLOB_READ_WRITE_TOKEN) {
        const publicDir = path.join(process.cwd(), 'public', 'teams');
        const filePath = path.join(publicDir, `${slug}.png`);
        if (fs.existsSync(filePath)) {
          logoUrls[slug] = `/teams/${slug}.png`;
          results.push({ team, status: 'exists', file: logoUrls[slug] });
          continue;
        }
      }

      let downloadedUrl = '';
      const attemptDownload = async (url: string) => {
        downloadedUrl = await downloadFile(url, slug);
      };

      try {
        // 1. Try restcountries API
        const countryRes = await fetch(`https://restcountries.com/v3.1/name/${encodeURIComponent(team)}`);
        if (countryRes.ok) {
          const countryData = await countryRes.json();
          if (countryData && countryData[0] && countryData[0].cca2) {
            const code = countryData[0].cca2.toLowerCase();
            await attemptDownload(`https://flagcdn.com/w320/${code}.png`);
            logoUrls[slug] = downloadedUrl;
            results.push({ team, status: 'downloaded-country', file: downloadedUrl });
            continue;
          }
        } else if (countryRes.status === 404) {
          const translationRes = await fetch(`https://restcountries.com/v3.1/translation/${encodeURIComponent(team)}`);
          if (translationRes.ok) {
            const translationData = await translationRes.json();
            if (translationData && translationData[0] && translationData[0].cca2) {
              const code = translationData[0].cca2.toLowerCase();
              await attemptDownload(`https://flagcdn.com/w320/${code}.png`);
              logoUrls[slug] = downloadedUrl;
              results.push({ team, status: 'downloaded-country-translation', file: downloadedUrl });
              continue;
            }
          }
        }

        // 2. Try TheSportsDB for clubs
        const sportsRes = await fetch(`https://www.thesportsdb.com/api/v1/json/3/searchteams.php?t=${encodeURIComponent(team)}`);
        if (sportsRes.ok) {
          const sportsData = await sportsRes.json();
          if (sportsData && sportsData.teams && sportsData.teams.length > 0) {
            const teamObj = sportsData.teams.find((t: any) => t.strSport === "Soccer" || t.strSport === "Esports") || sportsData.teams[0];
            if (teamObj.strBadge) {
              await attemptDownload(teamObj.strBadge);
              logoUrls[slug] = downloadedUrl;
              results.push({ team, status: 'downloaded-club', file: downloadedUrl });
              continue;
            }
          }
        }

        // 3. Fallback to UI-Avatars
        await attemptDownload(`https://ui-avatars.com/api/?name=${encodeURIComponent(team)}&background=random&size=320&font-size=0.33`);
        logoUrls[slug] = downloadedUrl;
        results.push({ team, status: 'downloaded-fallback', file: downloadedUrl });
      } catch (e) {
        results.push({ team, status: 'error', message: 'Failed to download logo' });
      }
    }

    // Save mapping to DB
    await prisma.systemSettings.update({
      where: { id: settings.id },
      data: { logoUrls: JSON.stringify(logoUrls) }
    });

    return NextResponse.json({ success: true, results });

  } catch (error: any) {
    console.error('Download Logo Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

async function downloadFile(url: string, slug: string): Promise<string> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch ${url}: ${res.statusText}`);
  const arrayBuffer = await res.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  if (process.env.BLOB_READ_WRITE_TOKEN) {
    const blob = await put(`teams/${slug}.png`, buffer, { 
      access: 'public', 
      addRandomSuffix: false,
      contentType: 'image/png'
    });
    return blob.url;
  } else {
    const publicDir = path.join(process.cwd(), 'public', 'teams');
    if (!fs.existsSync(publicDir)) {
      fs.mkdirSync(publicDir, { recursive: true });
    }
    const dest = path.join(publicDir, `${slug}.png`);
    fs.writeFileSync(dest, buffer);
    return `/teams/${slug}.png`;
  }
}
