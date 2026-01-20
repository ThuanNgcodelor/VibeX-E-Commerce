package com.example.userservice.request;

import lombok.Data;

@Data
public class ShopOwnerRegisterRequest {
    // Thông tin cơ bản của Shop
    private String shopName;
    private String ownerName;
    private String phone;
    private String email;

    // Thông tin địa chỉ GHN (AddressCreateRequest mà bạn đang tìm)
    private Integer provinceId;
    private String provinceName;
    private Integer districtId;
    private String districtName;
    private String wardCode;
    private String wardName;
    private String streetAddress;

    // Tọa độ (nếu có)
    private Double latitude;
    private Double longitude;
}