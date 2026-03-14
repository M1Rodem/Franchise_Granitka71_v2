import table from "@/shared/ui/table-base.module.css"
import surface from "@/shared/ui/surface.module.css"
import { StatusBadge } from "@/shared/ui/status"
import type { UserDto } from "@/modules/users/types/users.types"
import { getUserStatusInfo } from "@/modules/users/lib/user-status"

interface UsersTableProps {
  users: UserDto[]
  onOpenUser: (id: number) => void
}

const GRID_TEMPLATE =
  "180px 1.6fr 160px 120px"

export function UsersTable({
  users,
  onOpenUser,
}: UsersTableProps) {

  return (
    <section className={surface.surface}>

      <div className={table.dataTable}>

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

        {users.map(user => {

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

            <span data-label="Логин">
              {user.username}
            </span>

            <span
              data-label="ФИО"
              className={table.primaryCell}
            >
              {user.fullName}
            </span>

            <span data-label="Роль">
              {user.role}
            </span>

            <span data-label="Статус">
              <StatusBadge style={status.style}>
                {status.label}
              </StatusBadge>
            </span>

          </div>
        )})}

      </div>

    </section>
  )
}