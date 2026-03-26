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
    case 'eye':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M2 12s4-6 10-6 10 6 10 6-4 6-10 6-10-6-10-6Z"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="1.6" />
        </svg>
      );

    case 'eyeOff':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M3 3 21 21"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <path
            d="M10.5 6.5C11 6.4 11.5 6.3 12 6.3c6 0 10 5.7 10 5.7-.6.9-1.5 2.1-2.7 3.2M6.6 6.6C4.6 8 3.3 10 2 12c0 0 4 6 10 6 1.3 0 2.5-.3 3.6-.7"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
        </svg>
      );
    case 'success':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M8 12.5 10.8 15 16 9.5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'error':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <path
            d="M9 9 15 15M15 9 9 15"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'warning':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 4 21 19H3L12 4Z"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinejoin="round"
          />
          <path
            d="M12 9v4"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
          <circle cx="12" cy="16.5" r="1" fill="currentColor" />
        </svg>
      )
    case 'info':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6" />
          <circle cx="12" cy="8" r="1.2" fill="currentColor" />
          <path
            d="M12 11v5"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'close':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M18 6 6 18M6 6l12 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )

    case 'check':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M20 6 9 17 4 12"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      )
    case 'realtimeConnected':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
          <circle cx="12" cy="12" r="4" fill="currentColor"/>
        </svg>
      )

    case 'realtimeDisconnected':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.6"/>
          <path d="M8 8l8 8M16 8l-8 8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
        </svg>
      )
    case 'print':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M7 8V4h10v4M7 17v3h10v-3"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
          />
          <rect
            x="5"
            y="8"
            width="14"
            height="9"
            rx="2"
            stroke="currentColor"
            strokeWidth="1.6"
          />
          <circle cx="17" cy="12" r="1" fill="currentColor" />
        </svg>
      )
    case 'download':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <polyline
            points="7 10 12 15 17 10"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <line
            x1="12"
            y1="15"
            x2="12"
            y2="3"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'excel':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="none">
          <rect x="4" y="3" width="16" height="18" rx="2" stroke="currentColor" strokeWidth="1.6"/>
          <path
            d="M8 9l3 3-3 3M16 9l-3 3 3 3"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
          />
        </svg>
      )
    case 'arrowLeft':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M15 6l-6 6 6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M9 12h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )
    case 'arrowRight':
      return (
        <svg
          className={className}
          viewBox="0 0 24 24"
          fill="none"
          aria-hidden="true"
        >
          <path
            d="M9 6l6 6-6 6"
            stroke="currentColor"
            strokeWidth="1.8"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d="M5 12h10"
            stroke="currentColor"
            strokeWidth="1.6"
            strokeLinecap="round"
            opacity="0.7"
          />
        </svg>
      )
    default:
      return null;
  }
}