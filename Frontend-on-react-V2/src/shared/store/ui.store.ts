import { create } from 'zustand';

type HeaderMode =
  | 'default'
  | 'orderDetails'
  | 'adminDetails'
  | 'orderCreate'
  | 'orderEdit'
  | 'plots'
  | "users"
  | 'managerFinance';

interface HeaderState {
  mode: HeaderMode;
  title: string;
  orderNumber?: string;
  submitDisabled?: boolean;
}

interface UiStoreState {
  // Sidebar
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;

  // Header
  header: HeaderState;
  setDefaultHeader: (title: string) => void;
  setOrderDetailsHeader: (orderNumber: string) => void;
  resetHeader: () => void;
  setOrderCreateHeader: () => void;
  setOrderEditHeader: (orderNumber: string) => void;
  setHeaderSubmitDisabled: (disabled: boolean) => void;
  setPlotsHeader: () => void

  plotCreateOpen: boolean
  openPlotCreateModal: () => void
  closePlotCreateModal: () => void

  isUserCreateModalOpen: boolean
  openUserCreateModal: () => void
  closeUserCreateModal: () => void
}

export const useUiStore = create<UiStoreState>((set) => ({
  // Sidebar
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  toggleSidebar: () =>
    set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (isCollapsed) =>
    set({ isSidebarCollapsed: isCollapsed }),
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
  setMobileSidebarOpen: (isOpen) =>
    set({ isMobileSidebarOpen: isOpen }),

  // Header
  header: {
    mode: 'default',
    title: 'Granitka71',
    submitDisabled: true,
  },

  setDefaultHeader: (title) =>
    set({
      header: {
        mode: 'default',
        title,
      },
    }),

  setOrderDetailsHeader: (orderNumber) =>
    set({
      header: {
        mode: 'orderDetails',
        title: 'Просмотр заказа',
        orderNumber,
      },
    }),

  setOrderCreateHeader: () =>
    set({
      header: {
        mode: 'orderCreate',
        title: 'Создать заказ',
        submitDisabled: true
      },
    }),

  setOrderEditHeader: (orderNumber) =>
    set({
      header: {
        mode: 'orderEdit',
        title: 'Редактировать заказ',
        orderNumber,
        submitDisabled: true,
      },
    }),

  setHeaderSubmitDisabled: (disabled) =>
    set((state) => {
      if (state.header.submitDisabled === disabled) return state

      return {
        header: {
          ...state.header,
          submitDisabled: disabled,
        },
      }
    }),

  resetHeader: () =>
    set({
      header: {
        mode: 'default',
        title: 'Granitka71',
      },
    }),
  setPlotsHeader: () =>
  set({
    header: {
      mode: 'plots',
      title: 'Участки',
    },
  }),

  plotCreateOpen: false,

  openPlotCreateModal: () =>
    set({ plotCreateOpen: true }),

  closePlotCreateModal: () =>
    set({ plotCreateOpen: false }),

  isUserCreateModalOpen: false,

  openUserCreateModal: () =>
    set({ isUserCreateModalOpen: true }),

  closeUserCreateModal: () =>
    set({ isUserCreateModalOpen: false }),
}));