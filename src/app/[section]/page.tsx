import { notFound } from 'next/navigation';
import App from '@/components/App';
import type { Section } from '@/lib/types';
const sections = ['training', 'puzzles', 'arena', 'analyse', 'akademie', 'fortschritt', 'profil'];
export function generateStaticParams() {
  return sections.map((section) => ({ section }));
}
export const dynamicParams = false;
export default async function Page({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  if (!sections.includes(section)) notFound();
  return <App section={section as Section} />;
}
