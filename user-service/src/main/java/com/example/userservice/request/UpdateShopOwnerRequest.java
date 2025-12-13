package com.example.userservice.request;

import jakarta.validation.constraints.Size;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class UpdateShopOwnerRequest {
    @Size(min = 2, max = 100, message = "Shop name must be between 2 and 100 characters")
    private String shopName;

    @Size(min = 2, max = 50, message = "Owner name must be between 2 and 50 characters")
    private String ownerName;

    private String email;

    @Size(max = 255, message = "Address must not exceed 255 characters")
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

    private String userId;
}
