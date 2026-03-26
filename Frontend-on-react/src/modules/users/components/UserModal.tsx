import { useState, useEffect } from "react"

import { FormModal } from "@/shared/ui/modal/FormModal"
import { useConfirmModalStore } from "@/shared/ui/modal/modal.store"

import { AnimatedSelect } from "@/shared/ui/AnimatedSelect"
import { getUserStatusInfo } from "@/modules/users/lib/user-status"

import { useUser } from "@/modules/users/hooks/use-user"
import { showTempMessage } from "@/shared/ui/temp-message.service"
import { AppIcon } from "@/shared/ui/AppIcon"

import {
  useUpdateUser,
  useChangeRole,
  useBlockUser,
  useUnblockUser,
  useDeleteUser,
} from "@/modules/users/hooks/use-user-mutations"

import type {
  UserRole,
  UpdateUserDto,
} from "@/modules/users/types/users.types"

import input from "@/shared/ui/input.module.css"
import button from "@/shared/ui/button.module.css"
import form from "@/shared/ui/form-layout.module.css"
import styles from "./user-modal.module.css"
import { StatusBadge } from "@/shared/ui/status"

interface UserModalProps {
  userId: number | null
  isOpen: boolean
  onClose: () => void
}

const roleOptions = [
  { value: "Manager", label: "Manager" },
  { value: "Admin", label: "Admin" },
  { value: "SuperAdmin", label: "SuperAdmin" },
]

