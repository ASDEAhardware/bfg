"use client"

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useConfirmationDialogStore } from "@/store/dialogStore"
import { useTranslations } from "next-intl";

export function GlobalConfirmationDialog() {
  const { isOpen, title, description, onConfirm, hide } = useConfirmationDialogStore();

  const t = useTranslations('components');

  const handleConfirm = () => {
    onConfirm();
    hide();
  };

  const handleCancel = () => {
    hide();
  };

  return (
    <AlertDialog open={isOpen} onOpenChange={hide}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={handleCancel}>{t('show_confirmation_dialog.cancel')}</AlertDialogCancel>
          <AlertDialogAction onClick={handleConfirm}>{t('show_confirmation_dialog.confirm')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
