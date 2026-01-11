package com.example.userservice.enums;

public enum WalletEntryType {
    REFUND, // Refund từ order bị hủy
    WITHDRAWAL, // Rút tiền về tài khoản ngân hàng
    DEPOSIT, // Nạp tiền vào ví
    ADJUST, // Điều chỉnh (admin)
    SUBSCRIPTION_FEE,
    PAYMENT // Thanh toán đơn hàng
}
