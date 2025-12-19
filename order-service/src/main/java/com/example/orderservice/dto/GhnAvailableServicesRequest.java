package com.example.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GhnAvailableServicesRequest {
    
    @JsonProperty("shop_id")
    private Integer shopId;
    
    @JsonProperty("from_district")
    private Integer fromDistrict;
    
    @JsonProperty("to_district")
    private Integer toDistrict;
}
