import { useState } from "react"

import surface from "@/shared/ui/surface.module.css"
import button from "@/shared/ui/button.module.css"
import form from "@/shared/ui/form-layout.module.css"
import { StatusBadge } from "@/shared/ui/status"
import { getUserStatusInfo } from "@/modules/users/lib/user-status"
import { useProfile } from "../hooks/use-profile"

import { EditProfileModal } from "../components/EditProfileModal"
import { ChangePasswordModal } from "../components/ChangePasswordModal"

export default function ProfilePage() {

  const profileQuery = useProfile()

  const [editOpen, setEditOpen] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  if (profileQuery.isPending) {
    return <div>Загрузка...</div>
  }

  if (profileQuery.isError || !profileQuery.data) {
    return <div>Ошибка загрузки профиля</div>
  }

  const user = profileQuery.data

  const status = getUserStatusInfo(user.isBlocked)

  return (

    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>

      {/* INFO CARDS */}

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(220px,1fr))",
          gap: 20
        }}
      >

        <section className={surface.surface} style={{ alignItems: "center", textAlign: "center" }}>
          <div className={form.field}>
            <label className={form.label}>Полное имя</label>
            <div className={form.value}>{user.fullName}</div>
          </div>
        </section>

        <section className={surface.surface} style={{ alignItems: "center", textAlign: "center" }}>
          <div className={form.field}>
            <label className={form.label}>Логин</label>
            <div className={form.value}>{user.username}</div>
          </div>
        </section>

        <section className={surface.surface} style={{ alignItems: "center", textAlign: "center" }}>
          <div className={form.field}>
            <label className={form.label}>Роль</label>
            <div className={form.value}>{user.role}</div>
          </div>
        </section>

        <section
          className={surface.surface}
          style={{ alignItems: "center", textAlign: "center" }}
        >
          <div className={form.field}>
            <label className={form.label}>Статус</label>

            <StatusBadge style={status.style}>
              {status.label}
            </StatusBadge>

          </div>
        </section>

      </div>

      {/* ACTION CARDS */}

      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 20
        }}
      >

        <section
          className={surface.surface}
          style={{
            padding: "18px 38px",
            alignItems: "center",
            justifyContent: "center",
            width: "fit-content"
          }}
        >

          <button
            className={`${button.btn} ${button.btnPrimary}`}
            onClick={() => setEditOpen(true)}
          >
            Редактировать
          </button>

        </section>

        <section
          className={surface.surface}
          style={{
            padding: "18px 38px",
            alignItems: "center",
            justifyContent: "center",
            width: "fit-content"
          }}
        >

          <button
            className={`${button.btn} ${button.btnSecondary}`}
            onClick={() => setPasswordOpen(true)}
          >
            Сменить пароль
          </button>

        </section>

      </div>

      <EditProfileModal
        isOpen={editOpen}
        onClose={() => setEditOpen(false)}
      />

      <ChangePasswordModal
        isOpen={passwordOpen}
        onClose={() => setPasswordOpen(false)}
      />

    </div>
  )
}