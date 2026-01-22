package com.example.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GhnCreateOrderRequest {
    
    @JsonProperty("payment_type_id")
    private Integer paymentTypeId; // 2 = Người nhận trả phí
    
    @JsonProperty("required_note")
    private String requiredNote; // "CHOXEMHANGKHONGTHU"
    
    @JsonProperty("to_name")
    private String toName;
    
    @JsonProperty("to_phone")
    private String toPhone;
    
    @JsonProperty("to_address")
    private String toAddress;
    
    @JsonProperty("to_ward_code")
    private String toWardCode;
    
    @JsonProperty("to_district_id")
    private Integer toDistrictId;
    
    // FROM address (Shop address) - Optional, GHN sẽ lấy từ ShopId nếu không có
    @JsonProperty("from_name")
    private String fromName;
    
    @JsonProperty("from_phone")
    private String fromPhone;
    
    @JsonProperty("from_address")
    private String fromAddress;
    
    @JsonProperty("from_ward_code")
    private String fromWardCode;
    
    @JsonProperty("from_district_id")
    private Integer fromDistrictId;
    
    @JsonProperty("cod_amount")
    private Long codAmount; // Tiền thu hộ
    
    @JsonProperty("weight")
    private Integer weight; // Gram
    
    @JsonProperty("length")
    private Integer length; // cm
    
    @JsonProperty("width")
    private Integer width; // cm
    
    @JsonProperty("height")
    private Integer height; // cm
    
    @JsonProperty("service_type_id")
    private Integer serviceTypeId; // 2 = Standard, 5 = Express

    @JsonProperty("insurance_value")
    private Integer insuranceValue; // Required (max 5.000.000 for standard)
    
    @JsonProperty("coupon")
    private String coupon; // Optional
    
    @JsonProperty("items")
    private List<GhnItemDto> items;
}

