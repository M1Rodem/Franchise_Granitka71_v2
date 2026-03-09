import { useEffect } from "react";
import { useBlocker } from "react-router-dom";
import { useConfirmModalStore } from "@/shared/ui/modal/modal.store";

export function useUnsavedChangesGuard(shouldBlock: boolean) {
  const blocker = useBlocker(shouldBlock);

  const openModal = useConfirmModalStore((s) => s.open);
  const closeModal = useConfirmModalStore((s) => s.close);

  useEffect(() => {
    if (blocker.state !== "blocked") return;

    openModal({
      title: "У вас есть несохраненные изменения",
      message: "Если вы покинете страницу, изменения будут потеряны.",
      confirmText: "Уйти",
      cancelText: "Остаться",

      onConfirm: () => {
        closeModal();
        blocker.proceed();
      },

      // добавь это в store open config
      onCancel: () => {
        closeModal();
        blocker.reset();
      },
    });

  }, [blocker, openModal, closeModal]);

  useEffect(() => {
    if (!shouldBlock) return;

    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };

    window.addEventListener("beforeunload", handler);

    return () => window.removeEventListener("beforeunload", handler);
  }, [shouldBlock]);
}