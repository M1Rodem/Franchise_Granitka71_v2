import { motion } from 'framer-motion'
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useOfflineSessionStore } from '../store/offline-session.store'
import { offlineEmployeesService } from '../services/offline-employees.service'
import { useConnectivity } from '../hooks/use-connectivity'
import { useAuthStore } from '@/shared/store/auth.store'
import surface from '@/shared/ui/surface.module.css'
import button from '@/shared/ui/button.module.css'
import styles from './offline-login.module.css'
import type { CachedEmployee } from '@/modules/offline/types/offline-employees.types'

export default function OfflineLoginPage() {
  const navigate = useNavigate()
  const { isOnline } = useConnectivity()
  const { currentEmployee, setCurrentEmployee } = useOfflineSessionStore()
  const setOfflineSession = useAuthStore((state) => state.setOfflineSession)
  
  const [employees, setEmployees] = useState<CachedEmployee[]>([])
  const [selectedEmployee, setSelectedEmployee] = useState<CachedEmployee | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (isOnline) {
      navigate('/login', { replace: true })
    }
  }, [isOnline, navigate])

  useEffect(() => {
    const loadEmployees = async () => {
      const cached = await offlineEmployeesService.getCachedEmployees()
      setEmployees(cached)
      setIsLoading(false)

      if (currentEmployee) {
        setSelectedEmployee(currentEmployee)
      }
    }
    loadEmployees()
  }, [])

  const handleContinue = () => {
    if (selectedEmployee) {
      // Сохраняем оффлайн-сессию
      setOfflineSession({
        id: selectedEmployee.id,
        username: selectedEmployee.username,
        fullName: selectedEmployee.fullName,
        role: 'Manager',
      })
      setCurrentEmployee(selectedEmployee)
      navigate('/offline-orders', { replace: true })
    }
  }

  if (!isLoading && employees.length === 0) {
    return (
      <motion.section
        className={`${surface.surface}`}
        initial={{ opacity: 0, y: 14 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
      >
        <div className={styles.header}>
          <p className={styles.kicker}>Granitka71</p>
          <h1>Требуется интернет</h1>
          <p>
            Для работы без интернета необходимо хотя бы один раз войти в систему при наличии сети.
          </p>
        </div>

        <button
          className={`${button.btn} ${button.btnPrimary} ${styles.submit}`}
          onClick={() => window.location.reload()}
        >
          Проверить соединение
        </button>
      </motion.section>
    )
  }

  return (
    <motion.section
      className={`${surface.surface}`}
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: 'easeOut' }}
    >
      <div className={styles.header}>
        <p className={styles.kicker}>Granitka71</p>
        <h1>Работа без интернета</h1>
        <p>Выберите сотрудника для продолжения работы</p>
      </div>

      <div className={styles.employeeList}>
        {employees.map((emp) => (
          <button
            key={emp.id}
            className={`${styles.employeeButton} ${selectedEmployee?.id === emp.id ? styles.employeeButtonActive : ''}`}
            onClick={() => setSelectedEmployee(emp)}
          >
            <span className={styles.employeeName}>{emp.fullName}</span>
            <span className={styles.employeeUsername}>@{emp.username}</span>
          </button>
        ))}
      </div>

      <button
        className={`${button.btn} ${button.btnPrimary} ${styles.submit}`}
        disabled={!selectedEmployee}
        onClick={handleContinue}
      >
        Продолжить
      </button>
    </motion.section>
  )
}