package com.example.notificationservice.jwt;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.messaging.Message;
import org.springframework.messaging.MessageChannel;
import org.springframework.messaging.simp.stomp.StompCommand;
import org.springframework.messaging.simp.stomp.StompHeaderAccessor;
import org.springframework.messaging.support.ChannelInterceptor;
import org.springframework.messaging.support.MessageHeaderAccessor;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.stereotype.Component;

import java.util.Collections;
import java.util.List;

@Component
@Slf4j
@RequiredArgsConstructor
public class WebSocketJwtInterceptor implements ChannelInterceptor {

    private final JwtUtil jwtUtil;

    @Override
    public Message<?> preSend(Message<?> message, MessageChannel channel) {
        StompHeaderAccessor accessor = MessageHeaderAccessor.getAccessor(message, StompHeaderAccessor.class);

        if (accessor != null && StompCommand.CONNECT.equals(accessor.getCommand())) {
            // Check if this is a live stream connection (allow anonymous)
            String destination = accessor.getFirstNativeHeader("destination");
            String simpDestination = (String) accessor.getHeader("simpDestination");
            
            List<String> authHeaders = accessor.getNativeHeader("Authorization");
            String token = null;

            if (authHeaders != null && !authHeaders.isEmpty()) {
                String authHeader = authHeaders.get(0);
                if (authHeader != null && authHeader.startsWith("Bearer ")) {
                    token = authHeader.substring(7);
                }
            }

            if (token != null) {
                try {
                    // Validate token and extract userId
                    io.jsonwebtoken.Claims claims = jwtUtil.getClaims(token);
                    String userId = claims.get("userId", String.class);
                    String role = claims.get("role", String.class);

                    if (userId == null) {
                        throw new RuntimeException("Invalid token: no userId");
                    }

                    // Set authentication for WebSocket session
                    UsernamePasswordAuthenticationToken auth =
                            new UsernamePasswordAuthenticationToken(
                                    userId,
                                    null,
                                    role != null
                                            ? Collections.singletonList(new SimpleGrantedAuthority(role))
                                            : Collections.emptyList()
                            );
                    accessor.setUser(auth);
                    log.debug("WebSocket authenticated for user: {}", userId);

                } catch (Exception e) {
                    log.warn("WebSocket authentication failed: {}", e.getMessage());
                    // For live streams, allow anonymous access even if token is invalid
                    setAnonymousUser(accessor);
                }
            } else {
                // No token provided - allow anonymous access for public features like live streams
                // Anonymous users can watch live streams but may have limited features
                log.debug("WebSocket connection without token - allowing anonymous access");
                setAnonymousUser(accessor);
            }
        }

        return message;
    }
    
    private void setAnonymousUser(StompHeaderAccessor accessor) {
        // Set anonymous user for public WebSocket connections
        UsernamePasswordAuthenticationToken anonymousAuth =
                new UsernamePasswordAuthenticationToken(
                        "anonymous",
                        null,
                        Collections.singletonList(new SimpleGrantedAuthority("ROLE_ANONYMOUS"))
                );
        accessor.setUser(anonymousAuth);
    }
}