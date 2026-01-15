package com.example.stockservice.dto;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;
import lombok.Data;

@Data
@JsonIgnoreProperties(ignoreUnknown = true)
public class ShopOwnerDto {
    private String userId;
    private String shopName;
    private String ownerName;
    private String imageUrl;
    private String active;
}
