import { create } from 'zustand';

interface ConfirmModalState {
  isOpen: boolean;
  title: string;
  message: string;
  confirmText: string;
  cancelText: string;
  onConfirm?: () => void;
  open: (config: {
    title: string;
    message: string;
    confirmText?: string;
    cancelText?: string;
    onConfirm: () => void;
  }) => void;
  close: () => void;
}

export const useConfirmModalStore = create<ConfirmModalState>((set) => ({
  isOpen: false,
  title: '',
  message: '',
  confirmText: 'Подтвердить',
  cancelText: 'Отмена',

  open: ({ title, message, confirmText, cancelText, onConfirm }) =>
    set({
      isOpen: true,
      title,
      message,
      confirmText: confirmText ?? 'Подтвердить',
      cancelText: cancelText ?? 'Отмена',
      onConfirm,
    }),

  close: () =>
    set({
      isOpen: false,
      title: '',
      message: '',
      confirmText: 'Подтвердить',
      cancelText: 'Отмена',
      onConfirm: undefined,
    }),
}));