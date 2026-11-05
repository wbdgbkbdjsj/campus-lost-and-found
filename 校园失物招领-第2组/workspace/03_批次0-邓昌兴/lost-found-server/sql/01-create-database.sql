-- 校园失物招领与认领审核系统：数据库初始化（骨架版）
-- ⚠️ 表结构以李子研《api-contract-v0.md》为准。
--    契约定稿后，由李子研把建表语句补到本目录（02-schema.sql），邓昌兴负责执行与联调。

CREATE DATABASE IF NOT EXISTS `lost_found`
    DEFAULT CHARACTER SET utf8mb4
    DEFAULT COLLATE utf8mb4_general_ci;

USE `lost_found`;

-- TODO(契约 v0)：sys_user / role / item / claim_apply / audit_record / category / notice / sys_log 等表
-- 在 02-schema.sql 中创建。
