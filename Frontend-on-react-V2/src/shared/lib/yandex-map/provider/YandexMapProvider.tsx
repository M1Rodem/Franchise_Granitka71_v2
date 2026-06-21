import type { ReactNode } from 'react';
import { useYandexLoader } from '../hooks/useYandexLoader';

interface Props {
  children: ReactNode;
}

export function YandexMapProvider({ children }: Props) {
  const { isLoaded } = useYandexLoader();

  if (!isLoaded) {
    return (
      <div style={{
        width: '100%',
        height: '100%',
        minHeight: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(8, 19, 31, 0.4)',
        borderRadius: '12px',
        color: '#8fa4bd'
      }}>
        Загрузка карты...
      </div>
    );
  }

  return <>{children}</>;
}