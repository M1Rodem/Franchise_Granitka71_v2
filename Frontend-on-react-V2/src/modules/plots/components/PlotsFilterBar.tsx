import { useEffect, useRef } from 'react'

import surface from '@/shared/ui/surface.module.css'
import input from '@/shared/ui/input.module.css'
import button from '@/shared/ui/button.module.css'
import toolbar from '@/shared/ui/page-toolbar.module.css'

import styles from './plots-filter-bar.module.css'

interface PlotsFilterBarProps {
  search: string
  isFetching: boolean
  onSearchChange: (value: string) => void
  onReset: () => void
}

export function PlotsFilterBar({
  search,
  isFetching,
  onSearchChange,
  onReset,
}: PlotsFilterBarProps) {
  const debounceRef = useRef<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  useEffect(
    () => () => {
      if (debounceRef.current !== null) {
        window.clearTimeout(debounceRef.current)
      }
    },
    []
  )

  useEffect(() => {
    const inputEl = searchInputRef.current
    if (!inputEl) return

    if (document.activeElement !== inputEl && inputEl.value !== search) {
      inputEl.value = search
    }
  }, [search])

  return (
    <div className={surface.surface}>
      <div className={toolbar.shell}>
        <div className={toolbar.row}>
          <div className={toolbar.titleBlock}>
            <span className={toolbar.eyebrow}>Plots</span>
            <h1 className={toolbar.heading}>Участки CRM</h1>
            <p className={toolbar.description}>
              Поиск и быстрый доступ к участкам, адресам и действиям в таком же
              аккуратном контуре, как на странице пользователей.
            </p>
          </div>

          <div className={toolbar.meta}>
            <span className={toolbar.pill}>Поиск по участкам</span>
            <span className={toolbar.pill}>Адреса и карта</span>
          </div>
        </div>

        <div className={styles.controls}>
          <input
            ref={searchInputRef}
            type="search"
            defaultValue={search}
            className={input.searchInput}
            placeholder="Поиск: по названию участка или адресу"
            onChange={(event) => {
              if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current)
              }

              const value = event.target.value

              debounceRef.current = window.setTimeout(() => {
                onSearchChange(value)
              }, 350)
            }}
          />

          <button
            type="button"
            onClick={onReset}
            disabled={isFetching}
            className={`${button.btn} ${button.btnSecondary}`}
          >
            Сброс
          </button>
        </div>
      </div>
    </div>
  )
}
