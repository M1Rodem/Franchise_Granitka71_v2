import { useEffect, useRef } from "react"

import surface from "@/shared/ui/surface.module.css"
import input from "@/shared/ui/input.module.css"
import button from "@/shared/ui/button.module.css"

import { AnimatedSelect } from "@/shared/ui/AnimatedSelect"

import type {
  UsersListQueryParams,
  UserRole,
} from "@/modules/users/types/users.types"

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

      <div
        style={{
          display: "flex",
          gap: 12,
          alignItems: "center",
          flexWrap: "wrap",
        }}
      >

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

        <div style={{ width: 200 }}>
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
  )
}