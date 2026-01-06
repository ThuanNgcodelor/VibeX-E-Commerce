package com.example.authservice.service;

import com.example.authservice.client.UserServiceClient;
import com.example.authservice.dto.*;
import com.example.authservice.exception.WrongCredentialsException;
import com.example.authservice.request.LoginRequest;
import com.example.authservice.request.RegisterRequest;
import com.example.authservice.enums.Role;
import feign.FeignException;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.data.redis.core.RedisTemplate;
import org.springframework.http.ResponseEntity;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.ZoneId;
import java.util.concurrent.TimeUnit;

@Slf4j
@Service
@RequiredArgsConstructor
public class AuthService {
    private final AuthenticationManager authenticationManager;
    private final UserServiceClient userServiceClient;
    private final JwtService jwtService;
    private final RedisTemplate<String, String> redisTemplate;
    private final EmailService emailService;
    private final GoogleOAuth2Service googleOAuth2Service;
    private final FacebookOAuth2Service facebookOAuth2Service;

    private static final String OTP_KEY_PREFIX = "otp:";
    private static final String OTP_COOLDOWN_PREFIX = "otp:cooldown:";
    private static final String OTP_DAILY_COUNT_PREFIX = "otp:count:";
    private static final String OTP_VERIFIED_PREFIX = "otp:verified:";

    private static final Duration OTP_TTL = Duration.ofMinutes(5);
    private static final Duration COOLDOWN = Duration.ofSeconds(60);
    private static final Duration VERIFIED_TTL = Duration.ofMinutes(15); // Tăng lên 15 phút để user có đủ thời gian
                                                                         // reset password
    private static final int OTP_LENGTH = 6;
    private static final int MAX_PER_DAY = 10;

    private static final SecureRandom RNG = new SecureRandom();

    public void forgotPassword(ForgotPassword request) {
        final String email = normalizeEmail(request.getEmail());

        // 1) Kiểm tra user có tồn tại không (nếu không => 404)
        userServiceClient.getUserByEmail(email); // Nếu 404, Feign sẽ ném lỗi lên

        // 2) Chặn spam: cooldown
        if (inCooldown(email)) {
            throw new RuntimeException("Please wait before requesting another OTP.");
        }

        // 3) Chặn vượt hạn mức trong ngày
        if (isOverDailyLimit(email)) {
            throw new RuntimeException("OTP request limit reached for today.");
        }

        // 4) Sinh OTP 6 số và lưu Redis với TTL
        String otp = randomOtp(OTP_LENGTH);
        String otpKey = OTP_KEY_PREFIX + email;
        redisTemplate.opsForValue().set(otpKey, otp, OTP_TTL);

        // 5) Đặt cooldown
        String cooldownKey = OTP_COOLDOWN_PREFIX + email;
        redisTemplate.opsForValue().set(cooldownKey, "1", COOLDOWN);

        // 6) Tăng bộ đếm/ngày, tự set expire đến cuối ngày
        bumpDailyCount(email);

        // 7) Gửi email
        boolean sent = emailService.sendOtpEmail(email, otp, (int) OTP_TTL.toMinutes());
        if (!sent) {
            // Nếu gửi lỗi, xoá OTP để khỏi chiếm TTL vô ích
            redisTemplate.delete(otpKey);
            redisTemplate.delete(cooldownKey);
            throw new RuntimeException("Failed to send OTP email");
        }
    }

