import { notFound } from 'next/navigation';
import { getPost } from '@/lib/seo/blog';
import { ogContentType, ogSize, renderOg } from '@/lib/seo/og';

export const size = ogSize;
export const contentType = ogContentType;
export const alt = '916 Dent & Detail blog';

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const post = getPost((await params).slug);
  if (!post) notFound();
  return renderOg({ eyebrow: 'Blog', title: post.meta.title });
}
