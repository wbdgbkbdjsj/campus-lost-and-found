package com.campus.lostfound.common;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * 统一响应体：{ code, message, data }。
 * 前端 axios 拦截器统一解包 data，HTTP 状态码正常时一律为 200。
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class Result<T> {

    private int code;
    private String message;
    private T data;

    public static <T> Result<T> success(T data) {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), data);
    }

    public static Result<Void> success() {
        return new Result<>(ResultCode.SUCCESS.getCode(), ResultCode.SUCCESS.getMessage(), null);
    }

    public static <T> Result<T> fail(ResultCode resultCode) {
        return new Result<>(resultCode.getCode(), resultCode.getMessage(), null);
    }

    public static <T> Result<T> fail(int code, String message) {
        return new Result<>(code, message, null);
    }
}
