import React, { createContext, useContext, useState, useCallback } from "react";

export interface UserSettings {
    /** BCP-47 language tag used for SpeechRecognition, e.g. "en-US" */
    speechLang: string;
    /** ISO 639-1 code for the target translation language, e.g. "uk". Empty = no translation. */
    translateTo: string;
}

interface UserSettingsContextType {
    settings: UserSettings;
    updateSettings: (partial: Partial<UserSettings>) => void;
}

const STORAGE_KEY = "meetingtime_user_settings";

function loadSettings(): UserSettings {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (raw) return { ...defaultSettings, ...JSON.parse(raw) };
    } catch { /* ignore */ }
    return defaultSettings;
}

const defaultSettings: UserSettings = {
    speechLang: "en-US",
    translateTo: "",
};

export const UserSettingsContext = createContext<UserSettingsContextType>({
    settings: defaultSettings,
    updateSettings: () => {},
});

export const UserSettingsProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [settings, setSettings] = useState<UserSettings>(loadSettings);

    const updateSettings = useCallback((partial: Partial<UserSettings>) => {
        setSettings(prev => {
            const next = { ...prev, ...partial };
            localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
            return next;
        });
    }, []);

    return (
        <UserSettingsContext.Provider value={{ settings, updateSettings }}>
            {children}
        </UserSettingsContext.Provider>
    );
};

export function useUserSettings() {
    return useContext(UserSettingsContext);
}
