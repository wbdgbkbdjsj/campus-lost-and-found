package com.campus.lostfound.security;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 登录用户快照，由 JWT 解析后放入 SecurityContext。
 * Controller 里可用 {@code @AuthenticationPrincipal LoginUser loginUser} 获取。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class LoginUser {

    private Long id;
    private String username;

    /** STUDENT / AUDITOR / ADMIN */
    private String role;
}
