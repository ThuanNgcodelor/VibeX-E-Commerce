package com.example.stockservice.service.ai;

import org.springframework.stereotype.Component;

import java.util.regex.Pattern;

/**
 * Utility class để xử lý ngôn ngữ
 * Chỉ cho phép tiếng Việt và tiếng Anh
 */
@Component
public class LanguageFilter {

    // Pattern để detect các ký tự không phải Latin/Vietnamese
    // Chinese characters: \u4E00-\u9FFF (CJK Unified Ideographs)
    // Japanese Hiragana: \u3040-\u309F
    // Japanese Katakana: \u30A0-\u30FF
    // Korean Hangul: \uAC00-\uD7AF
    private static final Pattern BLOCKED_CHARS = Pattern.compile(
            "[\\u4E00-\\u9FFF\\u3040-\\u309F\\u30A0-\\u30FF\\uAC00-\\uD7AF]+"
    );

    // Vietnamese characters (dấu)
    private static final Pattern VIETNAMESE_CHARS = Pattern.compile(
            "[àáảãạăằắẳẵặâầấẩẫậèéẻẽẹêềếểễệìíỉĩịòóỏõọôồốổỗộơờớởỡợùúủũụưừứửữựỳýỷỹỵđ]",
            Pattern.CASE_INSENSITIVE
    );

    /**
     * Kiểm tra message có chứa ký tự ngôn ngữ bị chặn không
     */
    public boolean containsBlockedLanguage(String message) {
        if (message == null || message.isEmpty()) {
            return false;
        }
        return BLOCKED_CHARS.matcher(message).find();
    }

    /**
     * Kiểm tra message có phải tiếng Việt không
     */
    public boolean isVietnamese(String message) {
        if (message == null || message.isEmpty()) {
            return false;
        }
        return VIETNAMESE_CHARS.matcher(message).find();
    }

    /**
     * Lọc bỏ các ký tự ngôn ngữ bị chặn từ response của AI
     */
    public String filterBlockedLanguage(String response) {
        if (response == null || response.isEmpty()) {
            return response;
        }
        return BLOCKED_CHARS.matcher(response).replaceAll("");
    }

    /**
     * Lấy thông báo lỗi khi phát hiện ngôn ngữ bị chặn
     */
    public String getBlockedLanguageError(boolean isVietnamese) {
        if (isVietnamese) {
            return "Xin lỗi, tôi chỉ hỗ trợ tiếng Việt và tiếng Anh. Vui lòng nhập lại bằng một trong hai ngôn ngữ này.";
        }
        return "Sorry, I only support Vietnamese and English. Please try again in one of these languages.";
    }
}