    public boolean verifyOtp(String email, String otp) {
        final String normalizedEmail = normalizeEmail(email);
        final String trimmedOtp = otp != null ? otp.trim() : "";

        String key = OTP_KEY_PREFIX + normalizedEmail;
        String value = redisTemplate.opsForValue().get(key); // dùng String

        log.debug("Verifying OTP - Email: {}, Normalized: {}, Key: {}, Stored OTP: {}, Received OTP: {}",
                email, normalizedEmail, key, value, trimmedOtp);

        if (value == null) {
            log.warn("OTP not found in Redis for email: {}", normalizedEmail);
            return false;
        }

        // Trim stored OTP as well to handle any edge cases
        String storedOtp = value.trim();
        boolean isValid = storedOtp.equals(trimmedOtp);

        log.debug("OTP comparison - Stored: '{}', Received: '{}', Match: {}", storedOtp, trimmedOtp, isValid);

        if (isValid) {
            // Xoá OTP để không dùng lại
            redisTemplate.delete(key);

            // Đặt cờ đã xác minh, TTL ngắn
            String verifiedKey = OTP_VERIFIED_PREFIX + normalizedEmail;
            redisTemplate.opsForValue().set(verifiedKey, "1", VERIFIED_TTL);
            log.info("OTP verified successfully for email: {}", normalizedEmail);
        } else {
            log.warn("OTP mismatch for email: {} - Expected: '{}', Got: '{}'", normalizedEmail, storedOtp, trimmedOtp);
        }
        return isValid;
    }

    public boolean resetPassword(UpdatePasswordRequest request) {
        final String email = normalizeEmail(request.getEmail());
        final String otp = request.getOtp() != null ? request.getOtp().trim() : null;

        log.debug("resetPassword - Email: {}, Normalized: {}, Has OTP: {}",
                request.getEmail(), email, otp != null && !otp.isBlank());

        boolean allowed;
        if (otp != null && !otp.isBlank()) {
            // Nhánh cũ: có OTP thì verify như trước
            log.debug("resetPassword - Verifying OTP directly");
            allowed = verifyOtp(email, otp);
        } else {
            // Nhánh mới: không có OTP -> kiểm tra cờ verified
            String verifiedKey = OTP_VERIFIED_PREFIX + email;
            String flag = redisTemplate.opsForValue().get(verifiedKey);
            allowed = (flag != null);
            log.debug("resetPassword - Checking verified flag. Key: {}, Flag exists: {}", verifiedKey, allowed);
            // KHÔNG xoá cờ ở đây, chỉ xoá sau khi đổi pass thành công
        }

        if (!allowed) {
            log.warn("resetPassword - Not allowed. Email: {}, Has OTP: {}", email, otp != null && !otp.isBlank());
            return false;
        }

        log.info("resetPassword - Proceeding to update password for email: {}", email);

        // Gọi user-service đổi password
        ResponseEntity<?> response = userServiceClient.updatePassword(
                UpdatePassword.builder()
                        .email(email)
                        .password(request.getNewPassword())
                        .build());

        boolean ok = response != null && response.getStatusCode().is2xxSuccessful();
        if (ok) {
            String verifiedKey = OTP_VERIFIED_PREFIX + email;
            redisTemplate.delete(verifiedKey);
            log.info("resetPassword - Password updated successfully for email: {}", email);
        } else {
            log.error("resetPassword - Failed to update password. Response: {}", response);
        }
        return ok;
    }

    private String normalizeEmail(String email) {
        return email == null ? "" : email.trim().toLowerCase();
    }

    private String randomOtp(int length) {
        int bound = (int) Math.pow(10, length);
        int base = (int) Math.pow(10, length - 1);
        int number = RNG.nextInt(bound - base) + base; // đảm bảo độ dài đúng (không bị 0 đầu)
        return String.valueOf(number);
    }

    private boolean inCooldown(String email) {
        String key = OTP_COOLDOWN_PREFIX + email;
        return redisTemplate.opsForValue().get(key) != null;
    }

    private boolean isOverDailyLimit(String email) {
        String key = OTP_DAILY_COUNT_PREFIX + LocalDate.now() + ":" + email;
        String v = redisTemplate.opsForValue().get(key);
        long count = (v == null) ? 0L : Long.parseLong(v);
        return count >= MAX_PER_DAY;
    }

