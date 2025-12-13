package com.example.orderservice.request;

import com.example.orderservice.dto.SelectedItemDto;
import jakarta.validation.constraints.NotEmpty;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CheckOutKafkaRequest {
    private String userId;
    private String addressId;
    @NotEmpty(message = "Selected items cannot be empty")
    private List<SelectedItemDto> selectedItems;
    private String cartId;
    private String paymentMethod; // COD, VNPAY, CARD
}
