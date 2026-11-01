'use client';
import type { Section } from '@/lib/types';
import Provider from './Provider';
import Shell from './Shell';
import { Home, Training, Progress } from './Overview';
import dynamic from 'next/dynamic';
import { Loading } from './Common';
const Puzzles = dynamic(() => import('./Puzzles'), { loading: () => <Loading /> });
const Arena = dynamic(() => import('./Arena'), { loading: () => <Loading /> });
const Analysis = dynamic(() => import('./Analysis'), { loading: () => <Loading /> });
const Academy = dynamic(() => import('./Academy'), { loading: () => <Loading /> });
const Profile = dynamic(() => import('./Profile'), { loading: () => <Loading /> });
export default function App({ section }: { section: Section }) {
  return (
    <Provider>
      <Shell section={section}>
        {section === 'start' ? (
          <Home />
        ) : section === 'training' ? (
          <Training />
        ) : section === 'puzzles' ? (
          <Puzzles />
        ) : section === 'arena' ? (
          <Arena />
        ) : section === 'analyse' ? (
          <Analysis />
        ) : section === 'akademie' ? (
          <Academy />
        ) : section === 'fortschritt' ? (
          <Progress />
        ) : (
          <Profile />
        )}
      </Shell>
    </Provider>
  );
}
