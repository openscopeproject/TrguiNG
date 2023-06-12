/**
 * TrguiNG - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2023  qu1ck (mail at qu1ck.org)
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 */

import { execaSync } from "execa";
import path from "path";
import { readFile, writeFile, mkdir } from "fs/promises";
import HtmlWebpackPlugin from "html-webpack-plugin";
import MiniCssExtractPlugin from "mini-css-extract-plugin";
import * as url from "url";

export const __dirname = url.fileURLToPath(new URL(".", import.meta.url));

const tsConfig = JSON.parse(await readFile("./tsconfig.json"));
const tauriConf = JSON.parse(await readFile("./src-tauri/tauri.conf.json"));

const gitVersion = execaSync("git", ["describe", "--tags", "--dirty", "--always"]);
const versionTemplate = `{
    "gitVersion": "${gitVersion.stdout}",
    "backendVersion": "${tauriConf.package.version}",
    "buildDate": ${Date.now()}
}`;

await mkdir(path.join(__dirname, "src/build/"), { recursive: true });
await writeFile(path.resolve(path.join(__dirname, "src/build/version.json")), versionTemplate);

export default (mode) => ({
    mode,
    entry: {
        main: "./src/index.tsx",
        createtorrent: "./src/createtorrent.tsx",
    },
    plugins: [
        new HtmlWebpackPlugin({
            title: "Transmission GUI",
            template: "src/index.html",
            excludeChunks: ["createtorrent"],
            templateParameters: {
                reactDevTools: mode === "production" ? "" : "<script src=\"http://localhost:8097\"></script>",
            },
        }),
        new HtmlWebpackPlugin({
            title: "Create torrent",
            template: "src/index.html",
            filename: "createtorrent.html",
            chunks: ["createtorrent"],
            templateParameters: {
                reactDevTools: mode === "production" ? "" : "<script src=\"http://localhost:8097\"></script>",
            },
        }),
        new MiniCssExtractPlugin({
            filename: "[name].bundle.css",
        }),
    ],
    output: {
        filename: "[name].[contenthash].bundle.js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
    },
    experiments: {
        topLevelAwait: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, "css-loader"],
            },
            {
                test: /\.tsx?$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
            {
                test: /\.svg$/,
                type: "asset/inline",
            },
        ],
        parser: {
            javascript: {
                exportsPresence: "error",
                importExportsPresence: "error",
            },
        },
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        modules: [
            path.resolve(__dirname, "node_modules"),
            path.resolve(__dirname, tsConfig.compilerOptions.baseUrl),
        ],
    },
    // cache: false,
    stats: {
        preset: "normal",
        modulesSpace: 35,
        modulesSort: "!size",
        groupModulesByPath: false,
        groupModulesByExtension: false,
        // moduleAssets: false,
        // orphanModules: true,
    },
    optimization: {
        splitChunks: {
            // include all types of chunks
            chunks: "all",
            cacheGroups: {
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                    name: "vendors/react",
                },
                mantine: {
                    test: /[\\/]node_modules[\\/]@mantine[\\/]/,
                    name: "vendors/mantine",
                },
                tanstack: {
                    test: /[\\/]node_modules[\\/]@tanstack[\\/]/,
                    name: "vendors/tanstack",
                },
                reactdnd: {
                    test: /[\\/]node_modules[\\/]react-beautiful-dnd[\\/]/,
                    name: "vendors/reactdnd",
                },
                tauri: {
                    test: /[\\/]node_modules[\\/]@tauri-apps[\\/]/,
                    name: "vendors/tauri-api",
                },
                icons: {
                    test: /[\\/]node_modules[\\/]react-bootstrap-icons[\\/]/,
                    name: "vendors/bootstrap-icons",
                },
                // other: {
                //     test: /[\\/]node_modules[\\/]/,
                //     priority: -1,
                //     name: "vendors/other",
                // },
            },
        },
        runtimeChunk: "single",
        moduleIds: "deterministic",
    },
});
