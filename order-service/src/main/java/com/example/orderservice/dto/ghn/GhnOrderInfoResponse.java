package com.example.orderservice.dto.ghn;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.Data;
import lombok.NoArgsConstructor;
import lombok.AllArgsConstructor;

import java.util.List;

/**
 * DTO for GHN Order Info API Response
 * Used for polling order status from GHN
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
public class GhnOrderInfoResponse {
    
    private Integer code;
    private String message;
    private OrderData data;
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class OrderData {
        
        @JsonProperty("shop_id")
        private Integer shopId;
        
        @JsonProperty("client_id")
        private Integer clientId;
        
        @JsonProperty("order_code")
        private String orderCode;
        
        @JsonProperty("client_order_code")
        private String clientOrderCode;
        
        private String status;
        
        @JsonProperty("cod_amount")
        private Integer codAmount;
        
        @JsonProperty("total_fee")
        private Integer totalFee;
        
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
        
        private Integer weight;
        
        @JsonProperty("converted_weight")
        private Integer convertedWeight;
        
        @JsonProperty("leadtime")
        private String leadtime;
        
        @JsonProperty("order_date")
        private String orderDate;
        
        @JsonProperty("finish_date")
        private String finishDate;
        
        @JsonProperty("updated_date")
        private String updatedDate;
        
        private List<LogEntry> log;
    }
    
    @Data
    @NoArgsConstructor
    @AllArgsConstructor
    public static class LogEntry {
        private String status;
        
        @JsonProperty("updated_date")
        private String updatedDate;
    }
}
