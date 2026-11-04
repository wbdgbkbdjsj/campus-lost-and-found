# sql

| 文件 | 内容 | 负责人 |
|---|---|---|
| `01-create-database.sql` | 创建数据库 `lost_found`（已可用） | 邓昌兴 |
| `02-schema.sql` | 全部建表语句，**等契约 v0 定稿后补** | 李子研 |
| `03-data.sql` | 演示初始数据（角色、分类、演示账号） | 邓昌兴 / 欧阳昊天 |

执行顺序：`01 → 02 → 03`。

约定：

- 字符集 `utf8mb4`，引擎 `InnoDB`。
- 表名、字段名 `snake_case`；每张表带 `id`、`create_time`、`update_time`、`deleted`。
- 演示账号密码存 BCrypt 密文，不要存明文。
