import table from "@/shared/ui/table-base.module.css"
import { StatusBadge } from "@/shared/ui/status"
import type { UserDto } from "@/modules/users/types/users.types"
import { getUserStatusInfo } from "@/modules/users/lib/user-status"
import styles from "./users-table.module.css"
import surface from '@/shared/ui/surface.module.css';

interface UsersTableProps {
  users: UserDto[]
  onOpenUser: (id: number) => void
}

const GRID_TEMPLATE = "180px 1.6fr 160px 120px"

const ROLE_LABELS: Record<UserDto["role"], string> = {
  SuperAdmin: "Системный администратор",
  Admin: "Администратор",
  Manager: "Менеджер",
}

export function UsersTable({
  users,
  onOpenUser,
}: UsersTableProps) {
  return (
    <div className={surface.surface}>
      <div
        className={table.dataHeader}
        style={{
          gridTemplateColumns: GRID_TEMPLATE,
        }}
      >
        <span>Логин</span>
        <span>ФИО</span>
        <span>Роль</span>
        <span>Статус</span>
      </div>

      {users.length === 0 && (
        <div className={table.empty}>
          Пользователи не найдены
        </div>
      )}

      {users.map((user) => {
        const status = getUserStatusInfo(user.isBlocked)

        return (
          <div
            key={user.id}
            className={table.dataRow}
            style={{
              gridTemplateColumns: GRID_TEMPLATE,
              cursor: "pointer",
            }}
            onClick={() => onOpenUser(user.id)}
          >
            <div data-label="Логин" className={styles.cell}>
              <span className={table.primaryCell}>
                {user.username}
              </span>
            </div>

            <div data-label="ФИО" className={styles.cell}>
              <span className={table.primaryCell}>
                {user.fullName}
              </span>
            </div>

            <div data-label="Роль" className={styles.cell}>
              <div className={styles.cellStack}>
                <span className={styles.cellTitle}>
                  {ROLE_LABELS[user.role]}
                </span>
                <span className={styles.cellMeta}>
                  {user.role}
                </span>
              </div>
            </div>

            <div data-label="Статус" className={styles.statusCell}>
              <StatusBadge style={status.style}>
                {status.label}
              </StatusBadge>
            </div>
          </div>
        )
      })}
    </div>
  )
}
