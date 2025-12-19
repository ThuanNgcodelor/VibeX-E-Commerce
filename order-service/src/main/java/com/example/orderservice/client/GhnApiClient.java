package com.example.orderservice.client;

import com.example.orderservice.dto.GhnCreateOrderRequest;
import com.example.orderservice.dto.GhnCreateOrderResponse;
import com.example.orderservice.dto.GhnCalculateFeeRequest;
import com.example.orderservice.dto.GhnCalculateFeeResponse;
import com.example.orderservice.dto.GhnAvailableServicesRequest;
import com.example.orderservice.dto.GhnAvailableServicesResponse;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestTemplate;

@Component
@Slf4j
public class GhnApiClient {
    
    @Value("${ghn.api.url}")
    private String apiUrl;
    
    @Value("${ghn.api.token}")
    private String apiToken;
    
    @Value("${ghn.shop.id:0}")
    private Integer shopId;
    
    private final RestTemplate restTemplate;
    
    public GhnApiClient() {
        this.restTemplate = new RestTemplate();
    }
    
    /**
     * Tạo đơn vận chuyển GHN
     */
    public GhnCreateOrderResponse createOrder(GhnCreateOrderRequest request) {
        // Validate GHN configuration
        if (shopId == null || shopId == 0) {
            throw new RuntimeException("GHN Shop ID is not configured. Please set ghn.shop.id in application.properties");
        }
        if (apiToken == null || apiToken.isBlank() || apiToken.contains("YOUR_STAGING_TOKEN")) {
            throw new RuntimeException("GHN Token is not configured. Please set ghn.api.token in application.properties");
        }
        
        String url = apiUrl + "/v2/shipping-order/create";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Token", apiToken);
        headers.set("ShopId", shopId.toString());
        
        HttpEntity<GhnCreateOrderRequest> entity = new HttpEntity<>(request, headers);
        
        log.info("[GHN API] Creating order - to: {}, district: {}, ward: {}, weight: {}g", 
            request.getToName(), request.getToDistrictId(), 
            request.getToWardCode(), request.getWeight());
        
        try {
            ResponseEntity<GhnCreateOrderResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                GhnCreateOrderResponse.class
            );
            
            GhnCreateOrderResponse body = response.getBody();
            
            if (body != null && body.getCode() == 200) {
                log.info("[GHN API] SUCCESS - Order Code: {}, Fee: {} VNĐ", 
                    body.getData().getOrderCode(), 
                    body.getData().getTotalFee());
            } else {
                log.error("[GHN API] ERROR - Code: {}, Message: {}", 
                    body != null ? body.getCode() : "null", 
                    body != null ? body.getMessage() : "null");
            }
            
            return body;
            
        } catch (Exception e) {
            log.error("[GHN API] Exception: {}", e.getMessage(), e);
            throw new RuntimeException("GHN API call failed: " + e.getMessage());
        }
    }
    
    /**
     * Tính phí ship (trước khi tạo order)
     */
    public GhnCalculateFeeResponse calculateFee(GhnCalculateFeeRequest request) {
        // Validate GHN configuration
        if (shopId == null || shopId == 0) {
            throw new RuntimeException("GHN Shop ID is not configured. Please set ghn.shop.id in application.properties");
        }
        if (apiToken == null || apiToken.isBlank() || apiToken.contains("YOUR_STAGING_TOKEN")) {
            throw new RuntimeException("GHN Token is not configured. Please set ghn.api.token in application.properties");
        }
        
        String url = apiUrl + "/v2/shipping-order/fee";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Token", apiToken);
        headers.set("ShopId", shopId.toString());
        
        HttpEntity<GhnCalculateFeeRequest> entity = new HttpEntity<>(request, headers);
        
        log.info("[GHN API] Calculating fee - from: {}, to: {}, weight: {}g", 
            request.getFromDistrictId(), request.getToDistrictId(), request.getWeight());
        
        try {
            ResponseEntity<GhnCalculateFeeResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                GhnCalculateFeeResponse.class
            );
            
            GhnCalculateFeeResponse body = response.getBody();
            
            if (body != null && body.getCode() == 200) {
                log.info("[GHN API] Fee calculated: {} VNĐ", body.getData().getTotal());
            } else {
                log.error("[GHN API] Fee calculation error - Code: {}, Message: {}", 
                    body != null ? body.getCode() : "null", 
                    body != null ? body.getMessage() : "null");
            }
            
            return body;
            
        } catch (Exception e) {
            log.error("[GHN API] Fee calculation exception: {}", e.getMessage(), e);
            throw new RuntimeException("GHN fee calculation failed: " + e.getMessage());
        }
    }
    
    /**
     * Lấy danh sách dịch vụ khả dụng cho tuyến giao hàng
     * API này cần gọi trước khi tạo đơn để lấy service_type_id hợp lệ
     */
    public GhnAvailableServicesResponse getAvailableServices(Integer fromDistrictId, Integer toDistrictId) {
        // Validate GHN configuration
        if (shopId == null || shopId == 0) {
            throw new RuntimeException("GHN Shop ID is not configured. Please set ghn.shop.id in application.properties");
        }
        if (apiToken == null || apiToken.isBlank() || apiToken.contains("YOUR_STAGING_TOKEN")) {
            throw new RuntimeException("GHN Token is not configured. Please set ghn.api.token in application.properties");
        }
        
        String url = apiUrl + "/v2/shipping-order/available-services";
        
        HttpHeaders headers = new HttpHeaders();
        headers.setContentType(MediaType.APPLICATION_JSON);
        headers.set("Token", apiToken);
        
        GhnAvailableServicesRequest request = GhnAvailableServicesRequest.builder()
                .shopId(shopId)
                .fromDistrict(fromDistrictId)
                .toDistrict(toDistrictId)
                .build();
        
        HttpEntity<GhnAvailableServicesRequest> entity = new HttpEntity<>(request, headers);
        
        log.info("[GHN API] Getting available services - from district: {}, to district: {}", 
            fromDistrictId, toDistrictId);
        
        try {
            ResponseEntity<GhnAvailableServicesResponse> response = restTemplate.exchange(
                url,
                HttpMethod.POST,
                entity,
                GhnAvailableServicesResponse.class
            );
            
            GhnAvailableServicesResponse body = response.getBody();
            
            if (body != null && body.getCode() == 200 && body.getData() != null) {
                log.info("[GHN API] Available services found: {}", body.getData().size());
                for (GhnAvailableServicesResponse.ServiceData service : body.getData()) {
                    log.info("[GHN API] Service: {} (id: {}, type: {})", 
                        service.getShortName(), service.getServiceId(), service.getServiceTypeId());
                }
            } else {
                log.error("[GHN API] Get services error - Code: {}, Message: {}", 
                    body != null ? body.getCode() : "null", 
                    body != null ? body.getMessage() : "null");
            }
            
            return body;
            
        } catch (Exception e) {
            log.error("[GHN API] Get services exception: {}", e.getMessage(), e);
            throw new RuntimeException("GHN get available services failed: " + e.getMessage());
        }
    }
}

