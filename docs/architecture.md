# 架构说明

本文介绍当前扩展的数据流与代码位置，供理解和贡献代码使用。产品安装步骤见 [README](../README.md)。

## 处理流程

```text
用户选择或拖入 PDF
  → 浏览器读取文件，PDF.js 提取页面文本和坐标
  → 行重组、双栏识别、全文偏移映射
  → 识别文书类型并选择适用规则
  → 切分与归类条款，抽取数值和匹配短语
  → 生成风险发现、摘要和报告
  → 界面列表与 PDF 高亮联动，按需导出 HTML
```

整个检查流程在扩展页面内执行。内置样本通过扩展自身的资源地址读取；语言偏好使用浏览器的本地扩展存储。用户主动导出的 HTML 文件可能包含合同摘录，需要按敏感文件处理。

## 代码分工

| 位置 | 责任 |
|---|---|
| `apps/extension/entrypoints/review/` | 审查页面、文件选择、发现项、PDF 视图与交互 |
| `apps/extension/entrypoints/popup/` | 扩展弹窗与打开审查页 |
| `apps/extension/lib/pdf.ts` | 用 PDF.js 读取文本与页面信息、按页渲染 |
| `apps/extension/lib/pdf-lines.ts` | 按页面坐标重组文本行、识别双栏、建立全文偏移 |
| `apps/extension/lib/findings.ts` | 将发现项的文本位置映射为页面高亮 |
| `apps/extension/lib/export.ts` | 生成自包含 HTML 报告并触发下载 |
| `apps/extension/ui/` | 界面主题、语言上下文和通用样式 |
| `packages/core/src/` | 文书类型、条款切分、规则匹配、评分与报告数据 |
| `packages/core/src/rules/built-in.ts` | 内置规则、阈值及适用文书类型 |

`packages/core` 是工作区内的 TypeScript 源码包，规则处理不依赖扩展页面或模型接口。它尚未作为独立 npm 包发布。

## 规则与定位

1. **类型门控**：先根据文档开头识别文书类型，再筛选适用的规则。识别失败时使用全部规则并在界面提示。
2. **条件触发**：部分缺失类规则只有出现相关业务词时才参与判断，例如涉及预付款时再检查担保约定。
3. **数值归属**：同一条款可能同时含有付款、违约金和赔偿等数值；引擎结合附近的规则锚点判断数值属于哪一类，降低数值串用的风险。
4. **换行容忍**：短语匹配允许中文词语在 PDF 的换行处被拆开。发现项记录全文偏移，扩展再将其映射回页面位置；全文缺失类发现没有具体高亮位置。

规则是固定的示例阈值，并不理解所有合同语境。用户身份、复杂例外条款及未覆盖的行业约定仍需人工判断。

## 测试样本

- `packages/core/test/corpus/` 包含自行构造的仿真文本与人工标注的期望发现，用于验证规则、边界和文书类型。
- `test/fixtures/corpus/` 保存对应的仿真 PDF，用于从 PDF 解析到规则结果的完整链路检查。
- `test/fixtures/sample-contract.*` 与 `test/fixtures/two-column.*` 是仿真的基础合同和双栏样本。
- `apps/extension/public/sample-contract.pdf` 是扩展内的仿真演示文件。
- `test/fixtures/fonts/contract-guard-fixture-font.otf` 是 Noto Sans CJK SC 的字体子集，用于仿真 PDF 排版；版权与许可证见 [字体许可](../apps/extension/public/licenses/NotoSansCJKsc-OFL.txt)。重新生成样本时应使用该子集并验证中文文本提取。

回归通过仅说明当前样本上的预期成立，不能推广成真实业务场景的准确率承诺。不要将真实合同或脱敏后的真实合同提交到公开仓库。

## 可复现性

在相同文本、规则集和版本下，规则发现可复现。报告生成时间、处理耗时以及不同环境的渲染耗时可能不同，不应把它们视作需要逐字一致的判断结果。
