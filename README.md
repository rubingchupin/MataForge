# MataForge

MataForge 是一个**纯前端、基于 GitHub Pages** 的项目元数据中心。所有项目共用的信息——图标、名称、版本、作者、简介、更新日志——统一以 JSON 形式管理，既能被静态站点动态渲染，也能被其它项目直接调用。

- **零依赖**：只用 Node.js 内置的 `http` / `fs` / `path` 模块，无需 `npm install`。
- **图形化编辑器**：本地 Web 界面编辑，防抖自动保存到配置文件。
- **一键生成 / 上传**：构建静态站点，并可直接推送到 GitHub 的 `assets` 分支。
- **浅色扁平化设计**：编辑器和发布站点均为浅色扁平风格。

---

## 目录结构

```
MataForge/
├── config/
│   └── site.json            # 全局设置：站点名称 + 共享作者信息
├── projects/                # 每个项目一个文件夹，内含 mataforge.json
│   └── mataforge-core/
│       └── mataforge.json
├── shared/                  # 多项目共用的文件（含本地上传的图标），构建时复制到 dist/shared/
├── editor/                  # 本地图形化编辑器（index.html / editor.js / editor.css）
├── site/                    # 最终发布站点（index.html / app.js / style.css）
├── server/
│   └── server.mjs           # 本地服务端（静态资源 + API）
├── scripts/
│   ├── build.mjs            # 构建：聚合项目 JSON → dist/
│   ├── publish.mjs          # 发布：构建并推送到 GitHub assets 分支
│   └── commit.mjs           # 提交源码（排除项目配置与构建文件）并推送
├── dist/                    # 构建产物（自动生成，勿手改）
└── package.json
```

---

## 快速开始

```bash
# 启动本地编辑器（默认 http://localhost:3000）
npm start
```

在编辑器中：

1. 点「＋ 新建项目」，填写 ID / 名称 / 图标 / 版本 / 简介；
2. 图标可填 URL，也可点「上传本地图标」直接上传（保存到 `shared/`，编辑器和站点均可用）；
3. 填写更新日志；
4. 表单会 **800ms 防抖自动保存** 到 `projects/<id>/mataforge.json`；
5. 点「生成网站」构建到 `dist/`；
6. 点「预览」查看发布站点效果。

其它功能：搜索、导入/导出、复制、重命名（自动迁移目录）、实时预览、字段校验、信息完整度指示、生产/测试/开发状态筛选、图标/作者头像本地上传、复制或下载项目 JSON（编辑器和站点卡片均有）。

---

## 共享作者信息

作者信息是**全局共享**的，不在每个项目里重复填写。打开编辑器顶部的「全局设置」，填写：

- 站点名称
- 站点公开地址（可选，如 `https://user.github.io/repo`，用于生成资源公共服务链接）
- 作者名称、头像、主页 URL、邮箱、作者信息（头像可填 URL，也可点「上传本地头像」上传到 `shared/`）

这些信息保存在 `config/site.json`。构建时，全局作者会被**自动注入**到每个项目的输出数据中（单个项目若自带 `author` 字段，会覆盖全局值）。

---

## 公共资源

`shared/` 文件夹是一个**公共服务资源中心**，任意类型资源（图标、logo、字体、音频、脚本、数据文件等）都可以上传到这里，供所有项目与外部项目引用：

- 在编辑器「全局设置 → 公共资源」中上传（支持任意类型），或直接把文件放进 `shared/` 目录；
- 上传时可填写**子目录**（如 `fonts`、`audio`）实现分目录管理，目录结构会原样保留到输出目录；
- 每个资源旁显示**公共链接**，可一键复制：填了站点公开地址时为完整 URL（`https://<用户名>.github.io/<仓库名>/shared/<文件名>`），否则为相对路径 `shared/<文件名>`；
- 图片资源会自动显示**缩略图**预览；
- 支持**批量删除**：勾选多个资源后点「删除选中」，或使用「全选」；
- 项目中直接用相对路径引用即可，例如图标填 `shared/logo.png`、字体填 `shared/fonts/main.woff2`；
- 构建时，`shared/` 的**全部内容（含子目录）会复制到输出目录的 `dist/shared/`**；
- 服务端按扩展名返回正确的 MIME 类型（图片、字体、音视频、文档、脚本、JSON 等均支持），可直接被其它项目引用。

---

## 项目元数据字段

每个项目 `mataforge.json` 的结构：

