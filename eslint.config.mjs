import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import { fixupPluginRules } from "@eslint/compat";
import globals from "globals";
import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import love from "eslint-config-love";
import reactRecommended from "eslint-plugin-react/configs/recommended.js";
import stylistic from "@stylistic/eslint-plugin";


export default tseslint.config(
    eslint.configs.recommended,
    tseslint.configs.recommended,
    {
        ...love,
        ...reactRecommended,
        files: ["src/**/*.ts", "src/**/*.tsx", "*.mjs"],

        plugins: {
            react,
            "react-hooks": fixupPluginRules(reactHooks),
            "@stylistic": stylistic,
        },

        languageOptions: {
            globals: {
                ...globals.browser,
            },
            ecmaVersion: "latest",
            sourceType: "module",
            parserOptions: {
                project: ["./tsconfig.json"],
            },
        },

        settings: {
            react: {
                version: "detect",
            },
        },

        rules: {
            "import/no-webpack-loader-syntax": "off",
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "error",
            "@stylistic/indent": ["error", 4],
            "@stylistic/semi": ["error", "always"],
            "@stylistic/no-extra-semi": "error",
            "@stylistic/quotes": ["error", "double"],
            "@stylistic/comma-dangle": ["error", "always-multiline"],
            "@stylistic/space-before-function-paren": "off",

            "@stylistic/member-delimiter-style": ["error", {
                multiline: {
                    delimiter: "comma",
                    requireLast: true,
                },

                singleline: {
                    delimiter: "comma",
                    requireLast: false,
                },

                multilineDetection: "brackets",
            }],

            "@typescript-eslint/explicit-function-return-type": "off",
            "@typescript-eslint/consistent-type-imports": ["error", {
                prefer: "type-imports",
                disallowTypeAnnotations: true,
                fixStyle: "separate-type-imports",
            }],
        },
    },
);