package com.example.userservice.service.shopowner;

import com.example.userservice.client.FileStorageClient;
import com.example.userservice.exception.NotFoundException;
import com.example.userservice.model.ShopOwner;
import com.example.userservice.repository.ShopOwnerRepository;
import com.example.userservice.request.UpdateShopOwnerRequest;
import lombok.RequiredArgsConstructor;
import org.modelmapper.ModelMapper;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

@RequiredArgsConstructor
@Service("shopOwnerService")
public class ShopOwnerServiceImpl implements ShopOwnerService {
    private final ShopOwnerRepository shopOwnerRepository;
    private final FileStorageClient fileStorageClient;
    private final com.example.userservice.repository.ShopFollowRepository shopFollowRepository;

    @Override
    public ShopOwner updateShopOwner(UpdateShopOwnerRequest request, MultipartFile file) {
        ShopOwner toUpdate = shopOwnerRepository.getReferenceById(request.getUserId());

        // Update fields from request
        if (request.getShopName() != null) {
            toUpdate.setShopName(request.getShopName());
        }
        if (request.getOwnerName() != null) {
            toUpdate.setOwnerName(request.getOwnerName());
        }
        if (request.getEmail() != null) {
            toUpdate.setEmail(request.getEmail());
        }
        if (request.getAddress() != null) {
            toUpdate.setAddress(request.getAddress());
        }

        // Update GHN address fields
        if (request.getProvinceId() != null) {
            toUpdate.setProvinceId(request.getProvinceId());
        }
        if (request.getProvinceName() != null) {
            toUpdate.setProvinceName(request.getProvinceName());
        }
        if (request.getDistrictId() != null) {
            toUpdate.setDistrictId(request.getDistrictId());
        }
        if (request.getDistrictName() != null) {
            toUpdate.setDistrictName(request.getDistrictName());
        }
        if (request.getWardCode() != null) {
            toUpdate.setWardCode(request.getWardCode());
        }
        if (request.getWardName() != null) {
            toUpdate.setWardName(request.getWardName());
        }
        if (request.getStreetAddress() != null) {
            toUpdate.setStreetAddress(request.getStreetAddress());
        }
        if (request.getPhone() != null) {
            toUpdate.setPhone(request.getPhone());
        }
        if (request.getLatitude() != null) {
            toUpdate.setLatitude(request.getLatitude());
        }
        if (request.getLongitude() != null) {
            toUpdate.setLongitude(request.getLongitude());
        }

        // Upload image if provided
        if (file != null && !file.isEmpty()) {
            String imageId = fileStorageClient.uploadImageToFIleSystem(file).getBody();
            if (imageId != null) {
                toUpdate.setImageUrl(imageId);
            }
        }

        return shopOwnerRepository.save(toUpdate);
    }

    @Override
    public ShopOwner getShopOwnerByUserId(String userId) {
        ShopOwner shopOwner = shopOwnerRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Shop owner not found with userId: " + userId));

        // Populate stats
        try {
            // Followers count
            int followersCount = (int) shopFollowRepository.countByShopId(userId);
            System.out.println("DEBUG: Shop Stats - userId: " + userId + ", followers: " + followersCount);
            shopOwner.setFollowersCount(followersCount);

            // Save updated stats (optional, serves as cache)
            shopOwnerRepository.save(shopOwner);

        } catch (Exception e) {
            // Log error but don't fail the request
            System.err.println("Error fetching shop stats: " + e.getMessage());
            e.printStackTrace();
        }

        return shopOwner;
    }
}