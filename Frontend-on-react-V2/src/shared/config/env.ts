const envSource = import.meta.env as Record<string, unknown>;

const getEnvString = (key: string): string | null => {
  const value = envSource[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
};

const apiBaseUrl = getEnvString('VITE_API_BASE_URL') ?? '';

export const env = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL,
  signalRUrl:
    getEnvString('VITE_SIGNALR_URL') ?? `${apiBaseUrl}/api/notificationhub`,
  yandexMapApiKey: getEnvString('VITE_YANDEX_MAP_API_KEY'),
} as const;