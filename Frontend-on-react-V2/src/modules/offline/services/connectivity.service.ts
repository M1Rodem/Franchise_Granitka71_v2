type ConnectivityListener = (isOnline: boolean) => void

const PROBE_INTERVAL_MS = 60000
const PROBE_TIMEOUT_MS = 5000
const CONSECUTIVE_ERRORS_THRESHOLD = 3

class ConnectivityService {
  private backendAvailable = false
  private browserOnline = typeof navigator !== 'undefined' ? navigator.onLine : true
  private listeners = new Set<ConnectivityListener>()
  private intervalId: ReturnType<typeof setInterval> | null = null
  private isProbing = false
  private consecutiveErrors = 0
  private lastKnownState: boolean = false  // ← ИСПРАВЛЕНО

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
    this.consecutiveErrors = 0
    this.notify()
    void this.probeBackend()
  }

  private handleBrowserOffline = () => {
    this.browserOnline = false
    this.backendAvailable = false
    this.consecutiveErrors = 0
    this.notify()
  }

  private async probeBackend() {
    if (this.isProbing) return

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      this.browserOnline = false
      this.backendAvailable = false
      this.consecutiveErrors = 0
      this.notify()
      return
    }

    this.isProbing = true
    this.browserOnline = true

    try {
      const response = await fetch('/health', {
        signal: AbortSignal.timeout(PROBE_TIMEOUT_MS),
      })

      const isAvailable = response.ok

      if (isAvailable) {
        this.consecutiveErrors = 0
        this.backendAvailable = true
      } else {
        this.consecutiveErrors++
        if (this.consecutiveErrors >= CONSECUTIVE_ERRORS_THRESHOLD) {
          this.backendAvailable = false
        }
      }
    } catch {
      this.consecutiveErrors++
      if (this.consecutiveErrors >= CONSECUTIVE_ERRORS_THRESHOLD) {
        this.backendAvailable = false
      }
    } finally {
      this.isProbing = false
      this.notify()
    }
  }

  private notify() {
    const currentState = this.isOnline()

    if (this.lastKnownState !== currentState) {
      this.lastKnownState = currentState
      this.listeners.forEach((listener) => {
        listener(currentState)
      })
    }
  }
}

export const connectivityService = new ConnectivityService()