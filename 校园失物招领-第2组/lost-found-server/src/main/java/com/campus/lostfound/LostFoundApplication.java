package com.campus.lostfound;

import org.mybatis.spring.annotation.MapperScan;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;

/**
 * 校园失物招领与认领审核系统 - 启动类。
 *
 * <p>接口文档：http://localhost:8080/api/doc.html
 * <p>context-path 为 /api，前端开发服务器已代理 /api 到本服务。
 */
@SpringBootApplication
@MapperScan("com.campus.lostfound.module")
public class LostFoundApplication {

    public static void main(String[] args) {
        SpringApplication.run(LostFoundApplication.class, args);
    }
}
