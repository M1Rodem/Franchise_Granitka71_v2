import { useState } from "react"

import { FormModal } from "@/shared/ui/modal/FormModal"
import { useConfirmModalStore } from "@/shared/ui/modal/modal.store"
import { AnimatedSelect } from "@/shared/ui/AnimatedSelect"

import { useCreateUser } from "@/modules/users/hooks/use-user-mutations"
import { showTempMessage } from "@/shared/ui/temp-message.service"

import { useUiStore } from "@/shared/store/ui.store"

import type { UserRole } from "@/modules/users/types/users.types"

import input from "@/shared/ui/input.module.css"
import button from "@/shared/ui/button.module.css"
import form from "@/shared/ui/form-layout.module.css"
import styles from "./user-modal.module.css"

const roleOptions = [
  { value: "Manager", label: "Manager" },
  { value: "Admin", label: "Admin" },
  { value: "SuperAdmin", label: "SuperAdmin" },
]

export function CreateUserModal() {

  const isOpen =
    useUiStore(state => state.isUserCreateModalOpen)

  const closeModal =
    useUiStore(state => state.closeUserCreateModal)

  const createMutation =
    useCreateUser()

  const openConfirm =
    useConfirmModalStore(state => state.open)

  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<UserRole>("Manager")

  const hasChanges =
    username.trim() !== "" ||
    fullName.trim() !== "" ||
    password.trim() !== ""

  const handleCreate = () => {

    if (!username.trim()) {
      showTempMessage("warning", "Введите логин")
      return
    }

    if (!fullName.trim()) {
      showTempMessage("warning", "Введите ФИО")
      return
    }

    if (!password || password.length < 8) {
      showTempMessage(
        "warning",
        "Пароль должен содержать минимум 8 символов"
      )
      return
    }

    createMutation.mutate(
      {
        username,
        fullName,
        password,
        role,
      },
      {
        onSuccess() {
          closeModal()
          setUsername("")
          setFullName("")
          setPassword("")
          setRole("Manager")
        },
        onError() {
          showTempMessage(
            "error",
            "Логин уже занят"
          )
        },
      }
    )
  }

  function handleCloseRequest() {
    if (hasChanges) {

      openConfirm({
        title: "Несохранённые изменения",
        message: "Есть несохранённые изменения. Закрыть без сохранения?",
        confirmText: "Выйти",
        cancelText: "Отмена",
        onConfirm: () => closeModal(),
      })
      return
    }
    closeModal()
  }

  return (

    <FormModal
      isOpen={isOpen}
      onClose={handleCloseRequest}
      title="Создать пользователя"
      size="md"
      footer={

        <div className={styles.footerActions}>

          <button
            className={`${button.btn} ${button.btnSuccess}`}
            onClick={handleCreate}
            disabled={createMutation.isPending}
          >
            {createMutation.isPending
              ? "Создание..."
              : "Создать"}
          </button>

          <button
            className={`${button.btn} ${button.btnSecondary}`}
            onClick={closeModal}
          >
            Отмена
          </button>

        </div>

      }
    >

      <div className={`${form.form} ${styles.modalForm}`}>

        <div className={styles.gridTwo}>

          <div className={input.field}>
            <label className={input.label}>
              Логин
            </label>

            <input
              className={input.input}
              value={username}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />
          </div>

          <div className={input.field}>
            <label className={input.label}>
              Роль
            </label>

            <AnimatedSelect
              value={role}
              options={roleOptions}
              onChange={(val) =>
                setRole(val as UserRole)
              }
            />
          </div>

        </div>

        <div className={input.field}>
          <label className={input.label}>
            ФИО Пользователя
          </label>

          <input
            className={input.input}
            value={fullName}
            onChange={(e) =>
              setFullName(e.target.value)
            }
          />
        </div>

        <div className={input.field}>
          <label className={input.label}>
            Пароль
          </label>

          <input
            className={input.input}
            type="password"
            value={password}
            onChange={(e) =>
              setPassword(e.target.value)
            }
          />
        </div>

      </div>

    </FormModal>

  )
}