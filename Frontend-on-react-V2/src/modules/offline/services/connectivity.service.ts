import { httpClient } from '@/shared/api/http-client'

type ConnectivityListener = (isOnline: boolean) => void

const PROBE_INTERVAL_MS = 15000
const PROBE_TIMEOUT_MS = 5000

class ConnectivityService {
  private backendAvailable = false
  private browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private listeners = new Set<ConnectivityListener>()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isProbing = false

  isOnline() {
    return this.browserOnline && this.backendAvailable
  }

  isOffline() {
    return !this.isOnline()
  }

  subscribe(listener: ConnectivityListener) {
    this.listeners.add(listener)
    this.ensureStarted()
    listener(this.isOnline())

    return () => {
      this.unsubscribe(listener)
    }
  }

  unsubscribe(listener: ConnectivityListener) {
    this.listeners.delete(listener)

    if (this.listeners.size === 0) {
      this.stop()
    }
  }

  private ensureStarted() {
    if (typeof window === 'undefined') return

    if (!this.intervalId) {
      window.addEventListener('online', this.handleBrowserOnline)
      window.addEventListener('offline', this.handleBrowserOffline)

      this.intervalId = window.setInterval(() => {
        void this.probeBackend()
      }, PROBE_INTERVAL_MS)
    }

    void this.probeBackend()
  }

  private stop() {
    if (typeof window === 'undefined') return

    if (this.intervalId) {
      clearInterval(this.intervalId)
      this.intervalId = null
    }

    window.removeEventListener('online', this.handleBrowserOnline)
    window.removeEventListener('offline', this.handleBrowserOffline)
  }

  private handleBrowserOnline = () => {
    this.browserOnline = true
    this.notify()
    void this.probeBackend()
  }

  private handleBrowserOffline = () => {
    this.browserOnline = false
    this.backendAvailable = false
    this.notify()
  }

  private async probeBackend() {
    if (this.isProbing) return

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.browserOnline = false
      this.backendAvailable = false
      this.notify()
      return
    }

    this.isProbing = true

    try {
      this.browserOnline = true

      const response = await httpClient.get('/orders/list', {
        params: {
          Page: 1,
          PageSize: 1,
        },
        timeout: PROBE_TIMEOUT_MS,
        validateStatus: () => true,
      })

      this.backendAvailable = response.status >= 200 && response.status < 500
    } catch {
      this.backendAvailable = false
    } finally {
      this.isProbing = false
      this.notify()
    }
  }

  private notify() {
    const value = this.isOnline()

    this.listeners.forEach((listener) => {
      listener(value)
    })
  }
}

export const connectivityService = new ConnectivityService()
