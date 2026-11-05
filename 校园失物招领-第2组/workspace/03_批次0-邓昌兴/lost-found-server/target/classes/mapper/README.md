# mapper

MyBatis XML 映射文件目录，按模块建子目录：

```
mapper/
├─ item/ItemMapper.xml
├─ claim/ClaimApplyMapper.xml
├─ audit/AuditRecordMapper.xml
└─ ...
```

命名规则：`类名Mapper.xml`，namespace 与 Mapper 接口全限定名一致。
单表 CRUD 用 MyBatis-Plus 注解/内置方法，多表关联或复杂统计才写 XML。
