import { useState } from "react"

import { AppIcon } from "@/shared/ui/AppIcon"
import styles from "@/modules/users/components/user-modal.module.css"

import { FormModal } from "@/shared/ui/modal/FormModal"
import { useConfirmModalStore } from "@/shared/ui/modal/modal.store"

import { useChangePassword } from "../hooks/use-change-password"

import input from "@/shared/ui/input.module.css"
import button from "@/shared/ui/button.module.css"

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function ChangePasswordModal({
  isOpen,
  onClose
}: Props) {

  const openConfirm = useConfirmModalStore(s => s.open)

  const changePassword = useChangePassword()

  const [currentPassword, setCurrentPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")

  const [showPassword, setShowPassword] = useState(false)

  const hasChanges =
    currentPassword ||
    newPassword ||
    confirmPassword

  const canSave =
    currentPassword &&
    newPassword &&
    confirmPassword &&
    newPassword === confirmPassword

  function handleCloseRequest() {

    if (hasChanges) {

      openConfirm({
        title: "Несохранённые изменения",
        message: "Закрыть без сохранения?",
        confirmText: "Выйти",
        cancelText: "Отмена",
        onConfirm: onClose
      })

      return
    }

    onClose()

  }

  function handleSave() {

    if (!canSave) return

    changePassword.mutate(
      {
        currentPassword,
        newPassword
      },
      {
        onSuccess: () => {

          setCurrentPassword("")
          setNewPassword("")
          setConfirmPassword("")

          onClose()

        }
      }
    )

  }

  return (

    <FormModal
      isOpen={isOpen}
      onClose={handleCloseRequest}
      title="Смена пароля"
      size="sm"

      footer={

        <div style={{ display: "flex", gap: 10 }}>

          <button
            className={`${button.btn} ${button.btnSuccess}`}
            onClick={handleSave}
            disabled={!canSave}
          >
            {changePassword.isPending
              ? "Сохранение..."
              : "Сохранить"}
          </button>
          
          <button
            className={`${button.btn} ${button.btnSecondary}`}
            onClick={handleCloseRequest}
          >
            Отмена
          </button>

        </div>

      }

    >

      <div className={input.field}>
        <label className={input.label}>
          Старый пароль
        </label>

        <div style={{ position: "relative" }}>

            <input
                className={input.input}
                type={showPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
            />

            {currentPassword.length > 0 && (
                <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
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

      <div className={input.field}>
        <label className={input.label}>
          Новый пароль
        </label>

        <div style={{ position: "relative" }}>

            <input
                className={input.input}
                type={showPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
            />

            {newPassword.length > 0 && (
                <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
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

      <div className={input.field}>
        <label className={input.label}>
          Подтверждение
        </label>

        <div style={{ position: "relative" }}>

            <input
                className={input.input}
                type={showPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
            />

            {confirmPassword.length > 0 && (
                <button
                type="button"
                onClick={() => setShowPassword(prev => !prev)}
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

    </FormModal>
  )
}