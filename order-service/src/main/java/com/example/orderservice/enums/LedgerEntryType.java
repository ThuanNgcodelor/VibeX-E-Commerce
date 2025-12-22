package com.example.orderservice.enums;

public enum LedgerEntryType {
    EARNING,        // Thu nhập từ order COMPLETED
    PAYOUT,         // Rút tiền
    ADJUST,         // Điều chỉnh (admin)
    FEE_DEDUCTION   // Trừ phí
    ,SUBSCRIPTION_PAYMENT
}

