package com.example.orderservice.load;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Component;

import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

/**
 * Provides test data: users and products
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class TestDataProvider {
    private final JdbcTemplate jdbcTemplate;
    
    /**
     * Get or create test users
     */
    public List<TestUser> getOrCreateUsers(int count, String prefix) {
        log.info("Creating {} test users with prefix: {}", count, prefix);
        List<TestUser> users = new ArrayList<>();
        
        for (int i = 0; i < count; i++) {
            String username = prefix + i;
            String userId = UUID.randomUUID().toString();
            String addressId = UUID.randomUUID().toString();
            
            try {
                // Insert user
                jdbcTemplate.update(
                    "INSERT INTO users (id, username, email, role, created_at, updated_at) " +
                    "VALUES (?, ?, ?, 'USER', NOW(), NOW())",
                    userId, username, username + "@loadtest.com"
                );
                
                // Insert default address
                jdbcTemplate.update(
                    "INSERT INTO addresses (id, user_id, recipient_name, phone, province, district, ward, detail, is_default, created_at, updated_at) " +
                    "VALUES (?, ?, 'Load Test User', '0900000000', 'TP HCM', 'Q1', 'P1', 'Test Address', true, NOW(), NOW())",
                    addressId, userId
                );
                
                users.add(TestUser.builder()
                        .userId(userId)
                        .username(username)
                        .addressId(addressId)
                        .build());
                        
            } catch (Exception e) {
                log.warn("Failed to create user {}: {}", username, e.getMessage());
            }
        }
        
        log.info("Created {} test users successfully", users.size());
        return users;
    }
    
    /**
     * Get real products with available stock
     */
    public List<TestProduct> getAvailableProducts(int limit) {
        log.info("Fetching {} products with available stock", limit);
        
        List<TestProduct> products = jdbcTemplate.query(
            "SELECT p.id as product_id, p.name, s.id as size_id, s.stock " +
            "FROM products p " +
            "JOIN sizes s ON p.id = s.product_id " +
            "WHERE s.stock > 100 " +
            "ORDER BY s.stock DESC " +
            "LIMIT ?",
            (rs, rowNum) -> TestProduct.builder()
                .productId(rs.getString("product_id"))
                .productName(rs.getString("name"))
                .sizeId(rs.getString("size_id"))
                .availableStock(rs.getInt("stock"))
                .build(),
            limit
        );
        
        log.info("Found {} products with available stock", products.size());
        return products;
    }
    
    /**
     * Cleanup test users
     */
    public void cleanupTestUsers(String prefix) {
        log.info("Cleaning up test users with prefix: {}", prefix);
        
        try {
            // Delete orders first (foreign key)
            int ordersDeleted = jdbcTemplate.update(
                "DELETE o FROM orders o " +
                "INNER JOIN users u ON o.user_id = u.id " +
                "WHERE u.username LIKE ?",
                prefix + "%"
            );
            
            // Delete addresses
            int addressesDeleted = jdbcTemplate.update(
                "DELETE a FROM addresses a " +
                "INNER JOIN users u ON a.user_id = u.id " +
                "WHERE u.username LIKE ?",
                prefix + "%"
            );
            
            // Delete users
            int usersDeleted = jdbcTemplate.update(
                "DELETE FROM users WHERE username LIKE ?",
                prefix + "%"
            );
            
            log.info("Cleanup complete: {} users, {} addresses, {} orders deleted",
                usersDeleted, addressesDeleted, ordersDeleted);
                
        } catch (Exception e) {
            log.error("Failed to cleanup test users: {}", e.getMessage());
        }
    }
}
