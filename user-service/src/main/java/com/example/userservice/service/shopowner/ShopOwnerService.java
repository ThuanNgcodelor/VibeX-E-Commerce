package com.example.userservice.service.shopowner;

import com.example.userservice.model.ShopOwner;
import com.example.userservice.request.UpdateShopOwnerRequest;
import org.springframework.web.multipart.MultipartFile;

public interface ShopOwnerService {
    ShopOwner updateShopOwner(UpdateShopOwnerRequest request, MultipartFile file, MultipartFile headerImage);

    ShopOwner getShopOwnerByUserId(String userId);

    org.springframework.data.domain.Page<com.example.userservice.dto.ShopOwnerStatsDto> getAllShopOwnersWithStats(
            String search,
            org.springframework.data.domain.Pageable pageable,
            java.time.LocalDate startDate,
            java.time.LocalDate endDate,
            String sortBy,
            String sortDir);

    ShopOwner toggleShopStatus(String userId);

    ShopOwner verifyShop(String userId);
}