```json
{
  "id": "mataforge-core",          // 必填，唯一，小写字母/数字/连字符
  "name": "MataForge Core",         // 必填，项目名称
  "icon": "https://...",            // 必填，图标 URL
  "version": "1.0.0",               // 必填，语义化版本
  "status": "production",           // 选填，production / test / dev，用于区分生产与测试
  "description": "项目简介",         // 选填
  "tags": ["运行时", "核心"],         // 选填，标签数组，站点可点击筛选
  "license": "MIT",                 // 选填，许可证
  "links": [                        // 选填，相关链接
    { "label": "主页", "url": "https://..." },
    { "label": "文档", "url": "https://..." }
  ],
  "author": { ... },                // 选填，覆盖全局作者
  "changelog": [                    // 选填，更新日志
    {
      "version": "1.0.0",
      "date": "2026-11-13",
      "changes": ["首次发布"],        // 变更要点（列表）
      "body": "## 新增\n- 支持 **Markdown** 更新日志"  // 选填，Markdown 说明
    }
  ]
}
```

完整标准以上表为准；构建脚本会对必填字段与版本号格式做校验。

### 标签筛选

站点中每个项目的标签均可**点击**，点击后仅显示带该标签的项目；再次点击同一标签取消筛选。搜索框也会同时匹配标签文本。

### 版本号与一键升级

- **支持多种格式**：`1.0.0`、`1.2`、`1`、`v1.2.3`、`1.2.3-beta`、`1.2.3+build` 均可识别。
- 编辑器「版本号」输入框下方提供三个一键升级按钮：
  - **小版本**（补丁 +1）：`1.0.0 → 1.0.1`
  - **大版本**（次版本 +1）：`1.0.0 → 1.1.0`
  - **跨代**（主版本 +1）：`1.0.0 → 2.0.0`
- **`.99` 特殊事件**：当次版本或补丁达到 99 时，再升级会触发进位——本段归 0 并向上一位进 1。例如 `1.0.99 → 1.1.0`、`1.99.0 → 2.0.0`，编辑器会提示「版本已进位」。

---

## 构建与外部调用

```bash
npm run build
```

脚本会扫描 `projects/` 下所有项目，聚合为 `dist/projects.json`：

```json
{
  "generatedAt": "...",
  "site": { "name": "MataForge" },
  "projects": [ { "id": "...", "name": "...", "author": { ... }, "changelog": [ ... ] } ]
}
```

任何项目都可以直接请求 `https://<用户名>.github.io/<仓库名>/projects.json` 来读取元数据。

---

## 上传到 GitHub

### 首次准备（仅一次）

```bash
git init
git add .
git commit -m "init"
git branch -M main
git remote add origin https://github.com/rubingchupin/MataForge.git
git push -u origin main
```

> 需要本机已安装并登录 Git，且 `git config user.name` / `user.email` 已配置。

### 发布

两种方式任选：

```bash
# 方式一：编辑器里点「上传 GitHub」按钮
# 方式二：命令行
npm run publish
```

`publish` 会先构建 `dist/`，再把 `dist/` 的内容推送到远程 `assets` 分支（使用 `git subtree push`，首次会自动创建该分支）。

### 提交代码（独立项目发布）

如果想把这个工具（编辑器 + 服务端 + 站点 + 脚本）作为**独立项目**发布到 Git 仓库，使用「提交代码」功能：

```bash
# 方式一：编辑器里点「提交代码」按钮
# 方式二：命令行
npm run commit
```

`commit` 会把全部源码提交并推送到远程 `main` 分支，但**自动排除**以下内容：

- `projects/` — 项目元数据配置
- `config/` — 站点全局配置（站点名、作者信息）
- `shared/` — 多项目共享文件
- `dist/` — 构建产物
- `node_modules/` — 依赖

这样你的项目数据与构建文件不会混入独立发布的源码仓库。

### 开启 GitHub Pages

在仓库 **Settings → Pages** 中：

- Source 选 **Deploy from a branch**；
- Branch 选 **assets / (root)**，保存。

稍等片刻即可通过 `https://<用户名>.github.io/<仓库名>/` 访问。

> 注意：GitHub Pages 免费版要求仓库为 **public**；私有仓库需 GitHub Pro。

---

## 常用命令

| 命令 | 说明 |
|---|---|
| `npm start` | 启动本地编辑器 `http://localhost:3000` |
| `npm run build` | 构建静态站点到 `dist/` |
| `npm run publish` | 构建并推送到 GitHub `assets` 分支 |
| `npm run commit` | 提交源码（排除项目配置与构建文件）并推送到主分支 |