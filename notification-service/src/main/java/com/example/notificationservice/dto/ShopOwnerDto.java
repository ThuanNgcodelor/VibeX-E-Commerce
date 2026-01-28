package com.example.notificationservice.dto;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class ShopOwnerDto {
    private String userId;
    private String shopName;
    private String ownerName;
    private String address;
    private String phone;
    private String imageUrl; // This is likely the logo
    private String email;

    public String getUserId() { return userId; }
    public String getShopName() { return shopName; }
    public String getOwnerName() { return ownerName; }
    public String getAddress() { return address; }
    public String getPhone() { return phone; }
    public String getImageUrl() { return imageUrl; }
    public String getEmail() { return email; }
}
