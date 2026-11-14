# 工单查询夹具：现状文档与产品结论

这是脱敏虚构夹具，供 Skill 示例和回归读取；不代表任何用户生产工程。以下“已确认”仅指练习输入给定，不代表实际系统测试通过。

## SRC-001：现状与痛点

已有内部工单列表只显示当前登录用户自己的工单，使用 Python 与 SQLite。用户现在为了找 OPEN 或 CLOSED 状态的记录需要逐页翻看。没有耗时和性能基线。

既有文档入口为 GET /api/tickets，返回 code/message/data。当前用户 ID 从可信登录中间件传给 handle_list_tickets，不能由查询参数覆盖。原有 afterId 为非负整数，默认 0；limit 为 1～100 的整数，默认 20；按 id 升序，取 id > afterId 的下一页。这些参数由上游适配层校验，夹具只提供其后业务查询片段。

成功 HTTP 200，code="OK"、message="success"、data 为记录数组；每条包含 id（正整数）、title（字符串）、owner_id（字符串）、status（OPEN/CLOSED/null）。无匹配为 []。现有统一错误信封为 code/message/data：非法参数 HTTP 400 / INVALID_ARGUMENT，未登录 HTTP 401 / UNAUTHENTICATED，查询异常 HTTP 500 / QUERY_FAILED；错误 data 为 null，message 为可理解说明。

## SRC-002：本次产品已确认范围

新增单选状态筛选，status 仅允许 OPEN 或 CLOSED，大小写敏感；省略时不加状态条件，保持原结果且包含历史 null 状态。空串、显式字符串 null、大小写变体和其他状态均视为非法参数。

状态过滤必须在分页之前执行；筛选与用户范围、游标条件同时生效，稳定按 id 升序。切换或清除状态时前端将 afterId 归零。保留 afterId、limit 的原语义与响应字段。

本次不包含导出、批量更新、审批或新通知能力，也不改变权限、历史数据和数据库产品。没有实际前端源码和 HTTP 适配层；实现时需定位这些位置，但交互和契约含义已经明确。

## SRC-003：工程与验证情况

ticket_query.py 和 schema.sql 是可阅读的现有片段，查询当前尚无 status 参数。现有索引是 (owner_id, id)，新增索引需要代表性数据与执行计划支持，本次尚未执行数据库、接口、性能或前端验证。

团队人数、产能和开工日未给出；可以分解任务与给出有依据的粗估，不能承诺日期。该查询片段可独立实现，其他未提供源码的适配/页面改动需定位文件后执行。
