# lost-found-server｜校园失物招领后端

## 技术栈

Spring Boot 3.2.5 · Java 17 · MyBatis-Plus 3.5.7 · Spring Security 6 + JWT · MySQL 8 · Knife4j

## 启动

1. 安装并启动 MySQL 8，执行 `sql/01-create-database.sql` 创建 `lost_found` 库。
2. 修改 `src/main/resources/application-dev.yml` 里的数据库账号密码。
3. 用 IDEA 打开 `pom.xml`，等 Maven 依赖下载完，运行 `LostFoundApplication`。
   - 没有 IDEA：安装 Maven 3.9+，执行 `mvn spring-boot:run`。
4. 接口文档：http://localhost:8080/api/doc.html

> 当前为批次 0 骨架：数据库表、登录接口、业务接口均未实现，启动后访问业务接口会返回 401 或空实现。
> 表结构以李子研《api-contract-v0.md》为准，补到 `sql/02-schema.sql` 后再联调。

## 目录

```
src/main/java/com/campus/lostfound/
├─ LostFoundApplication.java   启动类（@MapperScan module 包）
├─ common/                     统一响应、分页、异常、基类
├─ config/                     安全、MyBatis-Plus、静态资源、接口文档
├─ security/                   JWT 工具、过滤器、登录用户
└─ module/                     业务模块（每个模块下再分 controller/service/mapper/entity/dto/vo）
   ├─ auth/       登录、登出、当前用户         邓昌兴
   ├─ user/       账号、角色、启停、重置密码    欧阳昊天
   ├─ item/       物品发布、查询、编辑、下架    金道轩
   ├─ category/   物品分类                    欧阳昊天
   ├─ claim/      认领申请、我的申请、撤销      李子研
   ├─ audit/      发布审核、认领审核、归还登记  李子研
   ├─ notice/     公告与站内通知               欧阳昊天
   ├─ file/       图片上传                    邓昌兴
   ├─ log/        操作日志                    欧阳昊天
   └─ admin/      数据看板、系统设置           欧阳昊天
```

## 统一约定

- 接口统一返回 `Result<T>`：`{ code, message, data }`；分页统一 `PageResult<T>`。
- 业务错误抛 `BusinessException`，由 `GlobalExceptionHandler` 统一处理。
- 权限用方法注解：`@PreAuthorize("hasRole('AUDITOR')")`。
- 密码用 `BCryptPasswordEncoder` 加密，禁止明文入库。
- 时间字段统一 `LocalDateTime`，JSON 输出 `yyyy-MM-dd HH:mm:ss`。
