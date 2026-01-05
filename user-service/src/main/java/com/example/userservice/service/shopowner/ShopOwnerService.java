package com.example.userservice.service.shopowner;

import com.example.userservice.model.ShopOwner;
import com.example.userservice.request.UpdateShopOwnerRequest;
import org.springframework.web.multipart.MultipartFile;

public interface ShopOwnerService {
    ShopOwner updateShopOwner(UpdateShopOwnerRequest request, MultipartFile file);

    ShopOwner getShopOwnerByUserId(String userId);
}
