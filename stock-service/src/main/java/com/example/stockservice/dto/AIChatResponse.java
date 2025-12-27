package com.example.stockservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class AIChatResponse {
    private String message;
    private String conversationId;
    private boolean success;
    private String error;
    
    /**
     * Loại response: text, products, cart_action, faq
     */
    private String type;
    
    /**
     * Danh sách sản phẩm (khi type = products)
     */
    private List<ProductDto> products;
    
    /**
     * Kết quả action (added, removed, viewed)
     */
    private String actionResult;
    
    /**
     * Số lượng sản phẩm trong giỏ hàng (sau khi add)
     */
    private Integer cartItemCount;
}
