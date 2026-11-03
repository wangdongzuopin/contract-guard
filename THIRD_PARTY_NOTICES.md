# 第三方组件说明

Contract Guard 的项目代码按 [MIT License](LICENSE)发布。项目使用的第三方组件分别遵循其自身许可证，主要直接依赖包括：

| 组件 | 用途 | 许可证 | 项目地址 |
|---|---|---|---|
| React / React DOM | 扩展界面 | MIT | https://react.dev/ |
| Ant Design / Ant Design Icons | 界面组件与图标 | MIT | https://ant.design/ |
| PDF.js（`pdfjs-dist`） | PDF 解析与渲染 | Apache-2.0 | https://mozilla.github.io/pdf.js/ |
| WXT | 浏览器扩展开发与构建 | MIT | https://wxt.dev/ |
| Noto Sans CJK SC | 仿真 PDF 字体子集 | SIL Open Font License 1.1 | https://github.com/notofonts/noto-cjk |

本表用于说明主要组件。当前生产依赖的许可证文本见 [依赖许可证汇编](apps/extension/public/licenses/DEPENDENCIES.txt)，仿真字体的原始版权和许可证见 [Noto 字体许可](apps/extension/public/licenses/NotoSansCJKsc-OFL.txt)。这些许可文件会随扩展构建产物一起复制。具体版本以 `pnpm-lock.yaml` 为准；依赖更新后应重新执行 `pnpm licenses list --prod` 并更新许可证汇编。

分发扩展构建物或修改后的软件时，请同时检查所包含依赖的许可证、版权声明和通知文件。本项目的 MIT 许可不会替代第三方组件各自的许可。
