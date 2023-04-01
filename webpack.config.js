const path = require('path');
const { compilerOptions } = require('./tsconfig.json');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const MiniCssExtractPlugin = require("mini-css-extract-plugin");
const BundleAnalyzerPlugin = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;

module.exports = {
    entry: './src/index.tsx',
    mode: 'development',
    //mode: 'production',
    plugins: [
        new HtmlWebpackPlugin({
            title: 'Transmission Remote GUI',
            template: 'src/index.html',
        }),
        new MiniCssExtractPlugin({
            filename: "[name].bundle.css"
        }),
        new BundleAnalyzerPlugin({
            analyzerMode: 'static',
            openAnalyzer: false,
            reportFilename: path.resolve(__dirname, 'webpack-report.html')
        }),
    ],
    output: {
        filename: '[name].bundle.js',
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
        // minimize: false,
        splitChunks: {
            // include all types of chunks
            chunks: 'all',
            cacheGroups: {
                react: {
                    test: /[\\/]node_modules[\\/](react|react-dom)[\\/]/,
                    name: 'react',
                },
                mantine: {
                    test: /[\\/]node_modules[\\/]@mantine[\\/]/,
                    name: 'mantine',
                },
                icons: {
                    test: /[\\/]node_modules[\\/]react-bootstrap-icons[\\/]/,
                    name: 'bootstrap-icons',
                },
                other: {
                    test: /[\\/]node_modules[\\/]/,
                    priority: -1,
                    name: 'other',
                },
            },
        },
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
