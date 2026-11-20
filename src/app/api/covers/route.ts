// Lists whatever cover images are sitting in /public/covers, so the login
// page always has today's full set to pick from -- just drop a new image
// file in that folder and it shows up here automatically, no code change.
import { NextResponse } from 'next/server';
import { readdir } from 'fs/promises';
import path from 'path';

export async function GET() {
  const dir = path.join(process.cwd(), 'public', 'covers');
  try {
    const files = await readdir(dir);
    const images = files.filter(f => /\.(png|jpe?g|webp)$/i.test(f)).sort();
    return NextResponse.json({ covers: images.map(f => `/covers/${f}`) });
  } catch {
    return NextResponse.json({ covers: [] });
  }
}
