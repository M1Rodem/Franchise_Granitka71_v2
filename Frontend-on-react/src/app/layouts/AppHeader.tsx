import { useNavigate, useLocation } from 'react-router-dom';
import { routeTitles } from '@/app/router/navigation.config';
import { resolveRouteTitle } from '@/shared/lib/navigation';
import { useUiStore } from '@/shared/store/ui.store';
import styles from '@/app/layouts/app-header.module.css';
import { cn } from '@/shared/lib/cn'
import { useEffect, useState } from 'react'
import { signalRService } from '@/shared/lib/signalr/signalr.service'
import buttonStyles from '@/shared/ui/button.module.css'

export function AppHeader() {
  const navigate = useNavigate();
  const location = useLocation();

  const openMobileSidebar = useUiStore((state) => state.openMobileSidebar);
  const header = useUiStore((state) => state.header)
  const submitDisabled = header.submitDisabled
  const openPlotCreateModal = useUiStore((state) => state.openPlotCreateModal);

  const defaultTitle = resolveRouteTitle(
    location.pathname,
    routeTitles,
    'Granitka71'
  );

  const [status, setStatus] = useState(
    signalRService.getConnectionStatus()
  )

  const isOrderDetails = header.mode === 'orderDetails';
  const isAdminDetails = header.mode === 'adminDetails';
  const isOrderCreate = header.mode === 'orderCreate';
  const isOrderEdit = header.mode === 'orderEdit';
  const isPlots = header.mode === 'plots'
  const isUsers = header.mode === 'users'

  useEffect(() => {
    const unsub = signalRService.subscribeStatus((s) => {
      setStatus(s)
    })

    return unsub
  }, [])

  return (
    <header className={styles.header}>
      <button
        type="button"
        className={styles.menuButton}
        aria-label="Open menu"
        onClick={openMobileSidebar}
      >
        <span />
        <span />
        <span />
      </button>

      {/* Обычный заголовок */}
      {!isOrderDetails && !isAdminDetails && !isOrderCreate && !isOrderEdit && !isPlots && !isUsers && (
        <h1 className={styles.title}>{defaultTitle}</h1>
      )}

      {/* Режим заказа */}
      {isOrderDetails && (
        <>
          <h1 className={styles.detailsTitle}>
            {header.title} №{header.orderNumber}
          </h1>

          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
          >
            ← Назад
          </button>

          <div className={styles.detailsActions}>
            <button
              type="button"
              className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
              disabled
            >
              Печать
            </button>

            <button
              type="button"
              className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
              disabled
            >
              Excel
            </button>
          </div>
        </>
      )}

      {/* CREATE ORDER MODE */}
      {isOrderCreate && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
          >
            ← Назад
          </button>

          <div className={styles.detailsTitleButtonWrapper}>
            <button
              type="submit"
              form="order-form"
              disabled={submitDisabled}
              className={cn(
                styles.detailsActionTitleButton,
                buttonStyles.btn,
                submitDisabled
                  ? buttonStyles.btnNeutral
                  : buttonStyles.btnSuccess
              )}
            >
              {header.title}
            </button>
          </div>

          <div className={styles.detailsActions} />
        </>
      )}

      {/* EDIT ORDER MODE */}
      {isOrderEdit && (
        <>
          <button
            type="button"
            onClick={() => navigate(-1)}
            className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
          >
            ← Назад
          </button>

          <div className={styles.detailsTitleButtonWrapper}>
            <button
              type="submit"
              form="order-form"
              disabled={submitDisabled}
              className={cn(
                styles.detailsActionTitleButton,
                buttonStyles.btn,
                submitDisabled
                  ? buttonStyles.btnNeutral
                  : buttonStyles.btnSuccess
              )}
            >
              {header.title} №{header.orderNumber}
            </button>
          </div>

          <div className={styles.detailsActions} />
        </>
      )}

      {/* PLOTS */}
      {isPlots && (
        <>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
          >
            ← Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {header.title}
          </h1>

          <div className={styles.detailsActions}>
            <button
              type="button"
              className={cn(
                buttonStyles.btn,
                buttonStyles.btnSuccess
              )}
              onClick={openPlotCreateModal}
            >
              Добавить участок
            </button>
          </div>
        </>
      )}

      {/* USERS */}
      {isUsers && (
        <>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
          >
            ← Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {header.title}
          </h1>

          <div className={styles.detailsActions}>
            <button
              type="button"
              className={cn(
                buttonStyles.btn,
                buttonStyles.btnSuccess
              )}
              onClick={() => {
                useUiStore.getState().openUserCreateModal()
              }}
            >
              Добавить пользователя
            </button>
          </div>
        </>
      )}

      {/* Admin режим (Users / Plots) */}
      {isAdminDetails && (
        <div className={styles.detailsContainer}>
          <button
            type="button"
            onClick={() => navigate('/admin')}
            className={cn(buttonStyles.btn, buttonStyles.btnNeutral)}
          >
            ← Назад
          </button>

          <h1 className={styles.detailsTitle}>
            {defaultTitle}
          </h1>
        </div>
      )}
      
      {/*заглушка*/}
      <div className={styles.realtimeStatus}>
        <span
          title={status}
          onClick={() => {
            if (status !== 'connecting') {
              signalRService.reconnect()
            }
          }}
          className={cn(
            styles.realtimeDot,
            status === 'connected' && styles.connected,
            status === 'connecting' && styles.connecting,
            status === 'disconnected' && styles.disconnected
          )}
        />
      </div>
    </header>
  );
}
