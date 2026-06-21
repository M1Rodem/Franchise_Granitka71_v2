import type { UserRole } from '@/shared/types/auth';

export type AppIconName =
  | 'orders'           // заказы
  | 'create'           // создать
  | 'archive'          // архив
  | 'notifications'    // уведомления
  | 'profile'          // профиль
  | 'admin'            // админ
  | 'eye'              // показать пароль
  | 'eyeOff'           // скрыть пароль
  | 'success'          // успех
  | 'error'            // ошибка
  | 'warning'          // предупреждение
  | 'info'             // информация
  | 'close'            // закрыть
  | 'check'            // галочка
  | 'realtimeConnected'   // соединение установлено
  | 'realtimeDisconnected' // соединение потеряно
  | 'print'            // печать
  | 'download'         // скачать
  | 'excel'            // Excel
  | 'arrowLeft'        // стрелка влево
  | 'arrowRight'      // стрелка вправо
  | 'offlineOrders';

export interface NavigationItem {
  id: string;          
  label: string;      
  path: string;       
  icon: AppIconName;   
  title: string;       
  match: string[];   
  roles?: UserRole[];  
  offlineOnly?: boolean; 
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
    offlineOnly: true,
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
  {
    id: 'offline-orders',
    label: 'Оффлайн заказы',
    path: '/offline-orders',
    icon: 'offlineOrders',
    title: 'Оффлайн заказы',
    match: ['/offline-orders'],
    offlineOnly: true,
  },
];

export const routeTitles: Record<string, string> = {
  '/orders': 'Заказы',
  '/orders/new': 'Создать заказ',
  '/offline-orders': 'Оффлайн заказы',
  '/orders/archived': 'Архив заказов',
  '/notifications': 'Уведомления',
  '/profile': 'Профиль',
  '/admin': 'Админ панель',
  '/users': 'Пользователи',
  '/admin/plots': 'Участки',
};