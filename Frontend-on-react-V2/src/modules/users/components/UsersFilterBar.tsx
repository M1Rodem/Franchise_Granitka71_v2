import { useEffect, useRef } from "react"

import surface from "@/shared/ui/surface.module.css"
import input from "@/shared/ui/input.module.css"
import button from "@/shared/ui/button.module.css"
import toolbar from "@/shared/ui/page-toolbar.module.css"

import { AnimatedSelect } from "@/shared/ui/AnimatedSelect"

import type {
  UsersListQueryParams,
  UserRole,
} from "@/modules/users/types/users.types"

import styles from "./users-filter-bar.module.css"

interface UsersFilterBarProps {
  filters: UsersListQueryParams
  isFetching: boolean
  onFiltersChange: (patch: Partial<UsersListQueryParams>) => void
  onReset: () => void
}

const roleOptions = [
  { value: "", label: "Список ролей" },
  { value: "Manager", label: "Manager" },
  { value: "Admin", label: "Admin" },
  { value: "SuperAdmin", label: "SuperAdmin" },
]

export function UsersFilterBar({
  filters,
  isFetching,
  onFiltersChange,
  onReset,
}: UsersFilterBarProps) {
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

    if (
      document.activeElement !== inputEl &&
      inputEl.value !== filters.searchQuery
    ) {
      inputEl.value = filters.searchQuery ?? ""
    }
  }, [filters.searchQuery])

  return (
    <div className={surface.surface}>
      <div className={toolbar.shell}>
        <div className={toolbar.row}>
          <div className={toolbar.titleBlock}>
            <p className={toolbar.description}>
              Поиск, фильтрация и быстрый доступ к карточкам сотрудников.
            </p>
          </div>

          <div className={toolbar.meta}>
            <span className={toolbar.pill}>Роли и доступ</span>
            <span className={toolbar.pill}>Быстрые действия</span>
          </div>
        </div>

        <div className={styles.controls}>
          <input
            ref={searchInputRef}
            type="search"
            defaultValue={filters.searchQuery}
            className={input.searchInput}
            placeholder="Поиск: по login или ФИО пользователя"
            onChange={(event) => {
              if (debounceRef.current !== null) {
                window.clearTimeout(debounceRef.current)
              }

              const value = event.target.value

              debounceRef.current = window.setTimeout(() => {
                onFiltersChange({
                  searchQuery: value,
                  page: 1,
                })
              }, 350)
            }}
          />

          <div className={styles.selectWrap}>
            <AnimatedSelect
              value={filters.role ?? ""}
              options={roleOptions}
              onChange={(value) => {
                onFiltersChange({
                  role: value as UserRole | "",
                  page: 1,
                })
              }}
            />
          </div>

          <style>{`
            .animated-select-wrapper .animated-select-trigger {
              text-align: center !important;
              justify-content: center !important;
            }
            .animated-select-wrapper .animated-select-value {
              text-align: center !important;
              width: 100% !important;
            }
          `}</style>

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
