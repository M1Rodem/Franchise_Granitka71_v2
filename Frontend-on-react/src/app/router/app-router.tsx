import { Suspense, lazy } from 'react';
import { Navigate, useRoutes } from 'react-router-dom';
import { AppLayout } from '@/app/layouts/AppLayout';
import { AuthLayout } from '@/app/layouts/AuthLayout';
import { RequireAuth, RequireRole } from '@/app/router/guards';

const LoginPage = lazy(() => import('@/modules/auth/pages/login.page'));
const OrdersListPage = lazy(() => import('@/modules/orders/pages/orders-list.page'));
const OrderDetailsPage = lazy(() => import('@/modules/orders/pages/order-details.page'));
const CreateOrderPage = lazy(() => import('@/modules/orders/pages/create-order.page'));
const ArchivedOrdersPage = lazy(() => import('@/modules/orders/pages/archived-orders.page'));
const NotificationsPage = lazy(() => import('@/modules/notifications/pages/notifications.page'));
const ProfilePage = lazy(() => import('@/modules/profile/pages/profile.page'));
const AdminPage = lazy(() => import('@/modules/users/pages/admin.page'));
const UsersPage = lazy(() => import('@/modules/users/pages/users.page'));
const PlotsPage = lazy(() => import('@/modules/plots/pages/plots.page'));

function RouterFallback() {
  return <div className="screen-loader">Загрузка...</div>;
}

export function AppRouter() {
  const element = useRoutes([
    {
      path: '/login',
      element: (
        <AuthLayout>
          <Suspense fallback={<RouterFallback />}>
            <LoginPage />
          </Suspense>
        </AuthLayout>
      ),
    },
    {
      element: <RequireAuth />,
      children: [
        {
          element: <AppLayout />,
          children: [
            {
              path: '/orders',
              element: (
                <Suspense fallback={<RouterFallback />}>
                  <OrdersListPage />
                </Suspense>
              ),
            },
            {
              path: '/orders/new',
              element: (
                <Suspense fallback={<RouterFallback />}>
                  <CreateOrderPage />
                </Suspense>
              ),
            },
            {
              path: '/orders/:id',
              element: (
                <Suspense fallback={<RouterFallback />}>
                  <OrderDetailsPage />
                </Suspense>
              ),
            },
            {
              path: '/orders/archived',
              element: (
                <Suspense fallback={<RouterFallback />}>
                  <ArchivedOrdersPage />
                </Suspense>
              ),
            },
            {
              path: '/notifications',
              element: (
                <Suspense fallback={<RouterFallback />}>
                  <NotificationsPage />
                </Suspense>
              ),
            },
            {
              path: '/profile',
              element: (
                <Suspense fallback={<RouterFallback />}>
                  <ProfilePage />
                </Suspense>
              ),
            },
            {
              element: <RequireRole roles={['Admin', 'SuperAdmin']} />,
              children: [
                {
                  path: '/admin',
                  element: (
                    <Suspense fallback={<RouterFallback />}>
                      <AdminPage />
                    </Suspense>
                  ),
                },
                {
                  path: '/users',
                  element: (
                    <Suspense fallback={<RouterFallback />}>
                      <UsersPage />
                    </Suspense>
                  ),
                },
                {
                  path: '/admin/plots',
                  element: (
                    <Suspense fallback={<RouterFallback />}>
                      <PlotsPage />
                    </Suspense>
                  ),
                },
              ],
            },
          ],
        },
      ],
    },
    { path: '/', element: <Navigate to="/orders" replace /> },
    { path: '*', element: <Navigate to="/orders" replace /> },
  ]);

  return element;
}
