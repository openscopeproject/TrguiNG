/**
 * Language Information Constants
 *
 * This module defines the available languages and their metadata
 * for the TrguiNG application.
 *
 * @module i18n/languages
 */

import type { Resource, ResourceLanguage } from "i18next";
import en from "./locales/en.json";
import zhHans from "./locales/zh-Hans.json";
import zhHant from "./locales/zh-Hant.json";

export const SUPPORTED_LANGUAGES = {
    "en": { name: "English", nativeName: "English", translation: en },
    "zh-Hans": { name: "Chinese (Simplified)", nativeName: "简体中文", translation: zhHans },
    "zh-Hant": { name: "Chinese (Traditional)", nativeName: "繁體中文", translation: zhHant },
} as const;

export type SupportedLanguage = keyof typeof SUPPORTED_LANGUAGES;

/** Default fallback language code */
export const DEFAULT_LANGUAGE: SupportedLanguage = "en";

export const resources: Resource = (
    Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]
).reduce((acc, code) => {
    acc[code] = { translation: SUPPORTED_LANGUAGES[code].translation as ResourceLanguage };
    return acc;
}, {} as Resource);

/**
 * Language information with display properties
 */
export interface LanguageInfo {
    /** Language code (e.g., "en", "zh-CN") */
    code: SupportedLanguage,
    /** English name of the language */
    name: string,
    /** Native name of the language (displayed in language selector) */
    nativeName: string,
    /** Whether this is the default fallback language */
    isDefault: boolean,
}

/**
 * List of available languages with their display information
 * This is used to populate language selection UI components
 */
export const availableLanguages: readonly LanguageInfo[] = (
    Object.keys(SUPPORTED_LANGUAGES) as SupportedLanguage[]
).map((code) => ({
    code,
    name: SUPPORTED_LANGUAGES[code].name,
    nativeName: SUPPORTED_LANGUAGES[code].nativeName,
    isDefault: code === DEFAULT_LANGUAGE,
}));

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
    return (
        availableLanguages.find((lang) => lang.code === DEFAULT_LANGUAGE) ??
        availableLanguages[0]
    );
}

/**
 * Converts available languages to a format suitable for Mantine Select component
 * @returns Array of {value, label} objects for Select component
 */
export function getLanguageSelectData(): Array<{ value: SupportedLanguage; label: string }> {
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
