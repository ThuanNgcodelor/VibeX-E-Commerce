package com.example.paymentservice.service;

import com.example.paymentservice.config.MomoProperties;
import com.example.paymentservice.dto.PaymentEvent;
import com.example.paymentservice.dto.PaymentUrlResponse;
import com.example.paymentservice.enums.PaymentMethod;
import com.example.paymentservice.enums.PaymentStatus;
import com.example.paymentservice.model.Payment;
import com.example.paymentservice.repository.PaymentRepository;
import com.example.paymentservice.util.MomoUtil;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.*;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;
import org.springframework.web.client.RestTemplate;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.HashMap;
import java.util.Map;
import java.util.UUID;

@Service
@RequiredArgsConstructor
@Slf4j
public class MomoPaymentService {

    private final MomoProperties props;
    private final PaymentRepository paymentRepository;
    private final KafkaTemplate<String, PaymentEvent> kafkaTemplate;
    private final ObjectMapper objectMapper;
    private final RestTemplate restTemplate = new RestTemplate();

    @Value("${kafka.topic.payment}")
    private String paymentTopic;

    /**
     * Create MoMo payment request.
     * Returns payUrl, qrCodeUrl, deeplink for client to proceed with payment.
     */
    public PaymentUrlResponse createPayment(Map<String, Object> request) {
        long amount = Long.parseLong(request.get("amount").toString());
        String orderId = request.get("orderId") != null ? request.get("orderId").toString() : null;
        String orderInfo = request.get("orderInfo") != null ? request.get("orderInfo").toString() : "Thanh toan don hang";
        String extraData = request.get("extraData") != null ? request.get("extraData").toString() : "";
        
        // Generate unique requestId and orderId for MoMo
        String requestId = UUID.randomUUID().toString();
        String momoOrderId = "ORDER_" + System.currentTimeMillis();
        
        // Build signature
        String rawSignature = MomoUtil.buildSignatureRawData(
                props.getAccessKey(),
                amount,
                extraData,
                props.getIpnUrl(),
                momoOrderId,
                orderInfo,
                props.getPartnerCode(),
                props.getReturnUrl(),
                requestId,
                "captureWallet" // requestType for one-time payment
        );
        String signature = MomoUtil.hmacSHA256(props.getSecretKey(), rawSignature);

        // Build request body
        Map<String, Object> requestBody = new HashMap<>();
        requestBody.put("partnerCode", props.getPartnerCode());
        requestBody.put("requestType", "captureWallet");
        requestBody.put("ipnUrl", props.getIpnUrl());
        requestBody.put("redirectUrl", props.getReturnUrl());
        requestBody.put("orderId", momoOrderId);
        requestBody.put("amount", amount);
        requestBody.put("orderInfo", orderInfo);
        requestBody.put("requestId", requestId);
        requestBody.put("extraData", extraData);
        requestBody.put("signature", signature);
        requestBody.put("lang", "vi");

        try {
            // Call MoMo API
            HttpHeaders headers = new HttpHeaders();
            headers.setContentType(MediaType.APPLICATION_JSON);
            HttpEntity<Map<String, Object>> entity = new HttpEntity<>(requestBody, headers);

            ResponseEntity<String> response = restTemplate.postForEntity(
                    props.getApiUrl(),
                    entity,
                    String.class
            );

            JsonNode responseJson = objectMapper.readTree(response.getBody());
            int resultCode = responseJson.get("resultCode").asInt();

            if (resultCode == 0) {
                // Success - extract payment URLs
                String payUrl = responseJson.has("payUrl") ? responseJson.get("payUrl").asText() : null;
                String qrCodeUrl = responseJson.has("qrCodeUrl") ? responseJson.get("qrCodeUrl").asText() : null;
                String deeplink = responseJson.has("deeplink") ? responseJson.get("deeplink").asText() : null;

                // Build orderData JSON if provided
                String orderDataJson = null;
                if (request.get("orderDataJson") != null) {
                    orderDataJson = request.get("orderDataJson").toString();
                }

                // Save payment record
                Payment payment = Payment.builder()
                        .orderId(orderId)
                        .txnRef(momoOrderId)
                        .amount(BigDecimal.valueOf(amount))
                        .currency("VND")
                        .method(PaymentMethod.MOMO)
                        .status(PaymentStatus.PENDING)
                        .paymentUrl(payUrl)
                        .returnUrl(props.getReturnUrl())
                        .orderData(orderDataJson)
                        .build();
                paymentRepository.save(payment);

                log.info("[MOMO] Payment created: orderId={}, momoOrderId={}, amount={}", 
                        orderId, momoOrderId, amount);

                return new PaymentUrlResponse("0", "success", payUrl, momoOrderId);
            } else {
                String message = responseJson.has("message") ? responseJson.get("message").asText() : "Unknown error";
                log.error("[MOMO] Failed to create payment: resultCode={}, message={}", resultCode, message);
                return new PaymentUrlResponse(String.valueOf(resultCode), message, null, null);
            }

        } catch (Exception e) {
            log.error("[MOMO] Error creating payment: {}", e.getMessage(), e);
            return new PaymentUrlResponse("99", "System error: " + e.getMessage(), null, null);
        }
    }

