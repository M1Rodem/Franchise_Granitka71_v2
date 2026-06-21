import { useState, useEffect } from 'react'
import { FormModal } from '@/shared/ui/modal/FormModal'
import { authApi } from '@/modules/auth/api/auth.api'
import { offlineSyncService } from '@/modules/offline/sync/offline-sync.service'
import { showTempMessage } from '@/shared/ui/temp-message.service'
import styles from './AdminSyncModal.module.css'
import buttons from '@/shared/ui/button.module.css'

type Step = 'login' | 'admin-login' | 'select-employee'

interface Props {
  isOpen: boolean
  onClose(): void
  onSyncSuccess(): Promise<void>
  groupedOrders: Array<{ userId: number; fullName: string; count: number }>
}

export function AdminSyncModal({
  isOpen,
  onClose,
  onSyncSuccess,
  groupedOrders,
}: Props) {
  const [step, setStep] = useState<Step>('login')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [selectedEmployee, setSelectedEmployee] = useState<{ userId: number; fullName: string } | null>(null)

  // Сброс состояния при закрытии
  useEffect(() => {
    if (!isOpen) {
      setStep('login')
      setUsername('')
      setPassword('')
      setSelectedEmployee(null)
      setLoading(false)
    }
  }, [isOpen])

  // Шаг 1: Обычная синхронизация (синхронизирует заказы введенного пользователя)
  const handleNormalSync = async () => {
    if (!username.trim() || !password.trim()) {
      showTempMessage('error', 'Введите логин и пароль')
      return
    }

    setLoading(true)
    try {
      const response = await authApi.login({ username, password })
      
      // Синхронизируем заказы этого пользователя
      const results = await offlineSyncService.syncUserOrders(response.id, response.token)
      
      if (results.failed === 0) {
        showTempMessage('success', `Синхронизировано ${results.success} заказов`)
      } else {
        showTempMessage('warning', `Синхронизировано ${results.success} из ${results.total}. Ошибок: ${results.failed}`)
      }
      
      await onSyncSuccess()
      onClose()
    } catch (e) {
      showTempMessage('error', 'Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  // Шаг 2: Проверка прав администратора
  const handleAdminLogin = async () => {
    if (!username.trim() || !password.trim()) {
      showTempMessage('error', 'Введите логин и пароль')
      return
    }

    setLoading(true)
    try {
      const response = await authApi.login({ username, password })
      
      // Проверка роли администратора
      const isAdmin = response.role === 'Admin' || response.role === 'SuperAdmin'
      
      if (!isAdmin) {
        showTempMessage('error', 'Для этого действия требуются права администратора')
        setLoading(false)
        return
      }
      
      // Переход к выбору сотрудника
      setStep('select-employee')
    } catch (e) {
      showTempMessage('error', 'Неверный логин или пароль')
    } finally {
      setLoading(false)
    }
  }

  // Шаг 3: Синхронизация заказов выбранного сотрудника
  const handleSyncEmployeeOrders = async () => {
    if (!selectedEmployee) {
      showTempMessage('error', 'Выберите сотрудника')
      return
    }

    setLoading(true)
    try {
      // Вход под админом для получения токена
      const response = await authApi.login({ username, password })
      
      const results = await offlineSyncService.syncUserOrders(selectedEmployee.userId, response.token)
      
      if (results.failed === 0) {
        showTempMessage('success', `Синхронизировано ${results.success} заказов сотрудника ${selectedEmployee.fullName}`)
      } else {
        showTempMessage('warning', `Синхронизировано ${results.success} из ${results.total}. Ошибок: ${results.failed}`)
      }
      
      await onSyncSuccess()
      onClose()
    } catch (e) {
      showTempMessage('error', 'Ошибка при синхронизации')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    setStep('login')
    setUsername('')
    setPassword('')
    setSelectedEmployee(null)
  }

  // Рендер шага 1: Обычная синхронизация
  const renderLoginStep = () => (
    <div className={styles.content}>
      <p className={styles.headerText}>
        Введите данные сотрудника для синхронизации заказов
      </p>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Логин</span>
          <input
            autoComplete="username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Пароль</span>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
    </div>
  )

  // Рендер шага 2: Вход для администрации
  const renderAdminLoginStep = () => (
    <div className={styles.content}>
      <p className={styles.headerText}>
        Вход с правами администратора
      </p>

      <div className={styles.form}>
        <label className={styles.field}>
          <span>Логин администратора</span>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </label>

        <label className={styles.field}>
          <span>Пароль</span>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </label>
      </div>
    </div>
  )

  // Рендер шага 3: Выбор сотрудника
  const renderSelectEmployeeStep = () => (
    <div className={styles.content}>
      <p className={styles.headerText}>
        Выберите сотрудника для синхронизации
      </p>

      <div className={styles.employeeList}>
        {groupedOrders.map((group) => (
          <button
            type="button"
            key={group.userId}
            onClick={() =>
              setSelectedEmployee({
                userId: group.userId,
                fullName: group.fullName,
              })
            }
            className={`${styles.employeeCard} ${
              selectedEmployee?.userId === group.userId
                ? styles.employeeCardSelected
                : ''
            }`}
          >
            <div className={styles.employeeInfo}>
              <span className={styles.employeeName}>
                {group.fullName}
              </span>
            </div>

            <span className={styles.employeeCount}>
              {group.count} заказ(ов)
            </span>
            </button>
        ))}
      </div>
    </div>
  )

  // Определяем заголовок и кнопки
  const getTitle = () => {
    switch (step) {
      case 'login':
        return 'Синхронизация заказов'

      case 'admin-login':
        return 'Вход администратора'

      case 'select-employee':
        return 'Выбор сотрудника'
    }
  }

  const getFooter = () => {
    switch (step) {
      case 'login':
        return (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`${buttons.btn} ${buttons.btnSecondary}`}
            >
              Отмена
            </button>

            <button
              type="button"
              onClick={() => setStep('admin-login')}
              className={`${buttons.btn} ${buttons.btnWarning}`}
            >
              Для администрации
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={handleNormalSync}
              className={`${buttons.btn} ${buttons.btnPrimary}`}
            >
              {loading ? 'Синхронизация...' : 'Синхронизировать'}
            </button>
          </>
        )
      
      case 'admin-login':
        return (
          <>
            <button
              type="button"
              onClick={onClose}
              className={`${buttons.btn} ${buttons.btnSecondary}`}
            >
              Отмена
            </button>
            <button
              type="button"
              onClick={() => setStep('login')}
              className={`${buttons.btn} ${buttons.btnSecondary}`}
            > Назад
            </button>
            <button
              type="button"
              disabled={loading}
              onClick={handleAdminLogin}
              className={`${buttons.btn} ${buttons.btnPrimary}`}
            >
              {loading ? 'Вход...' : 'Продолжить'}
            </button>
          </>
        )
      
      case 'select-employee':
        return (
          <>
            <button
              type="button"
              onClick={handleBack}
              className={`${buttons.btn} ${buttons.btnSecondary}`}
            >
              Назад
            </button>

            <button
              type="button"
              onClick={onClose}
              className={`${buttons.btn} ${buttons.btnSecondary}`}
            >
              Отмена
            </button>

            <button
              type="button"
              disabled={loading || !selectedEmployee}
              onClick={handleSyncEmployeeOrders}
              className={`${buttons.btn} ${buttons.btnSuccess}`}
            >
              {loading ? 'Синхронизация...' : 'Синхронизировать'}
            </button>
          </>
        )
    }
  }

  const renderContent = () => {
    switch (step) {
      case 'login': return renderLoginStep()
      case 'admin-login': return renderAdminLoginStep()
      case 'select-employee': return renderSelectEmployeeStep()
    }
  }

  return (
    <FormModal
      isOpen={isOpen}
      title={getTitle()}
      onClose={onClose}
      footer={getFooter()}
    >
      {renderContent()}
    </FormModal>
  )
}