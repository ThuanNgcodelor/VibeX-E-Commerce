package com.example.stockservice.model;

import com.fasterxml.jackson.annotation.JsonIgnore;
import jakarta.persistence.*;
import lombok.*;

@Entity(name = "cart_items")
@Builder
@AllArgsConstructor
@NoArgsConstructor
@Getter
@Setter
public class CartItem extends BaseEntity {
    @ManyToOne
    @JoinColumn(name = "product_id", nullable = false)
    private Product product;
    
    @ManyToOne
    @JoinColumn(name = "size_id")
    private Size size;

    private int quantity;
    private double unitPrice;
    private double totalPrice;

    @JsonIgnore
    @ManyToOne
    @JoinColumn(name = "cart_id", nullable = false)
    private Cart cart;
    private boolean isFlashSale;
    
    // Live commerce fields (previously only in RedisCartItemDto)
    private String liveRoomId;      // ID phòng live (null nếu mua bình thường)
    private String liveProductId;   // ID trong bảng live_products
    private Double livePrice;       // Giá live tại thời điểm thêm
    private Double originalPrice;   // Giá gốc (để hiển thị gạch ngang)
    private Boolean isFromLive;     // Flag đánh dấu item từ live

    public void setTotalPrice() {
        this.totalPrice = this.unitPrice * this.quantity;
    }

    @Transient
    private Boolean priceChanged;
    @Transient
    private Double oldPrice;
    @Transient
    private Integer availableStock;
    @Transient
    private Boolean productAvailable;
    @Transient
    private Boolean sizeAvailable;
}
