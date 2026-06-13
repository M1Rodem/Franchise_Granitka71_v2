import { useState, useEffect } from 'react'
import { FormModal } from '@/shared/ui/modal/FormModal'
import { offlineEmployeesService } from '@/modules/offline/services/offline-employees.service'
import type { CachedEmployee } from '@/modules/offline/types/offline-employees.types'
import { useOfflineSessionStore } from '@/modules/offline/store/offline-session.store'

import styles from './employee-select-modal.module.css'

interface Props {
  isOpen: boolean
  onClose: () => void
  onEmployeeSelected?: (employee: CachedEmployee) => void
}

export function EmployeeSelectModal({
  isOpen,
  onClose,
  onEmployeeSelected,
}: Props) {
  const [employees, setEmployees] = useState<CachedEmployee[]>([])
  const [isLoading, setIsLoading] = useState(true)

  const setCurrentEmployee =
    useOfflineSessionStore((s) => s.setCurrentEmployee)

  useEffect(() => {
    if (!isOpen) return

    const loadEmployees = async () => {
      setIsLoading(true)

      try {
        const cached =
          await offlineEmployeesService.getCachedEmployees()

        setEmployees(cached)
      } catch (error) {
        console.error(
          'Failed to load employees:',
          error
        )
      } finally {
        setIsLoading(false)
      }
    }

    void loadEmployees()
  }, [isOpen])

  const handleSelect = (
    employee: CachedEmployee
  ) => {
    setCurrentEmployee(employee)

    onEmployeeSelected?.(employee)

    onClose()
  }

  return (
    <FormModal
      isOpen={isOpen}
      title="Работа без подключения"
      onClose={onClose}
      footer={null}
    >
      {isLoading ? (
        <div className={styles.stateBlock}>
          <p className={styles.stateText}>
            Загрузка списка сотрудников...
          </p>
        </div>
      ) : employees.length === 0 ? (
        <div className={styles.stateBlock}>
          <h3 className={styles.stateTitle}>
            Нет доступных сотрудников
          </h3>

          <p className={styles.stateText}>
            Для работы без интернета необходимо хотя бы
            один раз авторизоваться при наличии сети.
          </p>

          <p className={styles.stateText}>
            Создание заказов недоступно.
          </p>
        </div>
      ) : (
        <div className={styles.content}>
          <div className={styles.header}>
            <h2 className={styles.title}>
              Выберите сотрудника
            </h2>

            <p className={styles.description}>
              От имени выбранного сотрудника будут
              создаваться оффлайн заказы до восстановления
              подключения к интернету.
            </p>
          </div>

          <div className={styles.employeeList}>
            {employees.map((emp) => (
              <button
                key={emp.id}
                type="button"
                onClick={() => handleSelect(emp)}
                className={styles.employeeRow}
              >
                <div className={styles.employeeInfo}>
                  <span className={styles.employeeName}>
                    {emp.fullName}
                  </span>

                  <span className={styles.employeeUsername}>
                    @{emp.username}
                  </span>
                </div>
              </button>
            ))}
          </div>
          <p className={styles.description}>
            Если вас нет в списке. Пожалуйста, авторизируйтесь с интернетом для прогрузки пользователей.
          </p>
        </div>
      )}
    </FormModal>
  )
}