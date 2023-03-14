const path = require('path');
const { compilerOptions } = require('./tsconfig.json');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = {
    entry: './src/index.tsx',
    mode: 'development',
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Transmission Remote GUI',
            template: 'src/index.html',
        }),
        new MiniCssExtractPlugin({
            filename: "bundle.css"
        }),
    ],
    output: {
        filename: 'bundle.js',
        path: path.resolve(__dirname, 'dist'),
        clean: true,
    },
    module: {
        rules: [
            {
                test: /\.css$/i,
                use: [MiniCssExtractPlugin.loader, 'css-loader'],
            },
            {
                test: /\.tsx?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.tsx', '.ts', '.js'],
        modules: [
            path.resolve(__dirname, 'node_modules'),
            path.resolve(__dirname, compilerOptions.baseUrl),
        ],
    },
    cache: false,
    stats: {
        preset: 'normal',
        modulesSpace: 35,
        modulesSort: '!size',
        groupModulesByPath: false,
        groupModulesByExtension: false,
        //moduleAssets: false,
        //orphanModules: true,
    },
    optimization: {
        minimize: false,
    },
    devtool: 'source-map',
    devServer: {
        static: './dist',
        client: {
            overlay: true,
            progress: true,
        },
    },
};
