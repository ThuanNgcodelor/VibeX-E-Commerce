package com.example.authservice.controller;

import com.example.authservice.dto.*;
import com.example.authservice.request.LoginRequest;
import com.example.authservice.request.RegisterRequest;
import com.example.authservice.request.GoogleLoginRequest;
import com.example.authservice.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.bind.annotation.RequestParam;
import com.example.authservice.request.RefreshTokenRequest;

import java.util.Map;

@RestController
@RequestMapping("/v1/auth")
@RequiredArgsConstructor
public class AuthController {
    private final AuthService authService;

    @PostMapping("/login")
    public ResponseEntity<TokenDto> login(@RequestBody LoginRequest request) {
        return ResponseEntity.ok(authService.login(request));
    }

    @PostMapping("/login/google")
    public ResponseEntity<TokenDto> loginWithGoogle(@Valid @RequestBody GoogleLoginRequest request) {
        return ResponseEntity.ok(authService.loginWithGoogle(request.getCode()));
    }

    @PostMapping("/register")
    public ResponseEntity<RegisterDto> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(authService.register(request));
    }

    @PostMapping("/forgotPassword")
    public ResponseEntity<?> forgotPassword(@Valid @RequestBody ForgotPassword request) {
        authService.forgotPassword(request);
        return ResponseEntity.ok(Map.of("ok", true, "message", "OTP sent to your email"));
    }

    @PostMapping("/verifyOtp")
    public ResponseEntity<?> verifyOtp(@Valid @RequestBody VerifyOtp request) {
        boolean ok = authService.verifyOtp(request.getEmail(), request.getOtp());
        if (ok) {
            return ResponseEntity.ok(Map.of("ok", true, "message", "OTP verified successfully"));
        }
        return ResponseEntity.badRequest().body(Map.of("ok", false, "message", "Invalid OTP"));
    }

    @PostMapping("/updatePassword")
    public ResponseEntity<?> updatePassword(@Valid @RequestBody UpdatePasswordRequest request) {
        boolean ok = authService.resetPassword(request);
        if (ok) {
            return ResponseEntity.ok(Map.of("ok", true, "message", "Password updated successfully"));
        }
        return ResponseEntity.badRequest().body(
                Map.of("ok", false, "message", "OTP not verified or verification expired"));
    }

    @PostMapping("/login/role")
    public ResponseEntity<TokenDto> loginWithRole(
            @RequestBody LoginRequest request,
            @RequestParam String role) {
        return ResponseEntity.ok(authService.loginWithRoleSelection(request, role));
    }

    @PostMapping("/sendUserUpdateEmail")
    public ResponseEntity<?> sendUserUpdateEmail(@Valid @RequestBody SendUserUpdateEmailRequest request) {
        boolean sent = authService.sendUserUpdateEmail(request);
        if (sent) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Email sent successfully"));
        }
        return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to send email"));
    }

    @PostMapping("/sendUserLockStatusEmail")
    public ResponseEntity<?> sendUserLockStatusEmail(@Valid @RequestBody SendUserLockStatusEmailRequest request) {
        boolean sent = authService.sendUserLockStatusEmail(request);
        if (sent) {
            return ResponseEntity.ok(Map.of("success", true, "message", "Email sent successfully"));
        }
        return ResponseEntity.status(500).body(Map.of("success", false, "message", "Failed to send email"));
    }

    @PostMapping("/refresh")
    public ResponseEntity<TokenDto> refreshToken(@RequestBody RefreshTokenRequest request) {
        return ResponseEntity.ok(authService.refreshToken(request));
    }

}
