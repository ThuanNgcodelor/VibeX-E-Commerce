package com.example.userservice.dto;

import lombok.*;

@Data
@AllArgsConstructor
@NoArgsConstructor
@Builder
public class TaxInfoDto {
    private String taxCode;
    private String businessType;
    private String businessAddress;
    private String email;
}
