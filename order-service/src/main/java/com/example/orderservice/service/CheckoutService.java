package com.example.orderservice.service;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

import com.example.orderservice.dto.AddressDto;
import com.example.orderservice.dto.GhnCalculateFeeRequest;
import com.example.orderservice.dto.GhnCalculateFeeResponse;
import com.example.orderservice.dto.ShopOwnerDto;
import org.springframework.stereotype.Service;

import com.example.orderservice.client.GhnApiClient;
import com.example.orderservice.client.UserServiceClient;
import com.example.orderservice.dto.CheckoutPreviewRequest;
import com.example.orderservice.dto.CheckoutPreviewResponse;
import com.example.orderservice.dto.ShopSubscriptionDTO;
import com.example.orderservice.dto.VoucherValidateResponse;
import com.example.orderservice.model.PlatformVoucher;
import com.example.orderservice.repository.PlatformVoucherRepository;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;

@Service
@RequiredArgsConstructor
@Slf4j
public class CheckoutService {

    private final VoucherService voucherService;
    private final GhnApiClient ghnApiClient;
    private final UserServiceClient userServiceClient;
    private final PlatformVoucherRepository platformVoucherRepository;

    // Constants
    private static final BigDecimal MAX_COIN_DISCOUNT_PERCENT = BigDecimal.valueOf(0.5); // Max 50%
    private static final BigDecimal SHIPPING_SUBSIDY_FREESHIP_XTRA = BigDecimal.valueOf(30000); // 30k for XTRA
    private static final BigDecimal SHIPPING_SUBSIDY_GROWTH = BigDecimal.valueOf(15000); // 15k for Growth
    private static final BigDecimal COIN_VALUE_VND = BigDecimal.ONE; // 1 Coin = 1 VND

