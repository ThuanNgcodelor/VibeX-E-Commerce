package com.example.authservice.dto;

import com.example.authservice.enums.Role;
import lombok.Data;

import java.util.Set;
import java.util.HashSet;

@Data
public class AuthUserDto {
    private String id;
    private String username;
    private String email;
    private String password;
    private boolean active;
    private Role role; // Role chính
    private Set<Role> roles = new HashSet<>(); // Tất cả roles

    // Helper methods
    public void addRole(Role role) {
        this.roles.add(role);
        if (this.role == null) {
            this.role = role;
        }
    }

    public boolean hasRole(Role role) {
        return this.roles.contains(role);
    }
}