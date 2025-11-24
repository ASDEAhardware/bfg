export type userPreferencesPayload = {
    theme: 'light' | 'dark' | 'system';
    accelerometer_unit: "ms2" | "g";
    inclinometer_unit: "deg" | "rad";
    show_resize_handle: "show" | "hide";
};

export type ThemePreferencePayload = {
    theme: 'light' | 'dark' | 'system';
};

export type ResizeHandlePreferencePayload = {
    show_resize_handle: "show" | "hide";
};

export type AccelerometerUnitPreferencePayload = {
    accelerometer_unit: "ms2" | "g";
};

export type InclinometerUnitPreferencePayload = {
    inclinometer_unit: "deg" | "rad";
};