package com.example.orderservice.enums;

public enum OrderStatus {
    PENDING,           // Đơn mới, chờ shop xác nhận
    CONFIRMED,         // Shop đã xác nhận, đang chuẩn bị hàng
    READY_TO_SHIP,     // Đã đóng gói, sẵn sàng giao cho shipper
    SHIPPED,           // Shipper đã lấy hàng, đang giao
    DELIVERED,         // Đã giao thành công
    COMPLETED,         // Khách đã xác nhận nhận hàng
    CANCELLED,         // Đã hủy
    RETURNED;          // Đã hoàn trả
}
