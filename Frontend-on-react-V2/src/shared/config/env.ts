const envSource = import.meta.env as Record<string, unknown>;

const getEnvString = (key: string): string | null => {
  const value = envSource[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const apiBaseUrl = '/api';

export const env = {
  apiBaseUrl,
  signalRUrl: `${apiBaseUrl}/notificationhub`,
  yandexMapApiKey: getEnvString('VITE_YANDEX_MAP_API_KEY'),
} as const;