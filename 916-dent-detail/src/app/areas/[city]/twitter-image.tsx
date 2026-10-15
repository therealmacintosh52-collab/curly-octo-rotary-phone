import { notFound } from 'next/navigation';
import { getCity } from '@/lib/seo/content';
import { ogContentType, ogSize, renderOg } from '@/lib/seo/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = '916 Dent & Detail service area';

export default async function Image({ params }: { params: Promise<{ city: string }> }) {
  const city = getCity((await params).city);
  if (!city) notFound();
  return renderOg({ eyebrow: `${city.name}, CA`, title: city.h1 });
}
