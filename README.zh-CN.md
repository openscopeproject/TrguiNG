# TrguiNG

**Transmission 种子下载守护进程的远程图形界面**

![GitHub release](https://img.shields.io/github/v/release/OpenScopeProject/TrguiNG)
![Downloads](https://img.shields.io/github/downloads/OpenScopeProject/TrguiNG/total)
![Lint status](https://img.shields.io/github/actions/workflow/status/OpenScopeProject/TrguiNG/lint.yml?label=Lint&event=push)

[English](README.md) | 简体中文

![logo](https://i.imgur.com/QdgMWwW.png)

`TrguiNG` 是使用 [tauri](https://tauri.app) 框架重写的 [transgui](https://github.com/transmission-remote-gui/transgui) 项目。
前端使用 TypeScript 编写，基于 [react.js](https://react.dev/) 和 [mantine](https://mantine.dev/) 库。
应用程序的后端使用 [rust](https://www.rust-lang.org/) 编写。

您可以通过两种方式使用本程序：作为原生 Windows/Linux/Mac 应用程序，或者通过设置 `$TRANSMISSION_WEB_HOME` 环境变量指向 TrguiNG web 资源，让 Transmission 自身提供的 web 界面使用。

项目 [wiki](https://github.com/openscopeproject/TrguiNG/wiki) 上有应用程序的截图。

一些特色功能：

* 多标签页界面，支持同时连接多个服务器（仅限原生应用）
* 快速多线程哈希计算的种子创建功能（仅限原生应用）
* 强大的种子过滤选项
* 支持最新的 Transmission 功能：标签、带宽组、顺序下载
* 深色和浅色主题
* **多语言支持**：英语和简体中文，自动检测系统语言

计划中的功能：

* 当 API 准备就绪时提供更好的带宽组支持 (https://github.com/transmission/transmission/issues/5455)

需要 Transmission v2.40 或更高版本。

## 下载

您可以从[发布页面](https://github.com/openscopeproject/TrguiNG/releases)获取最新版本。

当前开发版本的每周构建可从 GitHub [构建工作流](https://github.com/openscopeproject/TrguiNG/actions/workflows/build.yml)获取。选择最新的成功运行并向下滚动到 artifacts 部分。

## 编译

前置要求：

- [Node.js 16](https://nodejs.org/) 或更高版本
- [rust 1.77](https://www.rust-lang.org/) 或更高版本
- mmdb 格式的 Geoip 查找数据库，放在 `src-tauri` 目录中

  ```
  wget -nv -O src-tauri/dbip.mmdb "https://github.com/openscopeproject/TrguiNG/releases/latest/download/dbip.mmdb"
  ```

  您可以从 [db-ip.com](https://db-ip.com/db/download/ip-to-country-lite) 获取最新数据库。

要编译，只需运行：

```
$ npm install
$ npm run build
```

这将在 `dist` 目录中生成优化的包，并在 `src-tauri/target/release` 文件夹中生成发布二进制文件。安装包也将在 `src-tauri/target/release/bundle/...` 中提供。

二进制文件是静态链接的，并嵌入了除 geoip 数据库之外的所有必要资源。它完全自给自足，可以用作便携式可执行文件，但要使 geoip 查找工作，您需要使用提供的安装程序安装应用程序。

对于开发，请并行运行：

```
$ npm run webpack-serve
$ npm run tauri-dev
```

Webpack 将自动监视 `src/` 中的更改并刷新应用视图，tauri 将监视 `src-tauri/` 中的更改并根据需要重新构建/重启应用程序。

## 如何将 TrguiNG 用作 Web 界面

Transmission 支持自定义 web 界面，您只需要运行守护进程，并将 `$TRANSMISSION_WEB_HOME` 变量指向 web 资源，Transmission 将通过其 `.../transmission/web/` 端点提供服务。

Debian 系统的示例步骤：

1. 从[发布页面](https://github.com/openscopeproject/TrguiNG/releases)下载最新的 `trguing-web-xxxx.zip` 压缩包。
2. 将其解压到任意位置，确保 Transmission 运行的用户（默认为 `debian-transmission`）具有读取权限。
3. 编辑 Transmission 守护进程 systemd 单元文件 `/etc/systemd/system/multi-user.target.wants/transmission-daemon.service`，在 `[Service]` 部分添加以下内容：
   ```
   Environment=TRANSMISSION_WEB_HOME=/path/to/extracted/trguing/zip
   ```
4. 使用 `sudo systemctl daemon-reload` 重新加载单元文件，并使用 `sudo systemctl restart transmission-daemon` 重启服务。

## 许可证

本项目根据 GNU Affero General Public License v3 分发，详情请参阅 `LICENSE.txt`。
