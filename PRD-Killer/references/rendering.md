# 渲染与交付

## 复用本地工具

从npm安装本项目后，可用 `prd-killer render --input <DOT文件或目录> --output <图集目录> --width 1800`；源码目录执行 `npm run render -- --input <DOT文件或目录> --output <图集目录>`。CLI复用同一渲染脚本，默认从npm包的依赖解析，仍支持显式 `--module-dir`。安装、打包及npx发布前后的用法见 [README](../README.md)。已复制到客户端的Skill目录不一定包含npm依赖，可使用已安装的CLI或下述已有工具；不要因分析任务自动联网安装包。

先检查已有图示渲染能力，复用能显示中文的本地工具。已有 Mermaid／PlantUML 渲染器可使用，保留源并导出 SVG、PNG，不为特定语法联网安装包。

Codex 桌面可通过工作区依赖加载工具定位 Node、node_modules。如果有 `@viz-js/viz` 与 `sharp`，使用 `scripts/render-diagrams.mjs` 将 DOT 离线渲染为 SVG＋PNG，不需要系统 dot 或网络。

```text
<node绝对路径> <skill目录>/scripts/render-diagrams.mjs --input <DOT文件或目录> --output <交付目录>/diagrams --module-dir <已有node_modules绝对路径> --width 1800
```

按当前 shell 正确传参；输入目录只读取一层 `.dot`。默认不覆盖，重绘本次自己生成的图显式用 `--overwrite`。源放 `diagrams/source/`，主文嵌入 PNG 相对路径，并保留对应 SVG、可编辑源。

只有其他本地工具时直接用现有能力；没有图示渲染器时可编写原生 SVG，使用已有图片工具预览／导出。仍不能预览则说明缺失，不把 Mermaid 围栏称为完成，不自动安装或上传业务数据。

## DOT 样式参考

不是所有业务都用相同布局；下面仅给通用样式：

```dot
digraph Business
{
    graph [rankdir=LR, bgcolor="white", pad=0.3, nodesep=0.35, ranksep=0.55];
    node [shape=box, style="rounded,filled", fillcolor="#EAF2FF", color="#3B6EA8", fontname="Microsoft YaHei", fontsize=17, margin="0.18,0.12"];
    edge [color="#64748B", fontname="Microsoft YaHei", fontsize=14, arrowsize=0.8];
    start [label="提交申请"];
    check [label="额度是否充足？", shape=diamond, fillcolor="#FFF3DD", color="#B97716"];
    saved [label="保存申请与占用", fillcolor="#E6F4EA", color="#38845B"];
    refused [label="拒绝本次提交\n提示最新余额", fillcolor="#FDECEC", color="#B84A48"];
    start -> check [label="计划与金额"];
    check -> saved [label="是"];
    check -> refused [label="否"];
}
```

中文用可用字体，标签主动分行。Graphviz `splines=ortho` 对边标签有布局限制，若警告／挤压，改分层或 polyline，不忽略警告继续交付。

此助手会先以实际中文字形测量标签，再用等宽占位布局并恢复原文字体，避免 WASM 字体度量缺失造成中文越框。使用显式引号文本标签和 `\n` 换行；HTML 表格标签及 `\N` 等动态标签需先展开或改用其他现有渲染器。不要手工保留中间占位文字。

## 时序图与视觉检查

优先已有时序语法工具。用 DOT／原生 SVG 时仍须有稳定参与者列、垂直生命线、向下的时间、消息编号、请求／返回方向、必要分支及事务标注；普通 LR 方框链不合格。提交、执行、取消过长则拆图，跨外部步骤不能圈进一个本地事务。

渲染器尺寸报告只证明文件生成。打开所有 PNG／SVG，并按约 1100px 宽检查，截断、重叠、乱码、过小或遗漏就改源重绘。正文路径须可用，过期图不继续引用。

指定目录在可写范围外时，先在工作区完成，再按已有授权写入。`evals/render-diagrams.test.mjs` 可通过当前 Node 的 `--test` 验证中文边界及字体恢复、真实渲染、坏源整批失败和默认不覆盖；`PRD_DIAGRAM_MODULES` 指向已有包目录。自动检查不代替业务与视觉检查。
