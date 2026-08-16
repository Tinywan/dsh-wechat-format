# dsh-wechat-format

DeepSeek Harness 插件：微信公众号 Markdown 排版工具。

将 Markdown 转换为**微信公众号正文兼容的全内联样式 HTML**（无 class、无 `<style>`、图片 base64 内嵌），输出可直接粘贴进公众号编辑器。渲染核心来自 [md-wechat-formatter](https://github.com/Tinywan/tinywan-wechat-format)。

## 快速安装

```bash
dsh plugin --profile web add dsh-wechat-format
```

安装后启动 `dsh web`，在对话中直接调用 `wechat_format` 工具即可（dsh@0.1.0-rc.6 实测）。

`--profile` 为必填项且要放在子命令之前；包内 `cordis.patch.yml` 已由 `package.json` 的 `dsh.bundle.patch` 声明，安装即自动注册工具。其他安装来源：

```bash
# 从 tarball（npm pack 产物）
dsh plugin --profile web add ./dsh-wechat-format-0.1.0.tgz
# 从 GitHub
dsh plugin --profile web add github:Tinywan/dsh-wechat-format
```

> 注意：包内必须是编译后的 JS（`dist/`）。Node 的 type stripping 不支持 node_modules 里的 .ts，直接发布 TS 入口会报 `ERR_UNSUPPORTED_NODE_MODULES_TYPE_STRIPPING`。`npm publish` 的 `prepublishOnly` 会自动 build + test。

## 提供的工具

### `wechat_format`

| 参数 | 必填 | 说明 |
|---|---|---|
| `markdown` | 是 | 文章完整 Markdown 文本 |
| `theme` | 否 | 主题 id：`blue-tech`（默认）/ `orange-heart` / `violet` / `green` / `night` |
| `imageFiles` | 否 | 文中图片对应的本地文件路径列表，按文件名匹配后以 base64 内嵌 |

返回：`{ html, warnings, theme }`。`html` 即可直接粘贴的公众号正文 HTML；未匹配到的图片会进入 `warnings`。

## 本地开发（patch overlay）

不打包、直接挂源码调试：修改 `cordis.yml` 中 `name` 为本机 `src/index.ts` 的 **file:// URL**（Windows 下 ESM loader 不接受裸盘符路径）：

```yaml
# overlay 必须是顶层 loader patch 条目数组
- insert:
    - id: wechat-format
      name: file:///D:/AI/wechat/dsh-wechat-format/src/index.ts
```

以 patch 方式启动：

```bash
# web 界面
dsh web --patch ./cordis.yml
# headless：一问一答
dsh --profile headless --patch ./cordis.yml "用 wechat_format 渲染 …"
```

注意事项（schema 编译器要求）：可选参数**省略** `required`（写 `required: false` 会报错）；object schema 必须显式声明 `additionalProperties`。

（配置格式参考：<https://deepseek-harness.github.io/deepseek-harness/develop/basic/>）

## 测试

```bash
npm test
```

冒烟测试覆盖：容器/色块/合规性、图片 base64 内嵌、图注编号、未匹配警告、五套主题渲染。

## 结构

```
src/
  index.ts        插件入口：注册 wechat_format 工具（Node 环境 DOMParser shim）
  core/           渲染核心快照（与 md-wechat-formatter 的 src/core 同步）
    themes.js     调色板 → 全量输出 token 工厂，5 套主题
    render.js     markdown-it 规则（色块序号/引用卡片/列表/代码窗口/表格/图注）
    highlight.js  hljs → 内联样式逐行转换
```

> 注意：`src/core/` 是 vendored 快照。md-wechat-formatter 的渲染规则升级后，需重新复制这三个文件并跑 `npm test`。
