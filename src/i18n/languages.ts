/**
 * Language Information Constants
 *
 * This module defines the available languages and their metadata
 * for the TrguiNG application.
 *
 * @module i18n/languages
 */

import { SUPPORTED_LANGUAGES, type SupportedLanguage } from "./index";

/**
 * Language information with display properties
 */
export interface LanguageInfo {
    /** Language code (e.g., "en", "zh-CN") */
    code: SupportedLanguage;
    /** English name of the language */
    name: string;
    /** Native name of the language (displayed in language selector) */
    nativeName: string;
    /** Whether this is the default fallback language */
    isDefault: boolean;
}

/**
 * List of available languages with their display information
 * This is used to populate language selection UI components
 */
export const availableLanguages: readonly LanguageInfo[] = [
    {
        code: "en",
        name: "English",
        nativeName: "English",
        isDefault: true,
    },
    {
        code: "zh-CN",
        name: "Chinese (Simplified)",
        nativeName: "简体中文",
        isDefault: false,
    },
] as const;

/**
 * Gets language information by code
 * @param code - The language code to look up
 * @returns Language info or undefined if not found
 */
export function getLanguageInfo(code: string): LanguageInfo | undefined {
    return availableLanguages.find((lang) => lang.code === code);
}

/**
 * Gets the default language info
 * @returns The default language information
 */
export function getDefaultLanguage(): LanguageInfo {
    return availableLanguages.find((lang) => lang.isDefault) ?? availableLanguages[0];
}

/**
 * Converts available languages to a format suitable for Mantine Select component
 * @returns Array of {value, label} objects for Select component
 */
export function getLanguageSelectData(): Array<{ value: string; label: string }> {
    return availableLanguages.map((lang) => ({
        value: lang.code,
        label: lang.nativeName,
    }));
}

/**
 * Validates if a language code is supported
 * @param code - The language code to validate
 * @returns True if the language is supported
 */
export function isValidLanguageCode(code: string): code is SupportedLanguage {
    return code in SUPPORTED_LANGUAGES;
}
