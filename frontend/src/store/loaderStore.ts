import { create } from 'zustand';

interface PageLoaderState {
  isLoading: boolean;
  show: () => void;
  hide: () => void;
}

export const usePageLoaderStore = create<PageLoaderState>((set) => ({
  isLoading: false,
  show: () => set({ isLoading: true }),
  hide: () => set({ isLoading: false }),
}));
