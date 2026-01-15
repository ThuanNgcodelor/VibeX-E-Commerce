package com.example.userservice.service.shopowner;

import com.example.userservice.model.ShopOwner;
import com.example.userservice.request.UpdateShopOwnerRequest;
import org.springframework.web.multipart.MultipartFile;

public interface ShopOwnerService {
    ShopOwner updateShopOwner(UpdateShopOwnerRequest request, MultipartFile file, MultipartFile headerImage);

    ShopOwner getShopOwnerByUserId(String userId);

    java.util.List<com.example.userservice.dto.ShopOwnerStatsDto> getAllShopOwnersWithStats();

    ShopOwner toggleShopStatus(String userId);
}
