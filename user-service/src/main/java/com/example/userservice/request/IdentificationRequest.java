package com.example.userservice.request;

import lombok.Data;

@Data
public class IdentificationRequest {
    private String identificationType; // CCCD, CMND, HO_CHIEU
    private String identificationNumber; // Số CCCD/CMND/Hộ chiếu
    private String fullName; // Họ & Tên
    private String imageFrontUrl; // Hình chụp mặt trước (có thể null)
    private String imageBackUrl; // Hình chụp mặt sau (có thể null)
}
