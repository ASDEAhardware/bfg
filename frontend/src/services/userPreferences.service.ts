import { api } from '@/lib/axios'
import { userPreferencesPayload } from '@/types/userPreferences'

export const updateUserPreferences = async (newPreferences: userPreferencesPayload) => {
    const response = await api.patch('preferences/', newPreferences);
    return response.data;
}

export const getUserPreferences = async () => {
    const response = await api.get('preferences/');
    return response.data;
}