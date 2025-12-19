package com.example.orderservice.dto;

import com.fasterxml.jackson.annotation.JsonProperty;
import lombok.*;
import java.util.List;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class GhnAvailableServicesResponse {
    
    private Integer code;
    private String message;
    private List<ServiceData> data;
    
    @Data
    @Builder
    @NoArgsConstructor
    @AllArgsConstructor
    public static class ServiceData {
        
        @JsonProperty("service_id")
        private Integer serviceId;
        
        @JsonProperty("short_name")
        private String shortName;
        
        @JsonProperty("service_type_id")
        private Integer serviceTypeId;
    }
}
