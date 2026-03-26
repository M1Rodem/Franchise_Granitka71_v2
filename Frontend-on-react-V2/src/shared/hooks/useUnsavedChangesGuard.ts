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
      confirmText: "Выйти",
      cancelText: "Отмена",

      onConfirm: () => {
        closeModal();
        blocker.proceed();
      },

      onCancel: () => {
        closeModal();
        blocker.reset();
      },
    });

  }, [blocker, openModal, closeModal, shouldBlock]);

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