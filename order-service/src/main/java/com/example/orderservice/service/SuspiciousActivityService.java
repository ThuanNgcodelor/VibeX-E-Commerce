package com.example.orderservice.service;

import com.example.orderservice.dto.SuspiciousProductDto;
import java.util.List;

public interface SuspiciousActivityService {
    List<SuspiciousProductDto> getSuspiciousProducts();

    void warnShop(String shopId);
}
