package com.example.userservice.request;

import lombok.Data;

@Data
public class AdvertisementRequest {
    private String shopId;
    private String title;
    private String description;
    private String adType;
    private String imageUrl;
    private String targetUrl;
    private Integer durationDays;
}
