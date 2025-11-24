
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import axios from 'axios';
import { toast } from 'sonner';
import { useSettingsStore } from '@/store/settingsStore';
import * as userPreferencesService from '@/services/userPreferences.service';

export function useUserPreferences() {
    return useQuery({
        queryKey: ['userPreferences'],
        staleTime: 1000 * 60 * 5,
        retry: 3,
        queryFn: userPreferencesService.getUserPreferences,
    });
}

export function usePatchResizeHandle() {
    const queryClient = useQueryClient();
    const { setShowResizeHandle } = useSettingsStore();

    return useMutation({
        mutationFn: userPreferencesService.patchUserResizeHandlePreference,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
            queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            setShowResizeHandle(data.show_resize_handle === 'show');
            toast.success("Resize handle preference updated!");
        },
        onError: (error) => {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || "Something went wrong while saving preference.");
            } else {
                toast.error("Something went wrong. Try again later.");
            }
        },
    });
}

export function usePatchAccelerometerUnit() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: userPreferencesService.patchUserAccelerometerPreference,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
            queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            toast.success("Accelerometer unit updated!");
        },
        onError: (error) => {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || "Something went wrong while saving preference.");
            } else {
                toast.error("Something went wrong. Try again later.");
            }
        },
    });
}

export function usePatchInclinometerUnit() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: userPreferencesService.patchInclinometerPreference,
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
            queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            toast.success("Inclinometer unit updated!");
        },
        onError: (error) => {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || "Something went wrong while saving preference.");
            } else {
                toast.error("Something went wrong. Try again later.");
            }
        },
    });
}


/**
 * Hook per salvare la preferenza del tema dell'utente nel backend.
 * Utilizza useMutation per gestire la chiamata API in modo asincrono.
 */
export const usePatchLanguage = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: userPreferencesService.updateUserLanguage,
    onSuccess: () => {
      // Invalida la query delle preferenze utente per mantenere la coerenza
      queryClient.invalidateQueries({ queryKey: ["userPreferences"] });
    },
  });
};