#!/usr/bin/env node

/**
 * i18n Translation Coverage Check Script
 *
 * This script compares translation files to ensure all keys are present
 * in all language files. It uses the English (en.json) file as the source
 * of truth and checks that all other language files have matching keys.
 *
 * Usage:
 *   node scripts/check-i18n-coverage.js [--verbose] [--strict]
 *
 * Options:
 *   --verbose  Show all checked keys, not just missing ones
 *   --strict   Exit with error code 1 if any keys are missing
 *
 * Exit codes:
 *   0 - All translations are complete (or --strict not used)
 *   1 - Missing translations found (only with --strict)
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const LOCALES_DIR = path.join(__dirname, "..", "src", "i18n", "locales");
const SOURCE_LANG = "en.json";

// Parse command line arguments
const args = process.argv.slice(2);
const verbose = args.includes("--verbose");
const strict = args.includes("--strict");

/**
 * Recursively extracts all keys from a nested object in dot notation
 * @param {object} obj - The object to extract keys from
 * @param {string} prefix - The current key prefix
 * @returns {string[]} Array of keys in dot notation
 */
function extractKeys(obj, prefix = "") {
    const keys = [];

    for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;

        if (typeof value === "object" && value !== null && !Array.isArray(value)) {
            keys.push(...extractKeys(value, fullKey));
        } else {
            keys.push(fullKey);
        }
    }

    return keys;
}

/**
 * Gets a nested value from an object using dot notation
 * @param {object} obj - The object to get the value from
 * @param {string} path - The path in dot notation
 * @returns {any} The value at the path, or undefined
 */
function getNestedValue(obj, path) {
    return path.split(".").reduce((current, key) => {
        return current && typeof current === "object" ? current[key] : undefined;
    }, obj);
}

/**
 * Main function
 */
function main() {
    console.log("🌐 i18n Translation Coverage Check\n");
    console.log(`📁 Locales directory: ${LOCALES_DIR}`);
    console.log(`📄 Source language: ${SOURCE_LANG}\n`);

    // Check if locales directory exists
    if (!fs.existsSync(LOCALES_DIR)) {
        console.error(`❌ Locales directory not found: ${LOCALES_DIR}`);
        process.exit(1);
    }

    // Read source language file
    const sourcePath = path.join(LOCALES_DIR, SOURCE_LANG);
    if (!fs.existsSync(sourcePath)) {
        console.error(`❌ Source language file not found: ${sourcePath}`);
        process.exit(1);
    }

    let sourceData;
    try {
        sourceData = JSON.parse(fs.readFileSync(sourcePath, "utf8"));
    } catch (error) {
        console.error(`❌ Failed to parse ${SOURCE_LANG}: ${error.message}`);
        process.exit(1);
    }

    const sourceKeys = extractKeys(sourceData);
    console.log(`📊 Source file has ${sourceKeys.length} translation keys\n`);

    // Get all language files
    const langFiles = fs.readdirSync(LOCALES_DIR)
        .filter(f => f.endsWith(".json") && f !== SOURCE_LANG);

    if (langFiles.length === 0) {
        console.log("⚠️  No other language files found to compare.\n");
        process.exit(0);
    }

    let hasIssues = false;
    const results = [];

    // Check each language file
    for (const langFile of langFiles) {
        const langPath = path.join(LOCALES_DIR, langFile);
        const langCode = langFile.replace(".json", "");

        console.log(`🔍 Checking ${langFile}...`);

        let langData;
        try {
            langData = JSON.parse(fs.readFileSync(langPath, "utf8"));
        } catch (error) {
            console.error(`   ❌ Failed to parse: ${error.message}`);
            hasIssues = true;
            continue;
        }

        const langKeys = extractKeys(langData);
        const missingKeys = sourceKeys.filter(key => !langKeys.includes(key));
        const extraKeys = langKeys.filter(key => !sourceKeys.includes(key));
        const emptyKeys = langKeys.filter(key => {
            const value = getNestedValue(langData, key);
            return value === "" || value === null;
        });

        const coverage = ((langKeys.length - extraKeys.length) / sourceKeys.length * 100).toFixed(1);

        results.push({
            language: langCode,
            total: langKeys.length,
            missing: missingKeys.length,
            extra: extraKeys.length,
            empty: emptyKeys.length,
            coverage: parseFloat(coverage),
        });

        if (missingKeys.length === 0 && extraKeys.length === 0 && emptyKeys.length === 0) {
            console.log(`   ✅ Complete! ${langKeys.length} keys, 100% coverage\n`);
        } else {
            hasIssues = true;
            console.log(`   📊 Coverage: ${coverage}%`);

            if (missingKeys.length > 0) {
                console.log(`   ❌ Missing ${missingKeys.length} keys:`);
                missingKeys.slice(0, verbose ? undefined : 10).forEach(key => {
                    console.log(`      - ${key}`);
                });
                if (!verbose && missingKeys.length > 10) {
                    console.log(`      ... and ${missingKeys.length - 10} more`);
                }
            }

            if (extraKeys.length > 0) {
                console.log(`   ⚠️  Extra ${extraKeys.length} keys (not in source):`);
                extraKeys.slice(0, verbose ? undefined : 5).forEach(key => {
                    console.log(`      - ${key}`);
                });
                if (!verbose && extraKeys.length > 5) {
                    console.log(`      ... and ${extraKeys.length - 5} more`);
                }
            }

            if (emptyKeys.length > 0) {
                console.log(`   ⚠️  Empty ${emptyKeys.length} values:`);
                emptyKeys.slice(0, verbose ? undefined : 5).forEach(key => {
                    console.log(`      - ${key}`);
                });
                if (!verbose && emptyKeys.length > 5) {
                    console.log(`      ... and ${emptyKeys.length - 5} more`);
                }
            }

            console.log("");
        }
    }

    // Print summary
    console.log("═".repeat(50));
    console.log("📊 Summary\n");
    console.log("Language     | Keys   | Missing | Extra  | Empty  | Coverage");
    console.log("-------------|--------|---------|--------|--------|----------");

    for (const result of results) {
        const status = result.coverage === 100 && result.extra === 0 && result.empty === 0 ? "✅" : "❌";
        console.log(
            `${result.language.padEnd(12)} | ${String(result.total).padStart(6)} | ${String(result.missing).padStart(7)} | ${String(result.extra).padStart(6)} | ${String(result.empty).padStart(6)} | ${result.coverage.toFixed(1).padStart(6)}% ${status}`
        );
    }

    console.log("\n" + "═".repeat(50));

    if (hasIssues) {
        console.log("\n⚠️  Some translations need attention.\n");
        if (strict) {
            process.exit(1);
        }
    } else {
        console.log("\n✅ All translations are complete!\n");
    }
}

// Run the script
main();
