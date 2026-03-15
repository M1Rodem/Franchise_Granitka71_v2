import type { UserRole } from '@/shared/types/auth';

export type AppIconName =
  | 'orders'
  | 'create'
  | 'archive'
  | 'notifications'
  | 'profile'
  | 'admin'
  | 'eye'
  | 'eyeOff'
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'close'
  | 'check'
  | 'realtimeConnected'
  | 'realtimeDisconnected';

export interface NavigationItem {
  id: string;
  label: string;
  path: string;
  icon: AppIconName;
  title: string;
  match: string[];
  roles?: UserRole[];
}

export const navigationConfig: NavigationItem[] = [
  {
    id: 'orders',
    label: 'Заказы',
    path: '/orders',
    icon: 'orders',
    title: 'Заказы',
    match: ['/orders', '/orders/:id'],
  },
  {
    id: 'orders-create',
    label: 'Создать заказ',
    path: '/orders/new',
    icon: 'create',
    title: 'Создать заказ',
    match: ['/orders/new'],
  },
  {
    id: 'orders-archived',
    label: 'Архив',
    path: '/orders/archived',
    icon: 'archive',
    title: 'Архив заказов',
    match: ['/orders/archived'],
  },
  {
    id: 'notifications',
    label: 'Уведомления',
    path: '/notifications',
    icon: 'notifications',
    title: 'Уведомления',
    match: ['/notifications'],
  },
  {
    id: 'profile',
    label: 'Профиль',
    path: '/profile',
    icon: 'profile',
    title: 'Профиль',
    match: ['/profile'],
  },
  {
    id: 'admin',
    label: 'Админ панель',
    path: '/admin',
    icon: 'admin',
    title: 'Админ панель',
    match: ['/admin', '/users', '/admin/plots'],
    roles: ['Admin', 'SuperAdmin'],
  },
];

export const routeTitles: Record<string, string> = {
  '/orders': 'Заказы',
  '/orders/new': 'Создать заказ',
  '/orders/archived': 'Архив заказов',
  '/notifications': 'Уведомления',
  '/profile': 'Профиль',
  '/admin': 'Админ панель',
  '/users': 'Пользователи',
  '/admin/plots': 'Участки',
};
