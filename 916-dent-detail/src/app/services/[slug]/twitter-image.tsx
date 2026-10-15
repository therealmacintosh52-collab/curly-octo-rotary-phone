import { notFound } from 'next/navigation';
import { getService } from '@/lib/seo/content';
import { ogContentType, ogSize, renderOg } from '@/lib/seo/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = '916 Dent & Detail service';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getService((await params).slug);
  if (!doc) notFound();
  return renderOg({ eyebrow: doc.term, title: doc.h1 });
}
