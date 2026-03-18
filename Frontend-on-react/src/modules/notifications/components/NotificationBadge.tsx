import { useNotificationBadgeStore } from '../store/notification-badge.store';
import { AppIcon } from '@/shared/ui/AppIcon';
import styles from './NotificationBadge.module.css';

interface NotificationBadgeProps {
  onClick?: () => void;
  className?: string;
}

export function NotificationBadge({ onClick, className }: NotificationBadgeProps) {
  const { unreadCount, isRealtimeConnected, getBadgeVariant } = useNotificationBadgeStore();
  
  const variant = getBadgeVariant();
  
  return (
    <button 
      className={`${styles.badge} ${styles[variant]} ${className || ''}`}
      onClick={onClick}
      title={isRealtimeConnected ? 'Real-time connected' : 'Real-time disconnected'}
    >
      <AppIcon 
        name={isRealtimeConnected ? 'realtimeConnected' : 'realtimeDisconnected'} 
        size={16} 
      />
      
      {unreadCount > 0 && (
        <span className={styles.count}>
          {unreadCount > 99 ? '99+' : unreadCount}
        </span>
      )}
    </button>
  );
}