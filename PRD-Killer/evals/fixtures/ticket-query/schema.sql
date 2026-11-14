-- 脱敏练习结构；没有生产执行计划或性能结果。
CREATE TABLE tickets (
    id INTEGER PRIMARY KEY, -- 工单记录 ID。
    title TEXT NOT NULL, -- 工单标题。
    owner_id TEXT NOT NULL, -- 工单归属用户 ID。
    status TEXT CHECK (status IN ('OPEN', 'CLOSED') OR status IS NULL) -- 历史状态可为空。
);

-- 现有索引支持本人范围与 ID 游标查询。
CREATE INDEX idx_ticket_owner_id ON tickets (owner_id, id);
