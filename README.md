# 逐流随想 · 播客网站

Astro 6 + Starpod 静态网站，部署到 Cloudflare Pages。首页、节目详情、关于、联系、搜索、播放器、Markdown 页面和 JSON 接口在构建时生成；访问者不需要等待服务器读取 RSS。保留现有节目链接及跨页播放器。

## 本地开发与构建

使用 Node.js **22.12 或更新的 22.x**、pnpm **10.33.0**。`.node-version` 为 `22`，`packageManager` 固定 pnpm 版本。

```sh
corepack enable
corepack prepare pnpm@10.33.0 --activate
pnpm install --frozen-lockfile
pnpm dev
```

| 命令 | 用途 |
| --- | --- |
| `pnpm check` | Astro 类型检查 |
| `pnpm build` | 类型检查 → 静态构建 → 字体裁剪与 favicon 输出 → 产物检查 |
| `pnpm check:build` | 重新检查已有产物；需先成功构建 |
| `pnpm test:build` | 验证缺失资源、字体漏字和哈希损坏会阻止发布；需先成功构建 |
| `pnpm preview` | 预览最终 `dist/`，默认端口 4321 |

**发布必须执行完整的 `pnpm build`**，不能只运行 `astro build`。`pnpm dev` 直接使用完整字体方便开发；`pnpm preview` 才反映最终下载体积。本地预览不模拟 Pages 的响应头和跳转规则。

## 目录与资源

```text
astro.config.mjs           静态输出、正式域名、MiSans 注册
starpod.config.ts          节目信息、主播和 RSS 地址
src/components/           站点自定义组件
src/img/favicon.ico       已有 favicon（16 / 32 / 48 像素）
src/img/xiaoyuzhou.webp    用于页面的压缩图标
src/img/people/            主播照片
fonts/                    原始 MiSans 字体及官方授权文件
patches/                  Starpod 1.1.0 兼容补丁
scripts/                  字体裁剪及静态产物检查
public/_headers           Pages 缓存与 Markdown 响应头
public/_redirects         旧 RSS 地址跳转
```

所有构建输入均位于本仓库；不依赖父目录的迁移脚本、音频归档或图片。构建从 `https://feed.turbulentinsights.com/feed.xml` 读取公开 RSS，并获取其中引用的图片及可能的逐字稿；Cloudflare 构建环境须能访问这些资源。音频继续使用 RSS 中的媒体地址，不进入 Git 或 `dist/`。

`src/img/favicon.ico` 在构建后原样复制为 `/favicon.ico`。页面只引用该 ICO，不请求不存在的 PNG、Apple Touch Icon 或 manifest。更新图标后重新构建即可。小宇宙原始 PNG 保留为编辑源，页面只引用 WebP；重新生成命令：

```sh
node --input-type=module -e "import sharp from 'sharp'; await sharp('src/img/xiaoyuzhou.png').resize({height:48}).webp({quality:85}).toFile('src/img/xiaoyuzhou.webp');"
```

### 字体与速度

本网站使用小米 **MiSans**：正文为 Regular 400，标题和强调为 Bold 700。原始字形不作设计修改，Light 仅保留为源文件，不发布。官方协议在 `fonts/LICENSE-MiSans.pdf`，说明见 `fonts/README.md`。

构建后使用 `subset-font` 自动收集全部生成页面的文字、可访问标签、JSON 搜索数据及 TSX 交互文案，包括打开搜索、错误重试和播放器后才出现的文字。每次完整构建都会重新裁剪，无需为新节目手工补字。原字体没有的 emoji 等字符使用系统字体显示。

裁剪字体使用内容哈希文件名，所有页面更新为新地址，并删除产物中的完整字体。Fonts API 的 `font-display: swap` 和回退指标保留，文本可先以系统字体显示。字体不预加载；封面优先加载，其余图片保留尺寸与懒加载。搜索数据首次打开搜索才下载，成功后跨页复用，失败可以重试。

`/_astro/*` 中的哈希资源使用一年浏览器缓存；固定地址的 favicon、JSON、Markdown 可重新验证。HTML 沿用 Pages 默认 ETag / 重新验证行为，不额外添加整个站点的 Cache Everything 规则。Pages 自行处理 CDN 缓存和传输压缩。

本次改造的体积对比和测试结果见 [PERFORMANCE.md](PERFORMANCE.md)。

产物检查会验证字体覆盖、内容哈希、资源引用、静态路由、文件大小与数量，并在 `.build/report.json` 写入本地报告。字体总量超过 600 KiB、图标超过 10 KiB 或出现失效资源引用时构建失败。若未来内容增长触及字体预算，评估分片或提高预算后再发布，不应直接跳过检查。

### Starpod 补丁

