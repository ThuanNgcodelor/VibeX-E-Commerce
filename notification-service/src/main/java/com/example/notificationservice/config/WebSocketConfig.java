package com.example.notificationservice.config;

import com.example.notificationservice.jwt.WebSocketJwtInterceptor;
import lombok.RequiredArgsConstructor;
import org.springframework.context.annotation.Configuration;
import org.springframework.messaging.simp.config.MessageBrokerRegistry;
import org.springframework.web.socket.config.annotation.EnableWebSocketMessageBroker;
import org.springframework.web.socket.config.annotation.StompEndpointRegistry;
import org.springframework.web.socket.config.annotation.WebSocketMessageBrokerConfigurer;

@Configuration
@EnableWebSocketMessageBroker
@RequiredArgsConstructor
public class WebSocketConfig implements WebSocketMessageBrokerConfigurer {

    private final WebSocketJwtInterceptor webSocketJwtInterceptor;

    @Override
    public void configureMessageBroker(MessageBrokerRegistry config) {
        // Enable simple in-memory message broker for /topic and /queue prefixes
        config.enableSimpleBroker("/topic", "/queue");

        // Set prefix for messages FROM client TO server (app prefix)
        config.setApplicationDestinationPrefixes("/app");
    }

    @Override
    public void registerStompEndpoints(StompEndpointRegistry registry) {
        // Register STOMP endpoint for WebSocket connection
        // CORS: Set specific origins to match Gateway config (avoid duplicate headers)
        registry.addEndpoint("/ws/notifications")
                .setAllowedOriginPatterns(
                    "http://localhost:5173",
                    "http://shopee-fake.id.vn",
                    "http://www.shopee-fake.id.vn"
                )
                .withSockJS(); // Fallback for browsers that don't support WebSocket

        // Also support raw WebSocket without SockJS
        registry.addEndpoint("/ws/notifications")
                .setAllowedOriginPatterns(
                    "http://localhost:5173",
                    "http://shopee-fake.id.vn",
                    "http://www.shopee-fake.id.vn"
                );
        
        // NEW: Livestream WebSocket endpoint with SockJS
        registry.addEndpoint("/ws/live")
                .setAllowedOriginPatterns(
                    "http://localhost:5173",
                    "http://shopee-fake.id.vn",
                    "http://www.shopee-fake.id.vn",
                    "*" // Allow all for development
                )
                .withSockJS();
        
        // NEW: Livestream WebSocket endpoint without SockJS
        registry.addEndpoint("/ws/live")
                .setAllowedOriginPatterns(
                    "http://localhost:5173",
                    "http://shopee-fake.id.vn",
                    "http://www.shopee-fake.id.vn",
                    "*"
                );
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        // Add JWT interceptor for WebSocket authentication
        registration.interceptors(webSocketJwtInterceptor);
    }
}