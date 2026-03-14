import { useState } from "react"

import { FormModal } from "@/shared/ui/modal/FormModal"
import { useConfirmModalStore } from "@/shared/ui/modal/modal.store"
import { AnimatedSelect } from "@/shared/ui/AnimatedSelect"
import { AppIcon } from "@/shared/ui/AppIcon"

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
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)

  const [role, setRole] = useState<UserRole>("Manager")

  const hasChanges =
    username.trim() !== "" ||
    fullName.trim() !== "" ||
    password.trim() !== "" ||
    confirmPassword.trim() !== ""

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

    if (password !== confirmPassword) {
      showTempMessage(
        "warning",
        "Пароли не совпадают"
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
          setConfirmPassword("")
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

        {/* PASSWORD */}

        <div className={input.field}>
          <label className={input.label}>
            Пароль
          </label>

          <div style={{ position: "relative" }}>

            <input
              className={input.input}
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) =>
                setPassword(e.target.value)
              }
            />

            {password.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setShowPassword(prev => !prev)
                }
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#bdd8fb"
                }}
              >
                <AppIcon
                  name={showPassword ? "eyeOff" : "eye"}
                  className={styles.passwordIcon}
                />
              </button>
            )}

          </div>

        </div>

        {/* CONFIRM PASSWORD */}

        <div className={input.field}>
          <label className={input.label}>
            Подтвердите пароль
          </label>

          <div style={{ position: "relative" }}>

            <input
              className={input.input}
              type={showPassword ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) =>
                setConfirmPassword(e.target.value)
              }
            />

            {confirmPassword.length > 0 && (
              <button
                type="button"
                onClick={() =>
                  setShowPassword(prev => !prev)
                }
                style={{
                  position: "absolute",
                  right: 12,
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  color: "#bdd8fb"
                }}
              >
                <AppIcon
                  name={showPassword ? "eyeOff" : "eye"}
                  className={styles.passwordIcon}
                />
              </button>
            )}

          </div>

        </div>

      </div>

    </FormModal>
  )
}