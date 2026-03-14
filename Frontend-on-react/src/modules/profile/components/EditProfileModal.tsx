import { useEffect, useState } from "react"

import { FormModal } from "@/shared/ui/modal/FormModal"
import { useConfirmModalStore } from "@/shared/ui/modal/modal.store"

import { useProfile } from "../hooks/use-profile"
import { useUpdateProfile } from "../hooks/use-update-profile"

import input from "@/shared/ui/input.module.css"
import button from "@/shared/ui/button.module.css"

interface Props {
  isOpen: boolean
  onClose: () => void
}

export function EditProfileModal({
  isOpen,
  onClose
}: Props) {

  const profileQuery = useProfile()
  const updateMutation = useUpdateProfile()

  const openConfirm = useConfirmModalStore(s => s.open)

  const [fullName, setFullName] = useState("")
  const [initialFullName, setInitialFullName] = useState("")

  useEffect(() => {

    if (!profileQuery.data) return

    setFullName(profileQuery.data.fullName)
    setInitialFullName(profileQuery.data.fullName)

  }, [profileQuery.data, isOpen])

  const hasChanges =
    fullName.trim() &&
    fullName !== initialFullName

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

    if (!fullName.trim()) return

    updateMutation.mutate(
      { fullName },
      { onSuccess: onClose }
    )

  }

  return (

    <FormModal
      isOpen={isOpen}
      onClose={handleCloseRequest}
      title="Редактирование профиля"
      size="sm"

      footer={

        <div style={{ display: "flex", gap: 10 }}>

          <button
            className={`${button.btn} ${button.btnSecondary}`}
            onClick={handleCloseRequest}
          >
            Отмена
          </button>

          <button
            className={`${button.btn} ${button.btnSuccess}`}
            onClick={handleSave}
            disabled={!hasChanges}
          >
            {updateMutation.isPending
              ? "Сохранение..."
              : "Сохранить"}
          </button>

        </div>

      }

    >

      <div className={input.field}>

        <label className={input.label}>
          Полное имя
        </label>

        <input
          className={input.input}
          value={fullName}
          onChange={(e) =>
            setFullName(e.target.value)
          }
        />

      </div>

    </FormModal>
  )
}