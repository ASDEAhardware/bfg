
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '@/lib/axios';
import axios from 'axios';
import { toast } from 'sonner';
import { useSettingsStore } from '@/store/settingsStore';
import { useTheme } from 'next-themes';

export function useUserPreferences() {
    return useQuery({
        queryKey: ['userPreferences'],
        queryFn: async () => {
            const response = await api.get('preferences/');
            return response.data;
        },
    });
}

export function useUpdateUserPreferences() {
    const queryClient = useQueryClient();
    const { setShowResizeHandle } = useSettingsStore();
    const { setTheme } = useTheme();

    return useMutation({
        mutationFn: async (newPreferences: {
            theme: string;
            accelerometer_unit: string;
            inclinometer_unit: string;
            show_resize_handle: string;
        }) => {
            const response = await api.patch('preferences/', newPreferences);
            return response.data;
        },
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
