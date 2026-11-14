# 本人工单查询：关键接口契约

配套：[需求图解与业务验收](example-confirmed-handoff.md)。这是脱敏练习材料，协议取自 [现状及产品结论](../evals/fixtures/ticket-query/context.md)，代码片段取自 [ticket_query.py](../evals/fixtures/ticket-query/ticket_query.py)。已静态核对查询链，HTTP适配层及前端源码未提供；未执行接口或性能验证。

执行跟踪：[开发顺序清单（可勾选）](example-confirmed-checklist.md)。

## T01 按可选状态查询本人工单

调用方：工单列表页面 → 既有 `GET /api/tickets`；修改查询能力，保留响应信封及权限。内部链为 `handle_list_tickets` → `list_tickets`，签名变更须与适配层对齐。

| 输入／身份 | 类型与契约 |
| --- | --- |
| current_user_id | 来自可信登录中间件，不接受查询参数覆盖 |
| status | 可省略字符串；仅 `OPEN` 或 `CLOSED`，省略含历史null；空串、字符串null、大小写变体非法 |
| afterId | 非负整数，默认0；切换或清除状态时回到0 |
| limit | 整数1～100，默认20 |

本人范围、状态和游标条件在分页前同时生效；按id升序且id>afterId。此为只读调用，不增加写入幂等键。

| 结果 | 协议与调用方行为 |
| --- | --- |
| 成功 | HTTP 200，code=`OK`、message=`success`、data为记录数组；无匹配为[]。每条含id（正整数）、title（字符串）、owner_id（字符串）、status（OPEN/CLOSED/null） |
| 非法参数 | HTTP 400 / `INVALID_ARGUMENT`；data=null，message可理解；修正参数后再请求 |
| 未登录 | HTTP 401 / `UNAUTHENTICATED`；data=null，先完成登录 |
| 查询异常 | HTTP 500 / `QUERY_FAILED`；data=null，提示读取失败，不能把异常当作无工单 |

错误仍使用code/message/data。既有调用不传status时行为保持；新增状态参数放在内部函数末尾并设默认，历史null不回填。业务验收见分析稿，真实适配文件、执行计划和运行验证仍需开发核实。
