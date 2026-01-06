/**
 * i18n Type Definitions
 *
 * This module provides TypeScript type definitions for the i18n system,
 * ensuring type-safe access to translation keys.
 *
 * @module i18n/types
 */

import type en from "./locales/en.json";

/**
 * Type representing the structure of translation resources
 * Derived from the English translation file (source of truth)
 */
export type TranslationResources = typeof en;

/**
 * Helper type to get nested keys with dot notation
 * e.g., "common.ok" | "settings.title" | "torrent.table.name"
 */
type NestedKeyOf<T, Prefix extends string = ""> = T extends object
    ? {
          [K in keyof T]: K extends string
              ? T[K] extends object
                  ? NestedKeyOf<T[K], `${Prefix}${K}.`>
                  : `${Prefix}${K}`
              : never;
      }[keyof T]
    : never;

/**
 * All available translation keys in dot notation
 */
export type TranslationKey = NestedKeyOf<TranslationResources>;

/**
 * Translation namespace types
 */
export type TranslationNamespace = keyof TranslationResources;

/**
 * Common namespace keys
 */
export type CommonKey = keyof TranslationResources["common"];

/**
 * Settings namespace keys
 */
export type SettingsKey = NestedKeyOf<TranslationResources["settings"]>;

/**
 * Torrent namespace keys
 */
export type TorrentKey = NestedKeyOf<TranslationResources["torrent"]>;

/**
 * Modals namespace keys
 */
export type ModalsKey = NestedKeyOf<TranslationResources["modals"]>;

/**
 * Errors namespace keys
 */
export type ErrorsKey = keyof TranslationResources["errors"];

/**
 * Notifications namespace keys
 */
export type NotificationsKey = keyof TranslationResources["notifications"];

/**
 * Units namespace keys
 */
export type UnitsKey = keyof TranslationResources["units"];

/**
 * Interpolation parameters for translation keys that accept variables
 */
export interface TranslationInterpolation {
    // Remove modal uses {{count}}
    "modals.remove.confirmMultiple": { count: number };

    // Notifications use {{name}}
    "notifications.torrentAdded": { name: string };
    "notifications.torrentCompleted": { name: string };
    "notifications.torrentError": { name: string };
}

/**
 * Type-safe translation function signature
 */
export type TypedTranslateFunction = {
    <K extends TranslationKey>(
        key: K,
        ...args: K extends keyof TranslationInterpolation
            ? [TranslationInterpolation[K]]
            : [Record<string, unknown>?]
    ): string;
};

/**
 * Augment i18next types for better type safety
 * This enables type checking for useTranslation hook
 */
declare module "i18next" {
    interface CustomTypeOptions {
        defaultNS: "translation";
        resources: {
            translation: TranslationResources;
        };
    }
}

/**
 * Language detection result type
 */
export interface LanguageDetectionResult {
    /** The detected language code */
    language: string;
    /** Whether the language was detected from user preference */
    fromPreference: boolean;
    /** Whether the language was detected from browser settings */
    fromBrowser: boolean;
    /** Whether the default fallback was used */
    isDefault: boolean;
}

/**
 * Language configuration type
 */
export interface LanguageConfig {
    /** Current language code */
    current: string;
    /** Whether the language was auto-detected */
    detected: boolean;
    /** List of supported language codes */
    supported: readonly string[];
}
