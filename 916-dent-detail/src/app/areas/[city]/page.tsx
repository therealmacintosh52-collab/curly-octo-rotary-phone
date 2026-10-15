import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { CityPage } from '@/components/seo/CityPage';
import { allCities, cityPath, getCity } from '@/lib/seo/content';
import { pageMetadata } from '@/lib/seo/metadata';

export const dynamicParams = false;

export function generateStaticParams() {
  return allCities.map((c) => ({ city: c.slug }));
}

export async function generateMetadata({ params }: { params: Promise<{ city: string }> }): Promise<Metadata> {
  const city = getCity((await params).city);
  if (!city) return {};
  return pageMetadata({ title: city.title, description: city.description, path: cityPath(city.slug), defaultImage: false });
}

export default async function CityRoute({ params }: { params: Promise<{ city: string }> }) {
  const city = getCity((await params).city);
  if (!city) notFound();
  return <CityPage city={city} />;
}
