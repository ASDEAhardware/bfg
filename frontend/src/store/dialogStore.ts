"use client"
import { create } from 'zustand'

interface ConfirmationDialogState {
  isOpen: boolean
  title: string
  description: string
  onConfirm: () => void
  show: (options: { title: string; description: string; onConfirm: () => void }) => void
  hide: () => void
}

export const useConfirmationDialogStore = create<ConfirmationDialogState>((set) => ({
  isOpen: false,
  title: '',
  description: '',
  onConfirm: () => {},
  show: ({ title, description, onConfirm }) =>
    set({
      isOpen: true,
      title,
      description,
      onConfirm,
    }),
  hide: () =>
    set({
      isOpen: false,
      title: '',
      description: '',
      onConfirm: () => {},
    }),
}))
