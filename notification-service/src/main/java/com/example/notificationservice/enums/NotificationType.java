package com.example.notificationservice.enums;

/**
 * Enum for different types of notifications
 */
public enum NotificationType {
    // Existing order-related
    ORDER_STATUS,
    PAYMENT,
    
    // Admin broadcast
    ADMIN_BROADCAST,
    SYSTEM_MAINTENANCE,
    
    // Shop owner notifications
    SHOP_ANNOUNCEMENT,
    SHOP_FLASH_SALE,
    SHOP_NEW_PRODUCT,
    SHOP_PROMOTION
}
