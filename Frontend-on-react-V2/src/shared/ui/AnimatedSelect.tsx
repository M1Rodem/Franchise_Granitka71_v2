import {
  useState,
  useRef,
  useEffect,
  forwardRef,
} from 'react'
import type { ForwardedRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import styles from './animated-select.module.css'

interface Option {
  value: string
  label: string
}

interface AnimatedSelectProps {
  value: string
  options: Option[]
  onChange: (value: string) => void
}

export const AnimatedSelect = forwardRef<
  HTMLDivElement,
  AnimatedSelectProps
>(function AnimatedSelect(
  { value, options, onChange },
  forwardedRef: ForwardedRef<HTMLDivElement>
) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState({
    top: 0,
    left: 0,
    width: 0,
  })

  const rootRef = useRef<HTMLDivElement>(null)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // объединяем внешний ref и внутренний rootRef
  useEffect(() => {
    if (!forwardedRef) return

    if (typeof forwardedRef === 'function') {
      forwardedRef(rootRef.current)
    } else {
      forwardedRef.current = rootRef.current
    }
  }, [forwardedRef])

  const updatePosition = () => {
    if (!rootRef.current) return

    const rect = rootRef.current.getBoundingClientRect()

    setCoords({
      top: rect.bottom + window.scrollY,
      left: rect.left + window.scrollX,
      width: rect.width,
    })
  }

  useEffect(() => {
    if (!open) return

    updatePosition()

    window.addEventListener('scroll', updatePosition, true)
    window.addEventListener('resize', updatePosition)

    return () => {
      window.removeEventListener('scroll', updatePosition, true)
      window.removeEventListener('resize', updatePosition)
    }
  }, [open])

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      const target = e.target as Node

      if (
        !rootRef.current?.contains(target) &&
        !dropdownRef.current?.contains(target)
      ) {
        setOpen(false)
      }
    }

    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [])

  const selected = options.find(o => o.value === value)

  return (
    <>
      <div
        className={styles.wrapper}
        ref={rootRef}
      >
        <motion.button
          type="button"
          className={styles.trigger}
          onClick={() => setOpen(v => !v)}
          whileTap={{ scale: 0.98 }}
        >
          {selected?.label ?? 'Выбрать'}
        </motion.button>
      </div>

      {open &&
        createPortal(
          <AnimatePresence>
            <motion.div
              ref={dropdownRef}
              className={styles.portalDropdown}
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.15 }}
              style={{
                position: 'absolute',
                top: coords.top,
                left: coords.left,
                width: coords.width,
                zIndex: 9999,
              }}
            >
              {options.map(option => {
                const isSelected =
                  option.value === value

                return (
                  <motion.div
                    key={option.value}
                    className={`${styles.option} ${
                      isSelected
                        ? styles.selected
                        : ''
                    }`}
                    onClick={() => {
                      onChange(option.value)
                      setOpen(false)
                    }}
                    whileHover={{
                      backgroundColor:
                        'rgba(90, 140, 220, 0.18)',
                    }}
                  >
                    {option.label}
                  </motion.div>
                )
              })}
            </motion.div>
          </AnimatePresence>,
          document.body,
        )}
    </>
  )
})