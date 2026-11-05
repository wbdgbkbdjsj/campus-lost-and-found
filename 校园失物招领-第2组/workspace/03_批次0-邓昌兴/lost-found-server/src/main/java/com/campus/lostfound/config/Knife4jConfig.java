package com.campus.lostfound.config;

import io.swagger.v3.oas.models.OpenAPI;
import io.swagger.v3.oas.models.info.Contact;
import io.swagger.v3.oas.models.info.Info;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

/**
 * Knife4j / OpenAPI 文档：http://localhost:8080/api/doc.html
 */
@Configuration
public class Knife4jConfig {

    @Bean
    public OpenAPI lostFoundOpenAPI() {
        return new OpenAPI().info(new Info()
                .title("校园失物招领与认领审核系统 API")
                .description("接口路径与字段以《api-contract-v0.md》为准")
                .version("v0.1")
                .contact(new Contact().name("第 2 组")));
    }
}
