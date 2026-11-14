# 方法依据与使用边界

查阅日期：2026-11-02。以下链接在设计阶段实际读取过对应 SKILL.md。本文归纳借鉴方向，不复制第三方指令，不要求安装或运行这些项目；来源未来可能变化。

| 原始来源 | 借鉴内容 | 本技能的调整 |
|---|---|---|
| [RE-Skills / requirements-analysis-process](https://github.com/jdm4pku/RE-Skills/blob/main/skills/requirements-analysis-process/SKILL.md) | 分类、状态建模、决策表、冲突和完整性检查 | 只分析相关组合，按复杂度选用模型 |
| [softaworks / requirements-clarity](https://github.com/softaworks/agent-toolkit/blob/main/skills/requirements-clarity/SKILL.md) | 聚焦高影响缺口，分轮澄清 | 用具体阻塞项替代固定 90 分交付门槛 |
| [PM Skills / create-prd](https://github.com/phuryn/pm-skills/blob/main/pm-execution/skills/create-prd/SKILL.md) | 简明表达、首期范围、假设与目标 | 研发场景优先，背景与业务场景置前 |
| [PM Skills / user-stories](https://github.com/phuryn/pm-skills/blob/main/pm-execution/skills/user-stories/SKILL.md) | 角色、意图、可验证验收 | 增加完整故事、异常、跨角色及工程映射 |
| [Jeffallan / api-designer](https://github.com/Jeffallan/claude-skills/blob/main/skills/api-designer/SKILL.md) | 契约、错误、鉴权、分页与兼容 | 存量项目遵循已有协议，不强改 REST 或错误格式 |
| [Jeffallan / architecture-designer](https://github.com/Jeffallan/claude-skills/blob/main/skills/architecture-designer/SKILL.md) | 职责、决策、代价与失效分析 | 新增复杂度需要需求和规模依据 |
| [GitHub / breakdown-plan](https://github.com/github/awesome-copilot/blob/main/skills/breakdown-plan/SKILL.md) | 交付拆分、依赖、优先级与关键路径 | 不默认创建外部任务，不固定换算故事点与工时 |
| [Enreign / progressive-estimation](https://github.com/Enreign/progressive-estimation/blob/main/SKILL.md) | 不确定性、团队方式与重新估算 | 不直接采用其通用系数、概率或研究数值作为本项目证据 |
| [OpenAI / Build skills](https://developers.openai.com/plugins/build/skills) | 简明入口、按需参考、明确边界与行为验证 | 一个主入口，自包含参考，无强制外部插件依赖 |

优先依据是调用方提供的业务事实、明确决定和实际工程证据。网上方法不能证明本项目有某项痛点、采用某技术或能够按某日期上线。

维护本技能时，优先用真实失败案例验证规则是否有帮助，避免因为单个示例不断增加全局硬约束。数据库技术行为、版本能力和外部标准的判断以相关官方文档及实际验证为准。
