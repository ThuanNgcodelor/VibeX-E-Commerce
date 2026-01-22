package com.example.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GhnCalculateFeeRequest {
    
    @JsonProperty("from_district_id")
    private Integer fromDistrictId;
    
    @JsonProperty("from_ward_code")
    private String fromWardCode;
    
    @JsonProperty("to_district_id")
    private Integer toDistrictId;
    
    @JsonProperty("to_ward_code")
    private String toWardCode;
    
    @JsonProperty("weight")
    private Integer weight; // Gram
    
    @JsonProperty("length")
    private Integer length; // cm
    
    @JsonProperty("width")
    private Integer width; // cm
    
    @JsonProperty("height")
    private Integer height; // cm
    
    @JsonProperty("service_id")
    private Integer serviceId; // GHN Service ID 
    
    @JsonProperty("service_type_id")
    private Integer serviceTypeId; // 2 = Standard, 5 = Express (optional)

    @JsonProperty("insurance_value")
    private Integer insuranceValue; // Required (max 5.000.000 for standard)

    @JsonProperty("coupon")
    private String coupon; // Optional
}

