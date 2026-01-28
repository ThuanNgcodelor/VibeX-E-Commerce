package com.example.userservice.controller;

import org.modelmapper.ModelMapper;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RequestPart;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import com.example.userservice.dto.AuthUserDto;
import com.example.userservice.dto.CartDto;
import com.example.userservice.dto.UpdatePassword;
import com.example.userservice.dto.UserAdminDto;
import com.example.userservice.dto.UserDto;
import com.example.userservice.dto.UserInformationDto;
import com.example.userservice.dto.UserLocationStatDto;
import com.example.userservice.jwt.JwtUtil;
import com.example.userservice.model.User;
import com.example.userservice.request.RegisterRequest;
import com.example.userservice.request.UserUpdateRequest;
import com.example.userservice.service.user.UserService;

import jakarta.servlet.http.HttpServletRequest;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;

@RestController
@RequestMapping("/v1/user")
@RequiredArgsConstructor
public class UserController {
    private final UserService userService;
    private final ModelMapper modelMapper;
    private final JwtUtil jwtUtil;
    private final PasswordEncoder passwordEncoder;

    @GetMapping("/cart")
    ResponseEntity<CartDto> getCart(HttpServletRequest request) {
        CartDto cartDto = userService.getCart(request);
        return ResponseEntity.ok(cartDto);
    }

    @GetMapping("/information")
    ResponseEntity<UserInformationDto> getInformation(HttpServletRequest request) {
        String userId = jwtUtil.ExtractUserId(request);
        return ResponseEntity.ok(userService.convertUserToUserInformationDto(userService.getUserById(userId)));
    }

    @PostMapping("/save")
    public ResponseEntity<UserDto> save(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok(modelMapper.map(userService.SaveUser(request), UserDto.class));
    }

    @GetMapping("/getAll")
    public ResponseEntity<org.springframework.data.domain.Page<UserAdminDto>> getAll(
            @RequestParam(required = false) String search,
            @RequestParam(required = false) String role,
            @RequestParam(required = false) String status,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "10") int size) {
        org.springframework.data.domain.Pageable pageable = org.springframework.data.domain.PageRequest.of(page, size);
        org.springframework.data.domain.Page<User> userPage = userService.getAllUsers(search, role, status, pageable);
        return ResponseEntity.ok(userPage.map(userService::toUserAdminDto));
    }

    @GetMapping("/getUserForAdminByUserId/{id}")
    public ResponseEntity<UserAdminDto> getUserForAdminByUserId(@PathVariable String id) {
        return ResponseEntity.ok(modelMapper.map(userService.getUserById(id), UserAdminDto.class));
    }

    @GetMapping("/getUserById/{id}")
    public ResponseEntity<UserDto> getUserById(@PathVariable String id) {
        return ResponseEntity.ok(modelMapper.map(userService.getUserById(id), UserDto.class));
    }

    @GetMapping("/getUserByEmail")
    public ResponseEntity<AuthUserDto> getUserByEmail(@RequestParam String email) {
        User user = userService.getUserByEmail(email);
        AuthUserDto dto = modelMapper.map(user, AuthUserDto.class);
        if (user.getPrimaryRole() != null) {
            dto.setRole(user.getPrimaryRole());
            dto.getRoles().add(user.getPrimaryRole());
        }
        return ResponseEntity.ok(dto);
    }

    @GetMapping("/getUserByUsername/{username}")
    public ResponseEntity<AuthUserDto> getUserByUsername(@PathVariable String username) {
        return ResponseEntity.ok(modelMapper.map(userService.getUserByUsername(username), AuthUserDto.class));
    }

    @PutMapping(value = "/update", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<UserAdminDto> updateUserById(
            @Valid @RequestPart("request") UserUpdateRequest request,
            @RequestPart(value = "file", required = false) MultipartFile file) {
        User updatedUser = userService.updateUserById(request, file);
        return ResponseEntity.ok(userService.toUserAdminDto(updatedUser));
    }

    @DeleteMapping("/deleteUserById/{id}")
    public ResponseEntity<Void> deleteUserById(@PathVariable String id) {
        userService.deleteUserById(id);
        return ResponseEntity.ok().build();
    }

    @PostMapping("/update-password")
    public ResponseEntity<Void> updatePassword(@RequestBody UpdatePassword request) {
        userService.updatePasswordByEmail(request.getEmail(), request.getPassword());
        return ResponseEntity.ok().build();
    }

    /**
     * Toggle active status của user (ACTIVE <-> INACTIVE)
     * Admin only - Lock/Unlock user account
     */
    @PutMapping("/toggleActive/{id}")
    public ResponseEntity<UserAdminDto> toggleActiveStatus(@PathVariable String id) {
        User user = userService.toggleActiveStatus(id);
        return ResponseEntity.ok(modelMapper.map(user, UserAdminDto.class));
    }

    @GetMapping("/stats/count")
    public ResponseEntity<Long> countActiveUsers() {
        return ResponseEntity.ok(userService.countActiveUsers());
    }

    /**
     * Get all active user IDs
     * Used by notification-service for admin broadcast notifications
     */
    @GetMapping("/all-ids")
    public ResponseEntity<java.util.List<String>> getAllActiveUserIds() {
        return ResponseEntity.ok(userService.getAllActiveUserIds());
    }

    @GetMapping("/stats/locations")
    public ResponseEntity<java.util.List<UserLocationStatDto>> getUserLocationStats() {
        return ResponseEntity.ok(userService.getUserLocationStats());
    }
}
