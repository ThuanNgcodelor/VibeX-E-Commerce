package com.example.userservice.request;

import lombok.Data;

@Data
public class TaxInfoRequest {
    private String businessType; // CA_NHAN, HO_KINH_DOANH, CONG_TY
    private String businessAddress;
    private String email;
    private String taxCode; // Mã số thuế
}
