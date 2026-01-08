package com.example.orderservice.load;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Simple test user structure
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class TestUser {
    private String userId;
    private String username;
    private String addressId;
    
    // For API calls (if needed)
    private String token;
}
