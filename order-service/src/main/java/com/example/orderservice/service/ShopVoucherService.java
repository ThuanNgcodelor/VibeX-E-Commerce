package com.example.orderservice.service;

import com.example.orderservice.dto.CreateShopVoucherRequest;
import com.example.orderservice.model.ShopVoucher;

import java.util.List;

public interface ShopVoucherService {
    ShopVoucher createShopVoucher(CreateShopVoucherRequest request);

    List<ShopVoucher> getAllShopVouchers(String shopOwnerId);

    ShopVoucher updateShopVoucher(String voucherId, CreateShopVoucherRequest request);

    void deleteShopVoucher(String voucherId);
}
