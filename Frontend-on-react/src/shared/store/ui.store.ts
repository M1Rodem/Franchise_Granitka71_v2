import { create } from 'zustand';

interface UiStoreState {
  isSidebarCollapsed: boolean;
  isMobileSidebarOpen: boolean;
  toggleSidebar: () => void;
  setSidebarCollapsed: (isCollapsed: boolean) => void;
  openMobileSidebar: () => void;
  closeMobileSidebar: () => void;
  setMobileSidebarOpen: (isOpen: boolean) => void;
}

export const useUiStore = create<UiStoreState>((set) => ({
  isSidebarCollapsed: false,
  isMobileSidebarOpen: false,
  toggleSidebar: () => set((state) => ({ isSidebarCollapsed: !state.isSidebarCollapsed })),
  setSidebarCollapsed: (isCollapsed) => set({ isSidebarCollapsed: isCollapsed }),
  openMobileSidebar: () => set({ isMobileSidebarOpen: true }),
  closeMobileSidebar: () => set({ isMobileSidebarOpen: false }),
  setMobileSidebarOpen: (isOpen) => set({ isMobileSidebarOpen: isOpen }),
}));