/**
 * i18n (Internationalization) Module
 *
 * This module initializes and configures i18next for the TrguiNG application.
 * It supports both Tauri (native) and Web modes with appropriate language detection
 * and persistence strategies.
 *
 * @module i18n
 */

import i18n from "i18next";
import { initReactI18next, useTranslation } from "react-i18next";

import en from "./locales/en.json";

/**
 * Custom error class for invalid language codes
 */
export class InvalidLanguageError extends Error {
    constructor(language: string) {
        super(`Invalid language code: ${language}. Supported languages: ${Object.keys(SUPPORTED_LANGUAGES).join(", ")}`);
        this.name = "InvalidLanguageError";
    }
}
import zhCN from "./locales/zh-CN.json";

// Supported languages configuration
export const SUPPORTED_LANGUAGES = {
    en: { name: "English", nativeName: "English" },
    "zh-CN": { name: "Chinese (Simplified)", nativeName: "简体中文" },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

// LocalStorage key for Web mode language persistence
const LANGUAGE_STORAGE_KEY = "trguiNG-language";

/**
 * Detects whether the application is running in Tauri (native) mode
 */
export function isTauriMode(): boolean {
    return typeof window !== "undefined" && "__TAURI__" in window;
}

/**
 * Detects the user's preferred language from browser settings
 */
function detectBrowserLanguage(): SupportedLanguage {
    if (typeof navigator === "undefined") {
        return DEFAULT_LANGUAGE;
    }

    const browserLang = navigator.language || (navigator as any).userLanguage;

    // Check for exact match first
    if (browserLang in SUPPORTED_LANGUAGES) {
        return browserLang as SupportedLanguage;
    }

    // Check for language without region (e.g., "zh" matches "zh-CN")
    const langWithoutRegion = browserLang.split("-")[0];
    for (const supportedLang of Object.keys(SUPPORTED_LANGUAGES)) {
        if (supportedLang.startsWith(langWithoutRegion)) {
            return supportedLang as SupportedLanguage;
        }
    }

    return DEFAULT_LANGUAGE;
}

/**
 * Maps a locale string to a supported language with fallback logic
 * @param locale - BCP 47 language tag (e.g., "en-US", "zh-CN", "zh-TW")
 * @returns The matching supported language or default
 */
function mapLocaleToSupportedLanguage(locale: string): SupportedLanguage {
    // Normalize the locale (some systems use underscore instead of hyphen)
    const normalizedLocale = locale.replace("_", "-");

    // Check for exact match first
    if (normalizedLocale in SUPPORTED_LANGUAGES) {
        return normalizedLocale as SupportedLanguage;
    }

    // Check for language without region (e.g., "zh" matches "zh-CN")
    const langWithoutRegion = normalizedLocale.split("-")[0];
    for (const supportedLang of Object.keys(SUPPORTED_LANGUAGES)) {
        if (supportedLang.startsWith(langWithoutRegion)) {
            return supportedLang as SupportedLanguage;
        }
    }

    return DEFAULT_LANGUAGE;
}

/**
 * Detects the system locale in Tauri mode using Rust backend
 * Falls back to browser detection if Tauri command fails
 */
async function detectSystemLanguage(): Promise<SupportedLanguage> {
    if (isTauriMode()) {
        try {
            // Dynamic import to avoid errors in non-Tauri environments
            const { invoke } = await import("@tauri-apps/api/core");
            const systemLocale = await invoke<string>("get_system_locale");
            return mapLocaleToSupportedLanguage(systemLocale);
        } catch (e) {
            console.warn("[i18n] Failed to detect system locale via Tauri, falling back to browser detection:", e);
        }
    }

    // Fall back to browser detection
    return detectBrowserLanguage();
}

/**
 * Gets the stored language preference (Web mode only)
 */
function getStoredLanguage(): SupportedLanguage | null {
    if (typeof localStorage === "undefined") {
        return null;
    }

    try {
        const stored = localStorage.getItem(LANGUAGE_STORAGE_KEY);
        if (stored && stored in SUPPORTED_LANGUAGES) {
            return stored as SupportedLanguage;
        }
    } catch {
        // localStorage may be unavailable (e.g., in private mode)
    }

    return null;
}

/**
 * Stores the language preference (Web mode only)
 */
function storeLanguage(language: SupportedLanguage): void {
    if (typeof localStorage === "undefined") {
        return;
    }

    try {
        localStorage.setItem(LANGUAGE_STORAGE_KEY, language);
    } catch {
        // localStorage may be unavailable
    }
}

/**
 * Gets the initial language for the application
 *
 * Priority:
 * 1. Stored preference (localStorage in Web mode, Config in Tauri mode)
 * 2. Browser/system language detection
 * 3. Default language (English)
 *
 * Note: For Tauri mode, the config-based language preference should be
 * passed to initializeI18n() after loading the config.
 */
function getInitialLanguage(): SupportedLanguage {
    // Check stored preference first (Web mode)
    const stored = getStoredLanguage();
    if (stored) {
        return stored;
    }

    // Detect from browser
    return detectBrowserLanguage();
}

/**
 * Translation resources organized by language
 */
const resources = {
    en: { translation: en },
    "zh-CN": { translation: zhCN },
};

/**
 * Initializes the i18n instance
 *
 * @param configLanguage - Optional language from Tauri config (native mode)
 * @param languageDetected - Whether language was already detected (to prevent re-detection)
 * @returns Promise that resolves when i18n is initialized
 */
export async function initializeI18n(configLanguage?: SupportedLanguage, languageDetected = false): Promise<typeof i18n> {
    // Determine initial language
    let initialLanguage: SupportedLanguage;

    if (configLanguage && configLanguage in SUPPORTED_LANGUAGES) {
        // Use config language (user preference or previously detected)
        initialLanguage = configLanguage;
    } else if (!languageDetected) {
        // First launch: detect system language
        initialLanguage = await detectSystemLanguage();
    } else {
        // Fallback: use browser detection (Web mode)
        initialLanguage = getInitialLanguage();
    }

    await i18n
        .use(initReactI18next)
        .init({
            resources,
            lng: initialLanguage,
            fallbackLng: DEFAULT_LANGUAGE,
            supportedLngs: Object.keys(SUPPORTED_LANGUAGES),

            interpolation: {
                escapeValue: false, // React already escapes values
            },

            // Namespace configuration
            ns: ["translation"],
            defaultNS: "translation",

            // React specific options
            react: {
                useSuspense: true,
            },

            // Development helpers
            debug: process.env.NODE_ENV === "development",

            // Missing key handling
            saveMissing: false,
            missingKeyHandler: (lngs, ns, key) => {
                if (process.env.NODE_ENV === "development") {
                    console.warn(`[i18n] Missing translation key: ${key} (${lngs.join(", ")})`);
                }
            },
        });

    return i18n;
}

/**
 * Changes the application language
 *
 * @param language - The language to switch to
 * @throws {InvalidLanguageError} When an unsupported language code is provided
 * @returns Promise that resolves when the language is changed
 */
export async function changeLanguage(language: string): Promise<void> {
    if (!(language in SUPPORTED_LANGUAGES)) {
        throw new InvalidLanguageError(language);
    }

    const validLanguage = language as SupportedLanguage;
    await i18n.changeLanguage(validLanguage);

    // Store preference in Web mode
    if (!isTauriMode()) {
        storeLanguage(validLanguage);
    }

    // Update document lang attribute for accessibility
    if (typeof document !== "undefined") {
        document.documentElement.lang = validLanguage;
    }
}

/**
 * Gets the current language
 */
export function getCurrentLanguage(): SupportedLanguage {
    return (i18n.language as SupportedLanguage) || DEFAULT_LANGUAGE;
}

/**
 * Checks if a language is supported
 */
export function isLanguageSupported(language: string): language is SupportedLanguage {
    return language in SUPPORTED_LANGUAGES;
}

/**
 * Gets the list of supported languages with their display names
 */
export function getSupportedLanguages(): Array<{
    code: SupportedLanguage;
    name: string;
    nativeName: string;
}> {
    return Object.entries(SUPPORTED_LANGUAGES).map(([code, info]) => ({
        code: code as SupportedLanguage,
        name: info.name,
        nativeName: info.nativeName,
    }));
}

// Re-export useTranslation hook for React components
export { useTranslation };

// Export the i18n instance for direct access if needed
export { i18n };

// Default export for convenience
export default i18n;
