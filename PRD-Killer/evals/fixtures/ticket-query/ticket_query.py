"""工单列表现有查询的只读练习片段，不是待交付功能实现。"""

import sqlite3


def list_tickets(
    connection: sqlite3.Connection,
    current_user_id: str,
    after_id: int = 0,
    limit: int = 20,
) -> list[dict]:
    """按当前用户与递增 ID 游标读取工单，现状尚未支持状态筛选。"""
    cursor = connection.execute(
        "SELECT id, title, owner_id, status FROM tickets "
        "WHERE owner_id = ? AND id > ? ORDER BY id LIMIT ?",
        (current_user_id, after_id, limit),
    )
    columns = [column[0] for column in cursor.description]
    return [dict(zip(columns, row)) for row in cursor.fetchall()]


def handle_list_tickets(
    connection: sqlite3.Connection,
    current_user_id: str,
    after_id: int = 0,
    limit: int = 20,
) -> dict:
    """接收上游已校验参数和可信用户身份，沿用现有成功响应信封。"""
    records = list_tickets(connection, current_user_id, after_id, limit)
    return {"code": "OK", "message": "success", "data": records}