    /**
     * Preview Checkout Calculation
     */
    public CheckoutPreviewResponse previewCheckout(CheckoutPreviewRequest request) {
        log.info("Calculating checkout preview for user: {}", request.getUserId());

        // 0. Fetch User Address (Destination)
        AddressDto toAddress = null;
        if (request.getAddressId() != null) {
            try {
                var addrRes = userServiceClient.getAddressById(request.getAddressId());
                toAddress = addrRes.getBody();
            } catch (Exception e) {
                log.warn("Failed to fetch user address: {}", e.getMessage());
            }
        }

        // 1. Group items by Shop
        Map<String, List<CheckoutPreviewRequest.CheckoutItemDto>> itemsByShop = request.getSelectedItems().stream()
                .collect(Collectors.groupingBy(item -> 
                    item.getShopOwnerId() != null ? item.getShopOwnerId() : "unknown"));

        List<CheckoutPreviewResponse.ShopBreakdown> shopBreakdowns = new ArrayList<>();
        BigDecimal totalSubtotal = BigDecimal.ZERO;
        BigDecimal totalShippingFee = BigDecimal.ZERO;
        BigDecimal totalShopVoucherDiscount = BigDecimal.ZERO;

        // 2. Process each Shop
        for (Map.Entry<String, List<CheckoutPreviewRequest.CheckoutItemDto>> entry : itemsByShop.entrySet()) {
            String shopId = entry.getKey();
            List<CheckoutPreviewRequest.CheckoutItemDto> shopItems = entry.getValue();
            String shopName = shopItems.isEmpty() ? "Unknown Shop" : shopItems.get(0).getShopName();

            // 2.1 Calculate Item Subtotal
            BigDecimal shopSubtotal = calculateShopSubtotal(shopItems);
            totalSubtotal = totalSubtotal.add(shopSubtotal);

            // 2.2 Calculate Shipping Fee (Call GHN via Client)
            BigDecimal shippingFee = calculateShippingFee(shopId, toAddress, shopItems);
            
            // 2.3 Check Subscription for Shipping Discount
            BigDecimal shippingDiscount = BigDecimal.ZERO;
            boolean isFreeShipXtra = false;
            
            try {
                // Fetch Shop Plan
                var subResponse = userServiceClient.getSubscriptionByShopOwnerId(shopId);
                if (subResponse != null && subResponse.getBody() != null) {
                    ShopSubscriptionDTO plan = subResponse.getBody();
                    if (Boolean.TRUE.equals(plan.getFreeshipEnabled()) && Boolean.TRUE.equals(plan.getIsActive())) {
                        isFreeShipXtra = true;
                        // Determine subsidy level based on plan type or fixed value
                        // For simplicity: If FREESHIP_XTRA or BUSINESS_PRO -> 30k
                        shippingDiscount = SHIPPING_SUBSIDY_FREESHIP_XTRA;
                        
                        // Cap discount at actual shipping fee
                        if (shippingDiscount.compareTo(shippingFee) > 0) {
                            shippingDiscount = shippingFee;
                        }
                    }
                }
            } catch (Exception e) {
                log.warn("Failed to fetch subscription for shop {}: {}", shopId, e.getMessage());
            }

            BigDecimal finalShipping = shippingFee.subtract(shippingDiscount);
            totalShippingFee = totalShippingFee.add(finalShipping); // Add only what user pays

            // 2.4 Apply Shop Voucher
            BigDecimal shopDiscount = BigDecimal.ZERO;
            String appliedVoucherCode = null;
            
            // Find applicable voucher in request list
            // Assuming voucherCodes contains mixed shop/platform codes, we need to try validate
            if (request.getVoucherCodes() != null) {
                for (String code : request.getVoucherCodes()) {
                    VoucherValidateResponse validate = voucherService.validateShopVoucher(code, shopId, shopSubtotal);
                    if (validate.isValid()) {
                        shopDiscount = validate.getDiscount();
                        appliedVoucherCode = code;
                        break; // Only 1 shop voucher per shop
                    }
                }
            }
            totalShopVoucherDiscount = totalShopVoucherDiscount.add(shopDiscount);

            // 2.5 Final per Shop
            BigDecimal shopFinal = shopSubtotal.add(finalShipping).subtract(shopDiscount);
            
            shopBreakdowns.add(CheckoutPreviewResponse.ShopBreakdown.builder()
                    .shopOwnerId(shopId)
                    .shopName(shopName)
                    .itemSubtotal(shopSubtotal)
                    .shippingFee(shippingFee)
                    .shippingDiscount(shippingDiscount)
                    .isFreeShipXtra(isFreeShipXtra)
                    .shopVoucherCode(appliedVoucherCode)
                    .shopVoucherDiscount(shopDiscount)
                    .shopFinalAmount(shopFinal)
                    .build());
        }

        // 3. Platform Level
        BigDecimal totalBeforePlatform = totalSubtotal.add(totalShippingFee).subtract(totalShopVoucherDiscount);
        
        // 3.1 Apply Platform Voucher
        BigDecimal platformDiscount = BigDecimal.ZERO;
        String platformVoucherCode = null;
        
        if (request.getVoucherCodes() != null) {
            for (String code : request.getVoucherCodes()) {
                // Check if it's a Platform Voucher
                Optional<PlatformVoucher> pVoucher = platformVoucherRepository.findByCodeAndStatus(code);
                if (pVoucher.isPresent()) {
                    // Logic calculate Platform Discount
                    platformDiscount = calculatePlatformDiscount(pVoucher.get(), totalBeforePlatform); // Discount on Total
                    platformVoucherCode = code;
                    break; // Only 1 platform voucher
                }
            }
        }

        BigDecimal totalAfterPlatform = totalBeforePlatform.subtract(platformDiscount);

        // 3.2 Apply Coins
        Long coinsUsed = 0L;
        Long availableCoins = 0L;
        BigDecimal coinDiscount = BigDecimal.ZERO;

        if (request.isUseCoin() && request.getUserId() != null) {
            try {
                var coinRes = userServiceClient.getUserCoinBalance(request.getUserId());
                if (coinRes != null && coinRes.getBody() != null) {
                    availableCoins = coinRes.getBody();
                    
                    // Max 50% rule
                    BigDecimal maxDiscount = totalAfterPlatform.multiply(MAX_COIN_DISCOUNT_PERCENT);
                    BigDecimal coinValue = BigDecimal.valueOf(availableCoins); // 1 coin = 1 VND
                    
                    if (coinValue.compareTo(maxDiscount) > 0) {
                        coinDiscount = maxDiscount;
                    } else {
                        coinDiscount = coinValue;
                    }
                    
                    coinsUsed = coinDiscount.longValue();
                }
            } catch (Exception e) {
                log.warn("Failed to fetch user coin: {}", e.getMessage());
            }
        }

        if (coinDiscount.compareTo(BigDecimal.ZERO) < 0) coinDiscount = BigDecimal.ZERO;
        
        // 4. Final Amount
        BigDecimal finalAmount = totalAfterPlatform.subtract(coinDiscount);
        if (finalAmount.compareTo(BigDecimal.ZERO) < 0) finalAmount = BigDecimal.ZERO;

        return CheckoutPreviewResponse.builder()
                .subtotal(totalSubtotal)
                .totalShippingFee(totalShippingFee)
                .totalShopVoucherDiscount(totalShopVoucherDiscount)
                .totalPlatformVoucherDiscount(platformDiscount)
                .totalCoinDiscount(coinDiscount)
                .finalAmount(finalAmount)
                .availableCoins(availableCoins)
                .coinsUsed(coinsUsed)
                .platformVoucherCode(platformVoucherCode)
                .platformVoucherValue(platformDiscount)
                .shops(shopBreakdowns)
                .build();
    }