    private void bumpDailyCount(String email) {
        String key = OTP_DAILY_COUNT_PREFIX + LocalDate.now() + ":" + email;
        Long newVal = redisTemplate.opsForValue().increment(key);
        // đặt expire đến 23:59:59 hôm nay
        if (newVal != null && newVal == 1L) {
            LocalDateTime endOfDay = LocalDate.now().plusDays(1).atStartOfDay().minusSeconds(1);
            long seconds = endOfDay.atZone(ZoneId.systemDefault()).toEpochSecond()
                    - LocalDateTime.now().atZone(ZoneId.systemDefault()).toEpochSecond();
            redisTemplate.expire(key, seconds, TimeUnit.SECONDS);
        }
    }

    public RegisterDto register(RegisterRequest request) {
        ResponseEntity<RegisterDto> response = userServiceClient.save(request);
        if (response == null || response.getBody() == null) {
            throw new RuntimeException("Failed to register user: No response from user service");
        }
        return response.getBody();
    }

    public TokenDto login(LoginRequest loginRequest) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));
        if (authentication.isAuthenticated()) {
            return TokenDto.builder()
                    .token(jwtService.generateToken(loginRequest.getEmail()))
                    .refreshToken(jwtService.generateRefreshToken(loginRequest.getEmail()))
                    .build();
        } else {
            throw new WrongCredentialsException("Invalid email or password");
        }
    }

    public TokenDto loginWithGoogle(String code) {
        try {
            var googleUser = googleOAuth2Service.getUserInfoFromCode(code);
            final String email = googleUser.getEmail().trim().toLowerCase();

            AuthUserDto user = null;

            try {
                var resp = userServiceClient.getUserByEmail(email);
                if (resp != null && resp.getBody() != null) {
                    user = resp.getBody();
                    if (user.getRole() == null && user.getRoles() != null && !user.getRoles().isEmpty()) {
                        user.setRole(user.getRoles().iterator().next());
                    }
                }
            } catch (FeignException.NotFound e) {
                log.info("User with email {} not found, will create new user", email);
            }

            if (user == null) {
                try {
                    final var req = getRegisterRequest(email, googleUser);
                    var reg = userServiceClient.save(req);
                    var created = reg.getBody();
                    if (created == null) {
                        throw new RuntimeException("Failed to create user - no response body");
                    }

                    user = new AuthUserDto();
                    user.setEmail(created.getEmail());
                    user.setId(created.getId());
                    user.setUsername(created.getUsername());
                    user.setRole(Role.USER);
                    user.addRole(Role.USER);

                } catch (Exception createEx) {
                    String errorMsg = createEx.getMessage();
                    throw new RuntimeException("Failed to create user: " + errorMsg, createEx);
                }
            }

            return TokenDto.builder()
                    .token(jwtService.generateToken(user.getEmail()))
                    .refreshToken(jwtService.generateRefreshToken(user.getEmail()))
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("Google login failed: " + e.getMessage(), e);
        }
    }

    public TokenDto loginWithFacebook(String code) {
        try {
            var fbUser = facebookOAuth2Service.getUserInfoFromCode(code);
            final String email = fbUser.getEmail().trim().toLowerCase();

            AuthUserDto user = null;

            try {
                var resp = userServiceClient.getUserByEmail(email);
                if (resp != null && resp.getBody() != null) {
                    user = resp.getBody();
                    if (user.getRole() == null && user.getRoles() != null && !user.getRoles().isEmpty()) {
                        user.setRole(user.getRoles().iterator().next());
                    }
                }
            } catch (FeignException.NotFound e) {
                log.info("User with email {} not found, will create new user", email);
            }

            if (user == null) {
                try {
                    final var req = getRegisterRequestFromFacebook(email, fbUser);
                    var reg = userServiceClient.save(req);
                    var created = reg.getBody();
                    if (created == null) {
                        throw new RuntimeException("Failed to create user - no response body");
                    }

                    user = new AuthUserDto();
                    user.setEmail(created.getEmail());
                    user.setId(created.getId());
                    user.setUsername(created.getUsername());
                    user.setRole(Role.USER);
                    user.addRole(Role.USER);

                } catch (Exception createEx) {
                    String errorMsg = createEx.getMessage();
                    throw new RuntimeException("Failed to create user: " + errorMsg, createEx);
                }
            }

            return TokenDto.builder()
                    .token(jwtService.generateToken(user.getEmail()))
                    .refreshToken(jwtService.generateRefreshToken(user.getEmail()))
                    .build();

        } catch (Exception e) {
            throw new RuntimeException("Facebook login failed: " + e.getMessage(), e);
        }
    }

    public TokenDto loginWithRoleSelection(LoginRequest loginRequest, String selectedRole) {
        Authentication authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(loginRequest.getEmail(), loginRequest.getPassword()));

        if (authentication.isAuthenticated()) {
            AuthUserDto user = userServiceClient.getUserByEmail(loginRequest.getEmail()).getBody();

            if (user != null && user.hasRole(Role.valueOf(selectedRole.toUpperCase()))) {
                return TokenDto.builder()
                        .token(jwtService.generateToken(loginRequest.getEmail()))
                        .refreshToken(jwtService.generateRefreshToken(loginRequest.getEmail()))
                        .build();
            } else {
                throw new WrongCredentialsException("You don't have permission for this role");
            }
        } else {
            throw new WrongCredentialsException("Invalid email or password");
        }
    }

    private static RegisterRequest getRegisterRequest(String email, GoogleOAuth2Service.GoogleUserInfo googleUser) {
        RegisterRequest req = new RegisterRequest();
        req.setEmail(email);

        String username = googleUser.getName();
        if (username == null || username.length() < 6) {
            String prefix = email.split("@")[0];
            username = prefix + "_google";
        }

        req.setUsername(username);
        req.setPassword("Google1234");
        return req;
    }

    private static RegisterRequest getRegisterRequestFromFacebook(String email,
            FacebookOAuth2Service.FacebookUserInfo fbUser) {
        RegisterRequest req = new RegisterRequest();
        req.setEmail(email);

        String username = fbUser.getName();
        if (username == null || username.length() < 6) {
            String prefix = email.split("@")[0];
            username = prefix + "_facebook";
        }
        // Ensure username is clean
        username = username.replaceAll("[^a-zA-Z0-9._-]", "");

        req.setUsername(username);
        req.setPassword("Facebook1234");
        return req;
    }

    public boolean sendUserUpdateEmail(SendUserUpdateEmailRequest request) {
        log.info("Sending user update email to: {}", request.getEmail());
        return emailService.sendUserUpdateEmail(
                request.getEmail(),
                request.getUsername(),
                request.getFirstName(),
                request.getLastName());
    }

    public boolean sendUserLockStatusEmail(SendUserLockStatusEmailRequest request) {
        log.info("Sending user lock status email to: {}, locked: {}", request.getEmail(), request.isLocked());
        return emailService.sendUserLockStatusEmail(
                request.getEmail(),
                request.getUsername(),
                request.getFirstName(),
                request.getLastName(),
                request.isLocked());
    }

    public TokenDto refreshToken(com.example.authservice.request.RefreshTokenRequest request) {
        String requestRefreshToken = request.getRefreshToken();
        if (requestRefreshToken != null && jwtService.validateRefreshToken(requestRefreshToken)) {
            String username = jwtService.getClaims(requestRefreshToken).getSubject();
            if (username != null) {
                // Generate new tokens
                String newAccessToken = jwtService.generateToken(username);
                String newRefreshToken = jwtService.generateRefreshToken(username); // Rotate refresh token
                return TokenDto.builder()
                        .token(newAccessToken)
                        .refreshToken(newRefreshToken)
                        .build();
            }
        }
        throw new RuntimeException("Invalid refresh token");
    }
}
