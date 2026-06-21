import { useState, useEffect } from 'react'
import { useOfflineSessionStore } from '@/modules/offline/store/offline-session.store'
import { offlineEmployeesService } from '@/modules/offline/services/offline-employees.service'

export function useOfflineSession() {
  const { currentEmployee, setCurrentEmployee, clearSession } = useOfflineSessionStore()
  const [hasEmployees, setHasEmployees] = useState<boolean | null>(null)

  useEffect(() => {
    const checkEmployees = async () => {
      const exists = await offlineEmployeesService.hasEmployees()
      setHasEmployees(exists)
    }
    checkEmployees()
  }, [])

  return {
    currentEmployee,
    setCurrentEmployee,
    clearSession,
    hasEmployees,
  }
}