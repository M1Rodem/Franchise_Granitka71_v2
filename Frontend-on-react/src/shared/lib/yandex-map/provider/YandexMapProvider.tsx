import type { ReactNode } from 'react';
import { useYandexLoader } from '../hooks/useYandexLoader';

interface Props {
  children: ReactNode;
}

export function YandexMapProvider({ children }: Props) {
  const { isLoaded } = useYandexLoader();

  if (!isLoaded) {
    return null;
  }

  return <>{children}</>;
}