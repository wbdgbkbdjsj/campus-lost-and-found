package com.campus.lostfound.common;

import com.baomidou.mybatisplus.annotation.IdType;
import com.baomidou.mybatisplus.annotation.TableId;
import com.baomidou.mybatisplus.annotation.TableLogic;
import lombok.Data;

import java.io.Serializable;
import java.time.LocalDateTime;

/**
 * 所有业务实体的公共字段。建表时请同步保证这些列存在。
 */
@Data
public class BaseEntity implements Serializable {

    @TableId(type = IdType.AUTO)
    private Long id;

    /** 创建时间，数据库默认 CURRENT_TIMESTAMP */
    private LocalDateTime createTime;

    /** 更新时间，数据库默认 CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP */
    private LocalDateTime updateTime;

    /** 逻辑删除：0 未删，1 已删 */
    @TableLogic
    private Integer deleted;
}
