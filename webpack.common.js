/**
 * transgui-ng - next gen remote GUI for transmission torrent daemon
 * Copyright (C) 2022  qu1ck (mail at qu1ck.org)
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

const path = require("path");
const { compilerOptions } = require("./tsconfig.json");
const HtmlWebpackPlugin = require("html-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (mode) => ({
    mode,
    entry: "./src/index.tsx",
    plugins: [
        new HtmlWebpackPlugin({
            title: "Transmission Remote GUI",
            template: "src/index.html",
            templateParameters: {
                reactDevTools: mode === "production" ? "" : "<script src=\"http://localhost:8097\"></script>",
            },
        }),
        new MiniCssExtractPlugin({
            filename: "[name].bundle.css",
        }),
    ],
    output: {
        filename: "[name].bundle.js",
        path: path.resolve(__dirname, "dist"),
        clean: true,
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
        ],
    },
    resolve: {
        extensions: [".tsx", ".ts", ".js"],
        modules: [
            path.resolve(__dirname, "node_modules"),
            path.resolve(__dirname, compilerOptions.baseUrl),
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
                    name: "react",
                },
                mantine: {
                    test: /[\\/]node_modules[\\/]@mantine[\\/]/,
                    name: "mantine",
                },
                tauri: {
                    test: /[\\/]node_modules[\\/]@tauri-apps[\\/]/,
                    name: "tauri",
                },
                icons: {
                    test: /[\\/]node_modules[\\/]react-bootstrap-icons[\\/]/,
                    name: "bootstrap-icons",
                },
                // other: {
                //     test: /[\\/]node_modules[\\/]/,
                //     priority: -1,
                //     name: "other",
                // },
            },
        },
    },
});
