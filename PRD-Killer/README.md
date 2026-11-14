# PRD-Killer

**把长篇PRD整理成开发者能快速看懂的图解交接稿。**

PRD-Killer是一套可复用的AI Skill，附带安装与本地图示渲染CLI。它帮助产品和研发理顺业务流程、数据关系、状态变化及异常分支，以图为主说明“要做什么、为什么做、先做什么”。

PRD分析由支持Skill的AI客户端读取本项目的[SKILL.md](SKILL.md)后完成；npm CLI提供资源安装和DOT图示渲染，不包含独立的大模型服务。

## 会得到什么

| 独立文档 | 主要内容 |
| --- | --- |
| 需求图解.md | 业务流程、数据流转、关键时序、技术架构，以及少量规则、原因和待确认问题 |
| 关键接口契约.md | 涉及关键调用或接口变更时，说明输入输出、权限、失败及防重要求；无工程依据时标需求级草案 |
| 开发顺序清单.md | 默认研发交付，按依赖排序的可勾选任务、完成条件、并行关系及阻塞；更新时保留已有进度 |

文档相互链接，配套保存真实PNG、SVG和可编辑图源。小需求按实际规模选图，完整复杂需求覆盖业务、数据、时序、架构四种视角；不强制每个需求都画相同数量的图。

```markdown
- [ ] T01 核对现有实现与规则。完成：明确复用点、差异及待确认分支。
- [ ] T02 实现关键变更。依赖：T01。完成：指定输入得到约定结果。
- [ ] T03 联调及交付核对。依赖：T02。完成：关键验证有记录，文档与实现同版。
```

可查看完整的[图解示例](references/example-visual-handoff.md)，或较小的[查询需求示例](references/example-confirmed-handoff.md)、[接口契约](references/example-confirmed-contract.md)、[开发清单](references/example-confirmed-checklist.md)。

## 从源码使用

需要Node.js 22及以上，以及npm。克隆本仓库后进入PRD-Killer目录执行：

```bash
git clone https://github.com/BerLin-Justin/Skills-Share.git
cd Skills-Share/PRD-Killer
npm ci
npm start -- --help
npm run skill:install
```

默认安装到`CODEX_HOME/skills/prd-killer`；未设置`CODEX_HOME`时使用`~/.codex/skills/prd-killer`。其他支持Skill的客户端可通过`--target`指定它使用的完整Skill目录：

```bash
npm run skill:install -- --target "./output/skills/prd-killer"
```

安装器只复制Skill资源，已有目标会拒绝覆盖。升级时先备份原Skill，将新版本装到新目录并核对个人修改。中断或复制失败时明确报错，可能保留部分新资源供检查，不会删除用户原有目录。

安装后，在支持该Skill的AI客户端中提供PRD并发起类似请求：

```text
请使用 prd-killer 分析这份PRD，只覆盖指定模块。
以业务流程、数据流转、时序和技术架构图为主。
分别交付需求图解、关键接口契约和可勾选开发顺序清单，保存到我指定的目录。
```

输入材料是否可读取决于客户端提供的文件、文档或浏览器能力；本CLI不负责解析DOCX、调用模型或生成完整分析。

## npm发布后的npx用法

下面命令要求维护者已将**本项目**以`prd-killer@0.1.0`发布到npm；首次发布前请使用上面的源码方式，或下面的本地tarball方式。若实际发布包名或版本不同，使用对应名称，不能仅凭同名包认定为本项目。

```bash
npx --yes prd-killer@0.1.0 install
npx --yes prd-killer@0.1.0 install --target "./output/skills/prd-killer"
npx --yes prd-killer@0.1.0 render --input "./diagrams/source" --output "./diagrams"
```

也可以全局安装后直接使用命令：

```bash
npm install --global prd-killer@0.1.0
prd-killer --help
```

没有`postinstall`自动复制操作；只有显式执行`install`命令才安装Skill资源。

## 渲染图示

先准备DOT源文件，或直接试用仓库里的演示源：

```bash
npm run render -- --input "./assets/small-query-example/diagrams/source/ticket-filter.dot" --output "./output/diagrams" --width 1800
```

输出同名SVG和PNG。输入目录只读取一层`.dot`，默认拒绝覆盖；重绘自己生成的图时加`--overwrite`。需要复用外部已安装依赖时可加`--module-dir <node_modules目录>`。

渲染复用`@viz-js/viz`及`sharp`，安装好依赖后本地运行，不上传业务材料。中文图示需要系统中可显示中文的字体；脚本使用Microsoft YaHei及系统回退字体。生成成功后仍应打开图片检查文字、连线及排版。原生SVG、Mermaid等其他来源的图示按[渲染说明](references/rendering.md)使用相应工具，本命令只接收DOT。

## 测试和本地打包

```bash
npm test
npm run pack:check
npm pack
```

测试覆盖CLI安装与已有目录保护、路径转发，以及中文图示、无效整批失败和默认不覆盖等关键边界。目录链接测试需要运行环境允许创建junction或符号链接。

生成的`prd-killer-0.1.0.tgz`可在发布前通过本地包验证npx入口：

```bash
npm exec --yes --package "./prd-killer-0.1.0.tgz" -- prd-killer --version
npm exec --yes --package "./prd-killer-0.1.0.tgz" -- prd-killer install --target "./output/package-smoke/skill"
```

打包包含Skill规则、参考、脱敏示例、图源和CLI；`node_modules`、生成的tarball及`output`不加入源码提交或发布包。依赖通过`package-lock.json`固定。

## 项目结构

```text
PRD-Killer/
├─ README.md                  项目首页与使用说明
├─ SKILL.md                   AI读取的分析与交付规则
├─ package.json               npm依赖、命令及打包配置
├─ bin/prd-killer.mjs          install / render CLI
├─ scripts/render-diagrams.mjs 本地DOT渲染器
├─ references/                分析、接口、清单及渲染参考
├─ assets/                    脱敏演示图与可编辑源
├─ agents/openai.yaml         Skill展示信息与默认提示
└─ evals/                     行为案例、脱敏夹具及关键测试
```

## 维护与发布

本项目位于 [Skills-Share/PRD-Killer](https://github.com/BerLin-Justin/Skills-Share/tree/main/PRD-Killer)，npm配置已关联此仓库及子目录。发布npm前仍需核实包名及维护者身份。许可证尚未指定，`package.json`暂用`UNLICENSED`，由维护者决定授权方式。

确认发布信息后，先执行测试和打包检查，再由维护者自行登录和发布：

```bash
npm login
npm publish --access public
```

GitHub源码与npm registry发布独立进行，提交源码、测试或本地打包不代表已经发布npm包。包配置和命令行为可参考[npm package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json/)、[npm pack](https://docs.npmjs.com/cli/v11/commands/npm-pack/)、[npm exec](https://docs.npmjs.com/cli/v11/commands/npm-exec/)。
