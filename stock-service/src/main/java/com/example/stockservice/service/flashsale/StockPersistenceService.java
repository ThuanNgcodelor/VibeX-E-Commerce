package com.example.stockservice.service.flashsale;

import com.example.stockservice.model.FlashSaleProduct;
import com.example.stockservice.model.FlashSaleProductSize;
import com.example.stockservice.repository.FlashSaleProductRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Async;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Slf4j
@Service
@RequiredArgsConstructor
public class StockPersistenceService {

    private final FlashSaleProductRepository flashSaleProductRepository;

    @Async
    @Transactional
    public void asyncDecrementFlashSaleStock(String productId, String sizeId, int quantity) {
        try {
            java.util.List<FlashSaleProduct> products = flashSaleProductRepository.findByProductIdAndStatus(productId,
                    com.example.stockservice.enums.FlashSaleStatus.APPROVED);

            for (FlashSaleProduct fsp : products) {
                if (fsp.getProductSizes() != null) {
                    FlashSaleProductSize size = fsp.getProductSizes().stream()
                            .filter(s -> s.getSizeId().equals(sizeId))
                            .findFirst().orElse(null);

                    if (size != null) {
                        size.setFlashSaleStock(Math.max(0, size.getFlashSaleStock() - quantity));
                        size.setSoldCount(size.getSoldCount() + quantity);
                        fsp.setSoldCount(fsp.getSoldCount() + quantity);
                        flashSaleProductRepository.save(fsp);
                        log.debug("[ASYNC-DB] Synced productId={}, sizeId={}, qty={}", productId, sizeId, quantity);
                        return;
                    }
                }
            }
        } catch (Exception e) {
            log.error("[ASYNC-DB] Failed to sync stock: {}", e.getMessage());
        }
    }
}