    private BigDecimal calculateShopSubtotal(List<CheckoutPreviewRequest.CheckoutItemDto> items) {
        return items.stream()
                .map(item -> {
                    BigDecimal price = BigDecimal.valueOf(item.getUnitPrice());
                    return price.multiply(BigDecimal.valueOf(item.getQuantity()));
                })
                .reduce(BigDecimal.ZERO, BigDecimal::add);
    }
    
    private BigDecimal calculateShippingFee(String shopId, AddressDto toAddress, List<CheckoutPreviewRequest.CheckoutItemDto> items) {
        // Fallback default
        BigDecimal defaultFee = BigDecimal.valueOf(30000);

        if (toAddress == null || toAddress.getDistrictId() == null) {
            return defaultFee;
        }

        try {
            // 1. Fetch Shop Address (Source)
            var shopRes = userServiceClient.getShopOwnerByUserId(shopId);
            ShopOwnerDto shop = shopRes.getBody();
            
            if (shop == null || shop.getDistrictId() == null) {
                log.warn("Shop {} has no configured address for shipping", shopId);
                return defaultFee;
            }
            
            // 2. Request Available Services to get Service ID
            var servicesRes = ghnApiClient.getAvailableServices(shop.getDistrictId(), toAddress.getDistrictId());
            Integer serviceTypeId = 2; // Default: Hàng nhẹ
            Integer serviceId = null;

            if (servicesRes != null && servicesRes.getData() != null && !servicesRes.getData().isEmpty()) {
                // Prefer service_type_id = 2 (Standard/E-commerce)
                var service = servicesRes.getData().stream()
                    .filter(s -> s.getServiceTypeId() == 2)
                    .findFirst()
                    .orElse(servicesRes.getData().get(0));
                serviceId = service.getServiceId();
                serviceTypeId = service.getServiceTypeId();
            }

            if (serviceId == null) {
                log.warn("No available shipping services for route {} -> {}", shop.getDistrictId(), toAddress.getDistrictId());
                return defaultFee;
            }

            // Calculate total value for insurance (Required by GHN)
            int insuranceValue = 0;
            if (items != null) {
                for (CheckoutPreviewRequest.CheckoutItemDto item : items) {
                     if (item.getUnitPrice() != null) {
                         insuranceValue += item.getUnitPrice() * item.getQuantity();
                     }
                }
            }


            // Calculate total weight (Default 500g per item if not available)
            // Note: In a perfect world, we'd fetch product weight from StockService.
            // For now, we use the same fallback as OrderController: 500g per item.
            int weight = 0;
            if (items != null) {
                weight = items.stream()
                        .mapToInt(item -> (item.getQuantity() != null ? item.getQuantity() : 1) * 500)
                        .sum();
            }
            if (weight == 0) weight = 500; // Minimum fallback

            // 3. Request GHN Fee
            GhnCalculateFeeRequest ghnReq = GhnCalculateFeeRequest.builder()
                    .fromDistrictId(shop.getDistrictId())
                    .fromWardCode(shop.getWardCode()) // Important!
                    .toDistrictId(toAddress.getDistrictId())
                    .toWardCode(toAddress.getWardCode())
                    .serviceId(serviceId)
                    .serviceTypeId(serviceTypeId)
                    .weight(weight)
                    .length(20) // cm
                    .width(15)
                    .height(10)
                    .insuranceValue(insuranceValue) 
                    .coupon(null)
                    .build();

            GhnCalculateFeeResponse res = ghnApiClient.calculateFee(ghnReq);
            
            if (res != null && res.getData() != null) {
                return BigDecimal.valueOf(res.getData().getTotal());
            }
            
        } catch (Exception e) {
            log.error("Failed to calculate shipping fee for shop {}: {}", shopId, e.getMessage());
        }

        return defaultFee;
    }

    private BigDecimal calculatePlatformDiscount(PlatformVoucher voucher, BigDecimal orderAmount) {
        // ... similar logic to Shop Voucher but for Platform ...
        BigDecimal discount;
        switch (voucher.getDiscountType()) {
            case PERCENT -> {
                discount = orderAmount.multiply(voucher.getDiscountValue())
                    .divide(BigDecimal.valueOf(100), 0, RoundingMode.FLOOR);
                if (voucher.getMaxDiscountAmount() != null && discount.compareTo(voucher.getMaxDiscountAmount()) > 0) {
                    discount = voucher.getMaxDiscountAmount();
                }
            }
            case FIXED -> discount = voucher.getDiscountValue();
            default -> discount = BigDecimal.ZERO;
        }
        if (discount.compareTo(orderAmount) > 0) return orderAmount;
        return discount;
    }
}