Starpod 固定为 `1.1.0`；`patches/starpod@1.1.0.patch` 由 pnpm 在安装时应用，锁文件记录其校验值。补丁包含：Typlog RSS ID / 时长兼容、静态路由、MiSans 接入、现有 ICO 引用、搜索按需加载及重试、WebP 主播头像支持，并移除 Vercel 埋点、部署钩子和动态联系接口。升级前须重新核对补丁，不能直接删除补丁或改写 `node_modules`。

JSON 接口路径和数据格式保持不变，包括 `/api/episodes/search.json` 及分页接口。联系页提供收听平台及已配置的主播公开链接，不提交表单，不需要数据库或密钥。

## Git 与远程仓库

本目录是独立仓库，默认分支为 `main`。应提交源码、字体、品牌资源、补丁、锁文件和配置。`node_modules/`、`dist/`、`.astro/`、`.build/`、`preview/`、`.vercel/`、本地环境变量等不入库；`.env.example` 可入库。

远程仓库需先在 GitHub 或 GitLab 建立。将下面占位符替换为自己的仓库地址：

```sh
git remote add origin <你的远程仓库地址>
git push -u origin main
```

已有 `origin` 时先执行 `git remote -v` 核对。本次准备不创建远程仓库、不推送，也不修改域名。

## Cloudflare Pages 配置

在 Cloudflare 控制台选择 **Workers & Pages → Create application → Pages → Connect to Git**，连接本仓库并选择生产分支 `main`。

| 设置 | 值 |
| --- | --- |
| Framework preset | Astro |
| Root directory | 仓库根目录（留空），不是 `my-podcast` 子目录 |
| Build command | `pnpm build` |
| Build output directory | `dist` |
| Node.js | `.node-version` 中的 `22`；如配置 `NODE_VERSION`，也须为兼容的 22.x |
| `PNPM_VERSION` | `10.33.0`，生产和预览环境均设置 |

依赖安装由 Pages 执行；锁文件必须提交。部署内容是 `dist/`，不需要 Cloudflare 适配器、Workers、Pages Functions、R2、数据库或运行时环境变量。不要选择 Workers 部署流程或配置 `wrangler deploy`。

首次部署后，先通过 `*.pages.dev` 验证页面，再在 Pages 的 Custom domains 中接入 `turbulentinsights.com`。`astro.config.mjs` 的 `site` 保持正式域名，用于 canonical 和 sitemap。域名切换时保留 RSS 的 `feed` 子域及文件托管子域现有记录。

`public/_redirects` 保留：

```text
/feed/audio.xml https://feed.turbulentinsights.com/feed.xml 301
```

`404.html` 保证未知路由返回 404，不使用 SPA 全路径回退。Markdown 使用明确的 `.html.md` 地址，例如 `/index.html.md`，由 `_headers` 设置响应类型；不使用 Accept 内容协商。

官方参考：[Astro 部署](https://developers.cloudflare.com/pages/framework-guides/deploy-an-astro-site/)、[构建配置](https://developers.cloudflare.com/pages/configuration/build-configuration/)、[响应头](https://developers.cloudflare.com/pages/configuration/headers/)、[缓存行为](https://developers.cloudflare.com/pages/configuration/serving-pages/)。

### 发布新节目

RSS 更新不会自动改动已经部署的静态页面。确认新节目已出现在 RSS 后，在 Pages 的 Deployments 中重试生产部署；代码更新则推送 `main` 触发构建。

如需从播客发布流程触发：在 Pages 的 **Settings → Builds & deployments → Deploy hooks** 创建指向 `main` 的钩子，通过 POST 请求触发。钩子 URL 相当于部署凭据，只保存在发布系统的 secret 中，不写入本仓库。未配置定时任务或自动轮询 RSS。

### 回滚

在 Pages 的 Deployments 中选择先前成功的生产版本，执行 **Rollback to this deployment**。代码也需要修正时，使用 `git revert <引入问题的提交>` 后推送 `main`，保留提交历史。若问题来自 RSS 或外部图片变化，先修复来源或回退部署；单独回退 Git 不会回退外部内容。

### 上线后检查

- 首页、节目详情、搜索、关于、联系、404、播放器跨页播放及 favicon。
- `/feed/audio.xml` 的 301、Markdown Content-Type、哈希字体的长期缓存与 JSON 重新验证。
- 在大陆移动网络上测量实际首屏体验；本地慢网模拟只能验证资源量和渲染行为，不能替代 Pages 部署后的跨境网络测试。

## 可选内容

主播信息、平台链接在 `starpod.config.ts` 调整；逐字稿可放到 `src/content/transcripts/`。可通过 Starpod 的 `components` 和 `customCss` 扩展样式，保留静态输出。数据库功能默认关闭，`.env.example` 仅说明可选构建期数据来源，不是部署必填项。
