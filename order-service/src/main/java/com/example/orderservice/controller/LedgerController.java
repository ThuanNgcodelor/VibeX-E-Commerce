package com.example.orderservice.controller;

import com.example.orderservice.dto.PayoutRequestDTO;
import com.example.orderservice.dto.ShopLedgerDTO;
import com.example.orderservice.dto.ShopLedgerEntryDTO;
import com.example.orderservice.model.PayoutBatch;
import com.example.orderservice.service.ShopLedgerService;
import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.data.domain.PageRequest;
import org.springframework.data.domain.Pageable;
import org.springframework.data.domain.Sort;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;

@RestController
@RequestMapping("/v1/order/ledger")
@RequiredArgsConstructor
public class LedgerController {

    private final ShopLedgerService shopLedgerService;

    @GetMapping("/balance/{shopOwnerId}")
    public ResponseEntity<ShopLedgerDTO> getBalance(@PathVariable String shopOwnerId) {
        return ResponseEntity.ok(shopLedgerService.getLedgerByShopOwnerId(shopOwnerId));
    }

    @GetMapping("/entries/{shopOwnerId}")
    public ResponseEntity<Page<ShopLedgerEntryDTO>> getEntries(
            @PathVariable String shopOwnerId,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        Pageable pageable = PageRequest.of(page, size, Sort.by("createdAt").descending());
        return ResponseEntity.ok(shopLedgerService.getLedgerEntries(shopOwnerId, pageable));
    }

    @PostMapping("/payout/request/{shopOwnerId}")
    public ResponseEntity<PayoutBatch> requestPayout(
            @PathVariable String shopOwnerId,
            @RequestBody PayoutRequestDTO request) {
        return ResponseEntity.ok(shopLedgerService.requestPayout(shopOwnerId, request));
    }

    @PostMapping("/internal/deduct-fee")
    public ResponseEntity<Void> deductSubscriptionFee(
            @RequestBody com.example.orderservice.dto.DeductSubscriptionRequestDTO request) {
        shopLedgerService.deductSubscriptionFee(request);
        return ResponseEntity.ok().build();
    }

    @GetMapping("/payout/history/{shopOwnerId}")
    public ResponseEntity<List<PayoutBatch>> getPayoutHistory(@PathVariable String shopOwnerId) {
        return ResponseEntity.ok(shopLedgerService.getPayoutHistory(shopOwnerId));
    }

    private final com.example.orderservice.service.InvoiceService invoiceService;
    private final com.example.orderservice.repository.PayoutBatchRepository payoutBatchRepository;

    @GetMapping("/payout/invoice/{payoutId}")
    public ResponseEntity<byte[]> getInvoice(@PathVariable String payoutId) {
        try {
            PayoutBatch payout = payoutBatchRepository.findById(payoutId)
                    .orElseThrow(() -> new RuntimeException("Payout not found"));

            byte[] bytes = invoiceService.generatePayoutInvoice(payout);

            return ResponseEntity.ok()
                    .header("Content-Disposition",
                            "attachment; filename=invoice_" + payout.getTransactionRef() + ".xlsx")
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .body(bytes);
        } catch (Exception e) {
            return ResponseEntity.internalServerError().build();
        }
    }

    @GetMapping("/payout/history/export/{shopOwnerId}")
    public ResponseEntity<byte[]> exportPayoutHistory(@PathVariable String shopOwnerId) {
        try {
            List<PayoutBatch> history = shopLedgerService.getPayoutHistory(shopOwnerId);
            byte[] bytes = invoiceService.generatePayoutHistoryReport(history);

            String filename = "payout_history_" + java.time.LocalDate.now() + ".xlsx";

            return ResponseEntity.ok()
                    .header("Content-Disposition", "attachment; filename=" + filename)
                    .header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
                    .body(bytes);
        } catch (Exception e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().build();
        }
    }
}