    /**
     * Handle IPN callback from MoMo.
     * Verifies signature and updates payment status.
     */
    public PaymentStatus handleIpnCallback(Map<String, Object> callbackData) {
        try {
            String partnerCode = callbackData.get("partnerCode").toString();
            String orderId = callbackData.get("orderId").toString();
            String requestId = callbackData.get("requestId").toString();
            long amount = Long.parseLong(callbackData.get("amount").toString());
            String orderInfo = callbackData.get("orderInfo") != null ? callbackData.get("orderInfo").toString() : "";
            String orderType = callbackData.get("orderType") != null ? callbackData.get("orderType").toString() : "";
            long transId = Long.parseLong(callbackData.get("transId").toString());
            int resultCode = Integer.parseInt(callbackData.get("resultCode").toString());
            String message = callbackData.get("message") != null ? callbackData.get("message").toString() : "";
            String payType = callbackData.get("payType") != null ? callbackData.get("payType").toString() : "";
            long responseTime = Long.parseLong(callbackData.get("responseTime").toString());
            String extraData = callbackData.get("extraData") != null ? callbackData.get("extraData").toString() : "";
            String signatureFromMomo = callbackData.get("signature").toString();

            // Verify signature
            String rawSignature = MomoUtil.buildIpnSignatureRawData(
                    props.getAccessKey(),
                    amount,
                    extraData,
                    message,
                    orderId,
                    orderInfo,
                    orderType,
                    partnerCode,
                    payType,
                    requestId,
                    responseTime,
                    resultCode,
                    transId
            );
            String calculatedSignature = MomoUtil.hmacSHA256(props.getSecretKey(), rawSignature);

            if (!calculatedSignature.equalsIgnoreCase(signatureFromMomo)) {
                log.error("[MOMO] IPN signature verification failed for orderId: {}", orderId);
                return PaymentStatus.FAILED;
            }

            // Find payment by txnRef (momoOrderId)
            Payment payment = paymentRepository.findByTxnRef(orderId).orElse(null);
            if (payment == null) {
                log.error("[MOMO] Payment not found for orderId: {}", orderId);
                return PaymentStatus.FAILED;
            }

            // Update payment status
            boolean success = resultCode == 0;
            payment.setStatus(success ? PaymentStatus.PAID : PaymentStatus.FAILED);
            payment.setResponseCode(String.valueOf(resultCode));
            payment.setGatewayTxnNo(String.valueOf(transId));
            payment.setRawCallback(objectMapper.writeValueAsString(callbackData));
            paymentRepository.save(payment);

            log.info("[MOMO] IPN processed: orderId={}, resultCode={}, status={}", 
                    orderId, resultCode, payment.getStatus());

            // Publish payment event to Kafka
            try {
                PaymentEvent event = PaymentEvent.builder()
                        .paymentId(payment.getId())
                        .txnRef(payment.getTxnRef())
                        .orderId(payment.getOrderId())
                        .status(payment.getStatus().name())
                        .amount(payment.getAmount())
                        .currency(payment.getCurrency())
                        .method(PaymentMethod.MOMO.name())
                        .gatewayTxnNo(payment.getGatewayTxnNo())
                        .responseCode(payment.getResponseCode())
                        .userId(extractFromOrderData(payment.getOrderData(), "userId"))
                        .addressId(extractFromOrderData(payment.getOrderData(), "addressId"))
                        .orderDataJson(payment.getOrderData())
                        .platformVoucherCode(extractFromOrderData(payment.getOrderData(), "platformVoucherCode"))
                        .platformVoucherDiscount(extractDiscountFromOrderData(payment.getOrderData()))
                        .timestamp(Instant.now())
                        .build();

                kafkaTemplate.send(paymentTopic, payment.getTxnRef(), event);
                log.info("[MOMO] Published payment event to Kafka: txnRef={}, status={}",
                        payment.getTxnRef(), payment.getStatus());
            } catch (Exception e) {
                log.error("[MOMO] Failed to publish payment event to Kafka: {}", e.getMessage(), e);
            }

            return payment.getStatus();

        } catch (Exception e) {
            log.error("[MOMO] Error processing IPN callback: {}", e.getMessage(), e);
            return PaymentStatus.FAILED;
        }
    }

    /**
     * Handle return URL redirect from MoMo.
     * Similar to IPN but for user redirect.
     */
    public PaymentStatus handleReturn(Map<String, String[]> parameterMap) {
        try {
            Map<String, Object> params = new HashMap<>();
            for (Map.Entry<String, String[]> entry : parameterMap.entrySet()) {
                if (entry.getValue() != null && entry.getValue().length > 0) {
                    params.put(entry.getKey(), entry.getValue()[0]);
                }
            }
            return handleIpnCallback(params);
        } catch (Exception e) {
            log.error("[MOMO] Error handling return: {}", e.getMessage(), e);
            return PaymentStatus.FAILED;
        }
    }

    private String extractFromOrderData(String orderDataJson, String field) {
        if (orderDataJson == null || orderDataJson.trim().isEmpty()) {
            return null;
        }
        try {
            JsonNode json = objectMapper.readTree(orderDataJson);
            JsonNode node = json.get(field);
            return node != null ? node.asText(null) : null;
        } catch (Exception e) {
            log.warn("[MOMO] Failed to extract {} from orderData: {}", field, e.getMessage());
            return null;
        }
    }

    private Double extractDiscountFromOrderData(String orderDataJson) {
        if (orderDataJson == null || orderDataJson.trim().isEmpty()) {
            return 0.0;
        }
        try {
            JsonNode json = objectMapper.readTree(orderDataJson);
            JsonNode node = json.get("platformVoucherDiscount");
            return node != null ? node.asDouble(0.0) : 0.0;
        } catch (Exception e) {
            return 0.0;
        }
    }
}
