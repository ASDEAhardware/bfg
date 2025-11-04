
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import axios from 'axios';
import { toast } from 'sonner';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from 'next-themes';
import * as userPreferencesService from '@/services/userPreferences.service'

export function useUserPreferences() {
    return useQuery({
        queryKey: ['userPreferences'],
        staleTime: 1000 * 60 * 5,
        retry: 3,
        queryFn: userPreferencesService.getUserPreferences,
    });
}

export function useUpdateUserPreferences() {
    const queryClient = useQueryClient();
    const { setShowResizeHandle } = useSettingsStore();
    const { setTheme } = useTheme();

    return useMutation({
        mutationFn: userPreferencesService.updateUserPreferences,
        onSuccess: (data) => {
            queryClient.invalidateQueries({ queryKey: ['userPreferences'] });
            queryClient.invalidateQueries({ queryKey: ['userInfo'] });
            setShowResizeHandle(data.show_resize_handle === 'show');
            setTheme(data.theme);
            toast.success("Appearance settings saved successfully!");
        },
        onError: (error) => {
            if (axios.isAxiosError(error)) {
                toast.error(error.response?.data?.error || "Something went wrong while saving preferences.");
            } else {
                toast.error("Something went wrong. Try again later.");
            }
        },
    });
}
