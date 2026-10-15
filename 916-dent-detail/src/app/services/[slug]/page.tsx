import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { ServicePage } from '@/components/seo/ServicePage';
import { allServices, getService, servicePath } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return allServices.map((s) => ({ slug: s.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const doc = getService((await params).slug);
  if (!doc) return {};
  return pageMetadata({ title: doc.title, description: doc.description, path: servicePath(doc.slug), defaultImage: false });
}

export default async function ServiceRoute({ params }: { params: Promise<{ slug: string }> }) {
  const doc = getService((await params).slug);
  if (!doc) notFound();
  return <ServicePage doc={doc} />;
}
