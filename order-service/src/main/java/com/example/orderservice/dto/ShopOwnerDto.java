package com.example.orderservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopOwnerDto {
    private String userId;
    private String shopName;
    private String ownerName;
    private String address;

    // GHN Address Fields
    private Integer provinceId;
    private String provinceName;
    private Integer districtId;
    private String districtName;
    private String wardCode;
    private String wardName;
    private String streetAddress;
    private String phone;
    private Double latitude;
    private Double longitude;

    private Boolean verified;
    private Integer totalRatings;
    private Integer followersCount;
    private Integer followingCount;
    private String imageUrl;
    private String email;
    private LocalDateTime createdAt;
    private LocalDateTime updatedAt;
    private String active;
}
