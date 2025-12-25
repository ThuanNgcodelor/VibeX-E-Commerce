package com.example.userservice.request.shopCoin;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@Builder
@AllArgsConstructor
@NoArgsConstructor
public class ShopCoinAddPointsRequest {
    private Long points;
    private String description;
}
