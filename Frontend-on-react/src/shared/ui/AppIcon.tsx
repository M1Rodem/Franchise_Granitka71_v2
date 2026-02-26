import type { AppIconName } from '@/app/router/navigation.config';

interface AppIconProps {
  name: AppIconName;
  className?: string;
}

export function AppIcon({ name, className }: AppIconProps) {
  switch (name) {
    case 'orders':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M5 6h14M5 12h14M5 18h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'create':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      );
    case 'archive':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M4 7h16v3H4zM6 10h12v9H6z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'notifications':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="M12 4a5 5 0 0 0-5 5v3.5L5 15v1h14v-1l-2-2.5V9a5 5 0 0 0-5-5Z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    case 'profile':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="8" r="3.2" stroke="currentColor" strokeWidth="1.6" />
          <path d="M5.5 19a6.5 6.5 0 0 1 13 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'admin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path d="m12 3 8 4v5c0 4.8-3.2 7.8-8 9-4.8-1.2-8-4.2-8-9V7l8-4Z" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );
    default:
      return null;
  }
}