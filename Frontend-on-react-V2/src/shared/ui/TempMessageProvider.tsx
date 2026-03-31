import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { registerTempMessageHandler } from '@/shared/ui/temp-message.service'
import type { TempMessagePayload } from '@/shared/ui/temp-message.service'
import styles from './temp-message.module.css'
import { AppIcon } from '@/shared/ui/AppIcon'

export function TempMessageProvider() {
  const [current, setCurrent] = useState<TempMessagePayload | null>(null)
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [progress, setProgress] = useState(100)

  const timeoutRef = useRef<number | null>(null)
  const progressIntervalRef = useRef<number | null>(null)
  const startX = useRef(0)
  const startY = useRef(0)
  const dragStartTime = useRef(0)

  // Check mobile on mount and resize
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768)
    }
    
    checkMobile()
    window.addEventListener('resize', checkMobile)
    
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current)
      if (progressIntervalRef.current) clearInterval(progressIntervalRef.current)
    }
  }, [])

  // Clear progress interval
  const clearProgressInterval = () => {
    if (progressIntervalRef.current) {
      clearInterval(progressIntervalRef.current)
      progressIntervalRef.current = null
    }
  }

  // Start progress bar animation
  const startProgressBar = (durationMs: number) => {
    clearProgressInterval()
    setProgress(100)
    
    const startTime = Date.now()
    const interval = 16 // ~60fps
    
    progressIntervalRef.current = window.setInterval(() => {
      const elapsed = Date.now() - startTime
      const remaining = Math.max(0, 100 - (elapsed / durationMs) * 100)
      setProgress(remaining)
      
      if (remaining <= 0) {
        clearProgressInterval()
      }
    }, interval)
  }

  // Close toast with animation
  const closeToast = () => {
    if (isClosing) return
    
    setIsClosing(true)
    clearProgressInterval()
    
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    
    setTimeout(() => {
      setCurrent(null)
      setIsClosing(false)
      setOffset({ x: 0, y: 0 })
      setProgress(100)
    }, 250) // Match animation duration
  }

  // Handle new message
  useEffect(() => {
    return registerTempMessageHandler((payload) => {
      // Clear existing timeouts
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
      
      clearProgressInterval()
      
      // Reset states
      setIsClosing(false)
      setOffset({ x: 0, y: 0 })
      setDragging(false)
      
      // Set new message
      setCurrent(payload)
      
      const duration = payload.durationMs ?? 2500
      
      // Start progress bar
      startProgressBar(duration)
      
      // Auto close
      timeoutRef.current = window.setTimeout(() => {
        closeToast()
      }, duration)
    })
  }, [])

  // Mouse drag handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (isMobile) return
    
    setDragging(true)
    dragStartTime.current = Date.now()
    startX.current = e.clientX
    startY.current = e.clientY
    
    // Pause auto-close while dragging
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    clearProgressInterval()
  }
  
  const handleMouseMove = (e: MouseEvent) => {
    if (!dragging) return
    
    const dx = e.clientX - startX.current
    const dy = e.clientY - startY.current
    setOffset({ x: dx, y: dy })
  }
  
  const handleMouseUp = () => {
    if (!dragging) return
    
    setDragging(false)
    
    // Check if should close
    const dragDistance = Math.abs(offset.x)
    const dragVertical = offset.y
    
    if (dragDistance > 80 || dragVertical < -60) {
      closeToast()
      return
    }
    
    // Reset position
    setOffset({ x: 0, y: 0 })
    
    // Resume auto-close if not closed
    if (current && !isClosing) {
      const remainingDuration = Math.max(0, (progress / 100) * (current.durationMs ?? 2500))
      
      if (remainingDuration > 0) {
        startProgressBar(remainingDuration)
        
        timeoutRef.current = window.setTimeout(() => {
          closeToast()
        }, remainingDuration)
      } else {
        closeToast()
      }
    }
  }
  
  // Touch drag handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    setDragging(true)
    dragStartTime.current = Date.now()
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    
    // Pause auto-close while dragging
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    clearProgressInterval()
  }
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!dragging) return
    
    const dx = e.touches[0].clientX - startX.current
    const dy = e.touches[0].clientY - startY.current
    setOffset({ x: dx, y: dy })
  }
  
  const handleTouchEnd = () => {
    if (!dragging) return
    
    setDragging(false)
    
    // Check if should close
    const dragDistance = Math.abs(offset.x)
    const dragVertical = offset.y
    
    if (dragDistance > 80 || dragVertical < -60) {
      closeToast()
      return
    }
    
    // Reset position
    setOffset({ x: 0, y: 0 })
    
    // Resume auto-close if not closed
    if (current && !isClosing) {
      const remainingDuration = Math.max(0, (progress / 100) * (current.durationMs ?? 2500))
      
      if (remainingDuration > 0) {
        startProgressBar(remainingDuration)
        
        timeoutRef.current = window.setTimeout(() => {
          closeToast()
        }, remainingDuration)
      } else {
        closeToast()
      }
    }
  }
  
  // Global mouse event listeners
  useEffect(() => {
    if (dragging && !isMobile) {
      window.addEventListener('mousemove', handleMouseMove)
      window.addEventListener('mouseup', handleMouseUp)
      
      return () => {
        window.removeEventListener('mousemove', handleMouseMove)
        window.removeEventListener('mouseup', handleMouseUp)
      }
    }
  }, [dragging, isMobile, offset.x, offset.y])
  
  // Pause auto-close on hover
  const handleMouseEnter = () => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current)
      timeoutRef.current = null
    }
    clearProgressInterval()
  }
  
  const handleMouseLeave = () => {
    if (!current || isClosing || dragging) return
    
    const remainingDuration = Math.max(0, (progress / 100) * (current.durationMs ?? 2500))
    
    if (remainingDuration > 0) {
      startProgressBar(remainingDuration)
      
      timeoutRef.current = window.setTimeout(() => {
        closeToast()
      }, remainingDuration)
    } else {
      closeToast()
    }
  }
  
  if (!current) return null
  
  // Determine position class
  const positionClass = current.position ? styles[`toast${current.position.charAt(0).toUpperCase() + current.position.slice(1)}`] : styles.toastTopRight
  
  return createPortal(
    <div
      className={`
        ${styles.toast} 
        ${styles[`toast${current.type.charAt(0).toUpperCase() + current.type.slice(1)}`]} 
        ${positionClass}
        ${isClosing ? styles.closing : ''}
        ${dragging ? styles.dragging : ''}
      `}
      style={{
        transform: `translate(${offset.x}px, ${offset.y}px)`,
        transition: dragging ? 'none' : undefined
      }}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Progress bar */}
      <div 
        className={styles.progressBar}
        style={{ width: `${progress}%` }}
      />
      
      <div className={styles.content}>
        <AppIcon
          name={current.type}
          className={styles.icon}
        />
        
        <span className={styles.message}>
          {current.message}
        </span>
      </div>
      
      {!isMobile && (
        <button
          className={styles.closeButton}
          onClick={closeToast}
          aria-label="Close notification"
        >
          <AppIcon name="close" />
        </button>
      )}
    </div>,
    document.body
  )
}