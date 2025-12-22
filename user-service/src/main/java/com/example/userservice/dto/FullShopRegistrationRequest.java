package com.example.userservice.dto;

import com.example.userservice.request.IdentificationRequest;
import com.example.userservice.request.RoleRequestRequest;
import com.example.userservice.request.ShopOwnerRegisterRequest;
import com.example.userservice.request.TaxInfoRequest;
import lombok.Data;
import jakarta.validation.Valid;

@Data
public class FullShopRegistrationRequest {
    @Valid
    private RoleRequestRequest roleRequest;

    @Valid
    private ShopOwnerRegisterRequest shopDetails;

    @Valid
    private TaxInfoRequest taxInfo;

    @Valid
    private IdentificationRequest identification;
}