import { Suspense, lazy } from 'react'
import { Navigate, createBrowserRouter, RouterProvider } from 'react-router-dom'
import { OrderBlockingGuard } from '@/modules/orders/components/OrderBlockingGuard'
import { AnimatePresence } from 'framer-motion'

import { AppLayout } from '@/app/layouts/AppLayout'
import { AuthLayout } from '@/app/layouts/AuthLayout'
import { RequireAuth, RequireRole } from '@/app/router/guards'
import { RootLayout } from './root-layout'

import CreateOrderPage from '@/modules/orders/pages/create-order.page'
import OfflineOrdersPage from '@/modules/offline/pages/offline-orders.page'
import OfflineOrderDetailsPage from '@/modules/offline/pages/offline-order-details.page'

// Ленивая загрузка для остальных страниц
const LoginPage = lazy(() => import('@/modules/auth/pages/login.page'))
const OrdersListPage = lazy(() => import('@/modules/orders/pages/orders-list.page'))
const OrderDetailsPage = lazy(() => import('@/modules/orders/pages/order-details.page'))
const ArchivedOrdersPage = lazy(() => import('@/modules/orders/pages/archived-orders.page'))
const NotificationsPage = lazy(() => import('@/modules/notifications/pages/notifications.page'))
const ProfilePage = lazy(() => import('@/modules/profile/pages/profile.page'))
const AdminPage = lazy(() => import('@/modules/users/pages/admin.page'))
const UsersPage = lazy(() => import('@/modules/users/pages/users.page'))
const PlotsPage = lazy(() => import('@/modules/plots/pages/plots.page'))
const EditOrderPage = lazy(() => import('@/modules/orders/pages/edit-order.page'))
const ArchivedOrderDetailsPage = lazy(
  () => import('@/modules/orders/pages/archived-order-details.page')
)
const ManagerFinancePage = lazy(
  () => import('@/modules/reports/pages/manager-finance.page')
)

// Компонент загрузки с анимацией
function RouterFallback() {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        background: 'linear-gradient(135deg, #030e1f 0%, #0a1a38 45%, #0e2a4f 100%)',
      }}
    >
      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, rgba(90,140,220,0.3), rgba(60,110,200,0.2))',
          border: '1px solid rgba(126,164,220,0.4)',
          backdropFilter: 'blur(20px)',
          animation: 'pulse 1.2s ease-in-out infinite',
        }}
      />
      <style>{`
        @keyframes pulse {
          0%, 100% {
            transform: scale(1);
            opacity: 0.5;
          }
          50% {
            transform: scale(1.1);
            opacity: 1;
            box-shadow: 0 0 20px rgba(90,140,220,0.5);
          }
        }
      `}</style>
    </div>
  )
}

// Обертка для страниц с анимацией загрузки
function PageWrapper({ children }: { children: React.ReactNode }) {
  return (
    <AnimatePresence mode="wait">
      <Suspense fallback={<RouterFallback />}>
        {children}
      </Suspense>
    </AnimatePresence>
  )
}

const router = createBrowserRouter([
  {
    element: <RootLayout />,
    children: [
      {
        path: '/login',
        element: (
          <AuthLayout>
            <PageWrapper>
              <LoginPage />
            </PageWrapper>
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
                  <PageWrapper>
                    <OrdersListPage />
                  </PageWrapper>
                ),
              },
              {
                path: '/orders/new',
                element: (
                  <OrderBlockingGuard>
                    <CreateOrderPage />
                  </OrderBlockingGuard>
                ),
              },
              {
                path: '/offline-orders',
                element: (
                  <OfflineOrdersPage />
                ),
              },
              {
                path: '/offline-orders/:localId',
                element: <OfflineOrderDetailsPage />,
              },
              {
                path: '/orders/:id/edit',
                element: (
                  <OrderBlockingGuard>
                    <PageWrapper>
                      <EditOrderPage />
                    </PageWrapper>
                  </OrderBlockingGuard>
                ),
              },
              {
                path: '/orders/:id',
                element: (
                  <PageWrapper>
                    <OrderDetailsPage />
                  </PageWrapper>
                ),
              },
              {
                path: '/orders/archived',
                element: (
                  <PageWrapper>
                    <ArchivedOrdersPage />
                  </PageWrapper>
                ),
              },
              {
                path: '/orders/archived/:id',
                element: (
                  <PageWrapper>
                    <ArchivedOrderDetailsPage />
                  </PageWrapper>
                ),
              },
              {
                path: '/notifications',
                element: (
                  <PageWrapper>
                    <NotificationsPage />
                  </PageWrapper>
                ),
              },
              {
                path: '/profile',
                element: (
                  <PageWrapper>
                    <ProfilePage />
                  </PageWrapper>
                ),
              },
              {
                element: <RequireRole roles={['Admin', 'SuperAdmin']} />,
                children: [
                  {
                    path: '/admin',
                    element: (
                      <PageWrapper>
                        <AdminPage />
                      </PageWrapper>
                    ),
                  },
                  {
                    path: '/users',
                    element: (
                      <PageWrapper>
                        <UsersPage />
                      </PageWrapper>
                    ),
                  },
                ],
              },
              {
                element: <RequireRole roles={['SuperAdmin']} />,
                children: [
                  {
                    path: '/admin/plots',
                    element: (
                      <PageWrapper>
                        <PlotsPage />
                      </PageWrapper>
                    ),
                  },

                  {
                    path: '/admin/manager-finance',
                    element: (
                      <PageWrapper>
                        <ManagerFinancePage />
                      </PageWrapper>
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
    ],
  },
])

export function AppRouter() {
  return (
    <RouterProvider
      router={router}
      future={{
        v7_startTransition: true,
      }}
    />
  )
}