export function UserModal({
  userId,
  isOpen,
  onClose,
}: UserModalProps) {

  const { data: user } = useUser(userId)

  const openConfirm = useConfirmModalStore(state => state.open)

  const [editMode, setEditMode] = useState(false)

  const [username, setUsername] = useState("")
  const [fullName, setFullName] = useState("")
  const [password, setPassword] = useState("")
  const [confirmPassword, setConfirmPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [role, setRole] = useState<UserRole>("Manager")

  const [initialUser, setInitialUser] = useState<{
    username: string
    fullName: string
    role: UserRole
  } | null>(null)

  useEffect(() => {

    if (!user) return

    setUsername(user.username)
    setFullName(user.fullName)
    setRole(user.role)

    setInitialUser({
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    })

  }, [user])

  useEffect(() => {

    if (!isOpen || !user) return

    const initial = {
      username: user.username,
      fullName: user.fullName,
      role: user.role,
    }

    setInitialUser(initial)

    setUsername(initial.username)
    setFullName(initial.fullName)
    setRole(initial.role)
    setPassword("")
    setConfirmPassword("")
    setShowPassword(false)
    setEditMode(false)
    setEditMode(false)

  }, [userId, isOpen])

  const updateMutation =
    useUpdateUser(userId ?? 0)

  const changeRoleMutation =
    useChangeRole(userId ?? 0)

  const blockMutation =
    useBlockUser(userId ?? 0)

  const unblockMutation =
    useUnblockUser(userId ?? 0)

  const deleteMutation =
    useDeleteUser(userId ?? 0)

  const hasChanges =
    initialUser &&
    (
      username !== initialUser.username ||
      fullName !== initialUser.fullName ||
      role !== initialUser.role ||
      password.length > 0
    )

  const handleSave = () => {

    if (!user) return

    if (!username.trim()) {
      showTempMessage("warning", "Введите логин")
      return
    }

    if (!fullName.trim()) {
      showTempMessage("warning", "Введите ФИО")
      return
    }

    if (password && password.length > 0 && password.length < 8) {
      showTempMessage(
        "warning",
        "Пароль должен содержать минимум 8 символов"
      )
      return
    }
    if (password && password !== confirmPassword) {
      showTempMessage(
        "warning",
        "Пароли не совпадают"
      )
      return
    }

    const payload: UpdateUserDto = {
      username,
      fullName,
    }

    if (password.trim()) {
      payload.password = password
    }

    const roleChanged = role !== user.role

    updateMutation.mutate(payload, {
      onSuccess() {
        if (roleChanged) {
          changeRoleMutation.mutate(
            { role },
            {
              onSuccess() {
                setEditMode(false)
                setPassword("")
                setConfirmPassword("")
              }
            }
          )
        } else {
          setEditMode(false)
          setPassword("")
          setConfirmPassword("")
        }
      },
      onError() {
        showTempMessage(
          "error",
          "Логин уже занят"
        )
      },
    })
  }

  const handleBlockToggle = () => {

    if (!user) return

    if (user.isBlocked) {

      unblockMutation.mutate(undefined, {
        onSuccess() {
          showTempMessage(
            "success",
            "Пользователь разблокирован"
          )
        },
        onError() {
          showTempMessage(
            "error",
            "Ошибка разблокировки пользователя"
          )
        }
      })

    } else {

      openConfirm({
        title: "Блокировка пользователя",
        message: "Вы уверены что хотите заблокировать пользователя?",
        confirmText: "Заблокировать",
        cancelText: "Отмена",

        onConfirm: () => {

          blockMutation.mutate(undefined, {
            onSuccess() {
              showTempMessage(
                "success",
                "Пользователь заблокирован"
              )
            },
            onError() {
              showTempMessage(
                "error",
                "Нельзя заблокировать этого пользователя"
              )
            }

          })

        },
      })

    }
  }

  const handleDeleteUser = () => {

    if (!user) return

    openConfirm({
      title: "Удаление пользователя",
      message: "Вы уверены что хотите удалить пользователя? Это действие нельзя отменить.",
      confirmText: "Удалить",
      cancelText: "Отмена",

      onConfirm: () => {

        deleteMutation.mutate(undefined, {

          onSuccess() {

            showTempMessage(
              "success",
              "Пользователь удалён"
            )

            onClose()

          },

          onError() {

            showTempMessage(
              "error",
              "Нельзя удалить этого пользователя"
            )

          }

        })

      },
    })

  }

  function handleCloseRequest() {
    if (editMode && hasChanges) {
      openConfirm({
        title: "Несохранённые изменения",
        message: "Есть несохранённые изменения. Закрыть без сохранения?",
        confirmText: "Выйти",
        cancelText: "Отмена",
        onConfirm: () => onClose(),
      })
      return
    }
    onClose()
  }

  const status = getUserStatusInfo(user?.isBlocked ?? false)

  return (

    <FormModal
      isOpen={isOpen}
      onClose={handleCloseRequest}
      title="Пользователь"
      size="md"
      footer={
        <div className={styles.footerWrapper}>

          {editMode ? (

            <div className={styles.editActions}>

              <button
                className={`${button.btn} ${button.btnSuccess}`}
                onClick={handleSave}
                style={{ 
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
                disabled={!hasChanges || updateMutation.isPending}
              >
                {updateMutation.isPending
                  ? "Сохранение..."
                  : "Сохранить"}
              </button>
              
              <button
                className={`${button.btn} ${button.btnSecondary}`}
                onClick={() => setEditMode(false)}
                style={{ 
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}
              >
                Отмена
              </button>
            </div>

        ) : (

            <>
              {/* DESKTOP ACTIONS */}
              <div className={styles.desktopActions}>

                <button
                  className={`${button.btn} ${button.btnPrimary}`}
                  onClick={() => setEditMode(true)}
                  style={{ 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                   }}
                >
                  Редактировать
                </button>

                <button
                  className={`${button.btn} ${button.btnWarning}`}
                  onClick={handleBlockToggle}
                  style={{ 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                   }}
                >
                  {user?.isBlocked
                    ? "Разблокировать"
                    : "Заблокировать"}
                </button>

                <button
                  className={`${button.btn} ${button.btnDanger}`}
                  onClick={handleDeleteUser}
                  style={{ 
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                   }}
                >
                  Удалить
                </button>

                <button
                  className={`${button.btn} ${button.btnSecondary}`}
                  onClick={handleCloseRequest}
                >
                  Отмена
                </button>

              </div>

              {/* MOBILE ACTIONS */}
              <div className={styles.mobileActions}>

                <div className={styles.mobileRow}>

                  <button
                    className={`${button.btn} ${button.btnDanger}`}
                    onClick={handleBlockToggle}
                    style={{ 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    {user?.isBlocked
                      ? "Разблокировать"
                      : "Заблокировать"}
                  </button>

                  <button
                    className={`${button.btn} ${button.btnDanger}`}
                    onClick={handleDeleteUser}
                    style={{ 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}
                  >
                    Удалить
                  </button>

                </div>

                <button
                  className={`${button.btn} ${button.btnPrimary} ${styles.mobileEdit}`}
                  onClick={() => setEditMode(true)}
                  style={{ 
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                  }}
                >
                  Редактировать
                </button>

              </div>
            </>
          )}

        </div>
      }
    >

      <div className={`${form.form} ${styles.modalForm}`}>

        <div className={styles.gridTwo}>

          <div className={input.field}>
            <label className={input.label}>Логин</label>

            <input
              className={input.input}
              value={username}
              disabled={!editMode}
              onChange={(e) =>
                setUsername(e.target.value)
              }
            />
          </div>

          <div className={input.field}>
            <label className={input.label}>Роль</label>

            {editMode ? (
              <AnimatedSelect
                value={role}
                options={roleOptions}
                onChange={(val) =>
                  setRole(val as UserRole)
                }
              />
            ) : (
              <input
                className={input.input}
                value={role}
                disabled
              />
            )}
          </div>

        </div>

        <div className={input.field}>
          <label className={input.label}>ФИО пользователя</label>

          <input
            className={input.input}
            value={fullName}
            disabled={!editMode}
            onChange={(e) =>
              setFullName(e.target.value)
            }
          />
        </div>
      {editMode && (
        <>
          <div className={input.field}>
            <label className={input.label}>Пароль</label>

            <div style={{ position: "relative" }}>

              <input
                className={input.input}
                type={showPassword ? "text" : "password"}
                value={password}
                disabled={!editMode}
                onChange={(e) =>
                  setPassword(e.target.value)
                }
              />

              {editMode && password.length > 0 && (
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
            <div className={input.field}>
              <label className={input.label}>
                Подтвердите пароль
              </label>

              <div style={{ position: "relative" }}>

                <input
                  className={input.input}
                  type={showPassword ? "text" : "password"}
                  value={confirmPassword}
                  disabled={!editMode}
                  onChange={(e) =>
                    setConfirmPassword(e.target.value)
                  }
                />

                {editMode && confirmPassword.length > 0 && (
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
        </>
      )}


        <div className={`${styles.statusCard} ${styles.gridFull}`}>

          <span className={styles.statusLabel}>
            Статус пользователя
          </span>

          <span data-label="Статус">
            <StatusBadge style={status.style}>
              {status.label}
            </StatusBadge>
          </span>

        </div>

      </div>

    </FormModal>

  )
}