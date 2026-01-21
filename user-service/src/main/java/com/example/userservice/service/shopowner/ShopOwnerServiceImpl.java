package com.example.userservice.service.shopowner;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.example.userservice.client.FileStorageClient;
import com.example.userservice.exception.NotFoundException;
import com.example.userservice.model.ShopOwner;
import com.example.userservice.repository.ShopOwnerRepository;
import com.example.userservice.request.UpdateShopOwnerRequest;

import lombok.RequiredArgsConstructor;

@RequiredArgsConstructor
@Service("shopOwnerService")
public class ShopOwnerServiceImpl implements ShopOwnerService {
    private final ShopOwnerRepository shopOwnerRepository;
    private final FileStorageClient fileStorageClient;
    private final com.example.userservice.repository.ShopFollowRepository shopFollowRepository;
    private final com.example.userservice.client.StockServiceClient stockServiceClient;
    private final com.example.userservice.client.OrderServiceClient orderServiceClient;
    private final com.example.userservice.client.NotificationServiceClient notificationServiceClient;

    @Override
    public ShopOwner updateShopOwner(UpdateShopOwnerRequest request, MultipartFile file, MultipartFile headerImage) {
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

        // Update header style
        if (request.getHeaderStyle() != null) {
            toUpdate.setHeaderStyle(request.getHeaderStyle());
        }

        // Upload image if provided
        if (file != null && !file.isEmpty()) {
            String imageId = fileStorageClient.uploadImageToFIleSystem(file).getBody();
            if (imageId != null) {
                toUpdate.setImageUrl(imageId);
            }
        }

        // Upload header image if provided
        if (headerImage != null && !headerImage.isEmpty()) {
            String headerImageId = fileStorageClient.uploadImageToFIleSystem(headerImage).getBody();
            if (headerImageId != null) {
                toUpdate.setHeaderImageUrl(headerImageId);
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

            // Following count
            int followingCount = (int) shopFollowRepository.countByFollowerId(userId);
            System.out.println("DEBUG: Shop Stats - userId: " + userId + ", following: " + followingCount);
            shopOwner.setFollowingCount(followingCount);

            // Total Ratings from Stock Service
            org.springframework.http.ResponseEntity<Long> response = stockServiceClient.getShopReviewCount(userId);
            System.out.println("DEBUG: Shop Stats - userId: " + userId + ", ratings response: " + response.getBody());
            if (response != null && response.getBody() != null) {
                shopOwner.setTotalRatings(response.getBody().intValue());
            }

            // Save updated stats (optional, serves as cache)
            shopOwnerRepository.save(shopOwner);

        } catch (Exception e) {
            // Log error but don't fail the request
            System.err.println("Error fetching shop stats: " + e.getMessage());
            e.printStackTrace();
        }

        return shopOwner;
    }

    @Override
    public java.util.List<com.example.userservice.dto.ShopOwnerStatsDto> getAllShopOwnersWithStats() {
        java.util.List<ShopOwner> shopOwners = shopOwnerRepository.findAll();

        return shopOwners.stream().map(shopOwner -> {
            String shopId = shopOwner.getUserId();
            long productCount = 0;
            long orderCount = 0;
            double revenue = 0.0;
            int totalRatings = 0;

            // 1. Get Product Count
            try {
                org.springframework.http.ResponseEntity<Long> productRes = stockServiceClient
                        .getShopProductCount(shopId);
                if (productRes.getBody() != null) {
                    productCount = productRes.getBody();
                }
            } catch (Exception e) {
                // Ignore
            }

            // 2. Get Order Stats (Count + Revenue)
            try {
                org.springframework.http.ResponseEntity<java.util.Map<String, Object>> orderRes = orderServiceClient
                        .getShopOrderStats(shopId);
                if (orderRes.getBody() != null) {
                    java.util.Map<String, Object> stats = orderRes.getBody();
                    if (stats.containsKey("completed")) {
                        orderCount += ((Number) stats.get("completed")).longValue();
                    }
                    if (stats.containsKey("totalRevenue")) {
                        revenue = ((Number) stats.get("totalRevenue")).doubleValue();
                    }
                }
            } catch (Exception e) {
                // Ignore
            }

            // 3. Get Ratings
            try {
                org.springframework.http.ResponseEntity<Long> ratingRes = stockServiceClient.getShopReviewCount(shopId);
                if (ratingRes.getBody() != null) {
                    totalRatings = ratingRes.getBody().intValue();
                }
            } catch (Exception e) {
                // Ignore
            }

            // 4. Get Detailed Stats
            java.util.List<java.util.Map<String, Object>> revenueTrend = new java.util.ArrayList<>();
            java.util.List<java.util.Map<String, Object>> productCategoryStats = new java.util.ArrayList<>();
            java.util.List<java.util.Map<String, Object>> orderStatusDistribution = new java.util.ArrayList<>();

            try {
                org.springframework.http.ResponseEntity<java.util.List<java.util.Map<String, Object>>> trendRes = orderServiceClient
                        .getShopRevenueTrend(shopId);
                if (trendRes.getBody() != null)
                    revenueTrend = trendRes.getBody();
            } catch (Exception e) {
            }

            try {
                org.springframework.http.ResponseEntity<java.util.List<java.util.Map<String, Object>>> catRes = stockServiceClient
                        .getShopCategoryStats(shopId);
                if (catRes.getBody() != null)
                    productCategoryStats = catRes.getBody();
            } catch (Exception e) {
            }

            try {
                org.springframework.http.ResponseEntity<java.util.List<java.util.Map<String, Object>>> statusRes = orderServiceClient
                        .getShopOrderStatusDistribution(shopId);
                if (statusRes.getBody() != null)
                    orderStatusDistribution = statusRes.getBody();
            } catch (Exception e) {
            }

            return com.example.userservice.dto.ShopOwnerStatsDto.builder()
                    .userId(shopOwner.getUserId())
                    .shopName(shopOwner.getShopName())
                    .ownerName(shopOwner.getOwnerName())
                    .email(shopOwner.getEmail())
                    .phone(shopOwner.getPhone())
                    .totalProducts(productCount)
                    .totalOrders(orderCount) // Completed orders
                    .totalRevenue(revenue)
                    .totalRatings(totalRatings)
                    .status(shopOwner.getActive() == com.example.userservice.enums.Active.INACTIVE ? "LOCKED"
                            : (shopOwner.getVerified() ? "ACTIVE" : "PENDING"))
                    .revenueTrend(revenueTrend)
                    .productCategoryStats(productCategoryStats)
                    .orderStatusDistribution(orderStatusDistribution)
                    .build();
        }).collect(java.util.stream.Collectors.toList());
    }

    @Override
    public ShopOwner toggleShopStatus(String userId) {
        ShopOwner shopOwner = shopOwnerRepository.findById(userId)
                .orElseThrow(() -> new NotFoundException("Shop owner not found with userId: " + userId));

        if (shopOwner.getActive() == com.example.userservice.enums.Active.ACTIVE) {
            shopOwner.setActive(com.example.userservice.enums.Active.INACTIVE);
            
            // Send notification when shop is locked
            try {
                com.example.userservice.request.SendNotificationRequest notificationRequest = new com.example.userservice.request.SendNotificationRequest();
                notificationRequest.setUserId(userId);
                notificationRequest.setShopId(userId);
                notificationRequest.setMessage("Your shop has been locked by admin due to violation of policies."); // "message phải là tiếng anh"
                notificationRequest.setIsShopOwnerNotification(true);
                
                notificationServiceClient.sendNotification(notificationRequest);
            } catch (Exception e) {
                System.err.println("Failed to send lock notification: " + e.getMessage());
            }

        } else {
            shopOwner.setActive(com.example.userservice.enums.Active.ACTIVE);
            
             // Send notification when shop is unlocked (Optional)
             try {
                com.example.userservice.request.SendNotificationRequest notificationRequest = new com.example.userservice.request.SendNotificationRequest();
                notificationRequest.setUserId(userId);
                notificationRequest.setShopId(userId);
                notificationRequest.setMessage("Your shop has been unlocked. You can now resume your business.");
                notificationRequest.setIsShopOwnerNotification(true);
                
                notificationServiceClient.sendNotification(notificationRequest);
            } catch (Exception e) {
                System.err.println("Failed to send unlock notification: " + e.getMessage());
            }
        }

        return shopOwnerRepository.save(shopOwner);
    }
}