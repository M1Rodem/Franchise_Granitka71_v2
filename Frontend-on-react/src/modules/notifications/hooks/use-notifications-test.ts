// src/modules/notifications/hooks/use-notifications-test.ts

import { useEffect, useRef } from 'react'
import { notificationsApi } from '../api/notifications.api'
import { useNotificationsStore } from '../store/notifications.store'

export const useNotificationsTest = () => {
  const setNotifications = useNotificationsStore((s) => s.setNotifications)
  const setBadge = useNotificationsStore((s) => s.setBadge)
  const setLoading = useNotificationsStore((s) => s.setLoading)

  const hasRun = useRef(false)

  useEffect(() => {
    if (hasRun.current) return
    hasRun.current = true

    const run = async () => {
      try {
        console.log('[TEST] start')

        setLoading(true)

        // ===== 1. список =====
        const response = await notificationsApi.getNotifications('active', 1, 10)
        console.log('[TEST] notifications:', response)

        setNotifications(response.items)

        // ===== 2. badge =====
        const badge = await notificationsApi.getBadge()
        console.log('[TEST] badge:', badge)

        setBadge(badge)

        // ===== 3. details =====
        if (response.items.length > 0) {
          const firstId = response.items[0].id

          const details = await notificationsApi.getNotificationDetails(firstId)
          console.log('[TEST] details:', details)
        }

      } catch (e) {
        console.error('[TEST ERROR]', e)
      } finally {
        setLoading(false)
      }
    }

    run()
  }, [setNotifications, setBadge, setLoading])
}