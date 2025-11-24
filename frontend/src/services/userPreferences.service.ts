import { api } from '@/lib/axios'
import { ShowResizeHandle, AccelerometerUnit, InclinometerUnit } from '@/types/index'
import { AccelerometerUnitPreferencePayload, InclinometerUnitPreferencePayload, userPreferencesPayload } from '@/types/userPreferences'

//TODO: ELIMINARE
export const updateUserPreferences = async (newPreferences: userPreferencesPayload) => {
    const response = await api.patch('preferences/', newPreferences);
    return response.data;
}

export const patchUserResizeHandlePreference = async (resizeHandlePref: ShowResizeHandle) => {
    const response = await api.patch('preferences/resize-handle/', {show_resize_handle: resizeHandlePref});
    return response.data
}

export const patchUserAccelerometerPreference = async (accelerometerPref: AccelerometerUnit) => {
    const response = await api.patch('preferences/accelerometer-unit/', {accelerometer_unit: accelerometerPref});
    return response.data
}

export const patchInclinometerPreference = async (inclinometerPref: InclinometerUnit) => {
    const response = await api.patch('preferences/inclinometer-unit/', {inclinometer_unit: inclinometerPref});
    return response.data
}

export const getUserPreferences = async () => {
    const response = await api.get('preferences/');
    return response.data;
}

