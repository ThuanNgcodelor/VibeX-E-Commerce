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
        // CORS: Allow all origins to support Docker and various deployments
        String[] allowedOrigins = {
            "http://localhost",
            "http://localhost:5173",
            "http://localhost:80",
            "https://localhost",
            "http://shopee-fake.id.vn",
            "https://shopee-fake.id.vn",
            "http://www.shopee-fake.id.vn",
            "https://www.shopee-fake.id.vn",
            "*" // Allow all for development/Docker
        };
        
        registry.addEndpoint("/ws/notifications")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS(); // Fallback for browsers that don't support WebSocket

        // Also support raw WebSocket without SockJS
        registry.addEndpoint("/ws/notifications")
                .setAllowedOriginPatterns(allowedOrigins);
        
        // NEW: Livestream WebSocket endpoint with SockJS
        registry.addEndpoint("/ws/live")
                .setAllowedOriginPatterns(allowedOrigins)
                .withSockJS();
        
        // NEW: Livestream WebSocket endpoint without SockJS
        registry.addEndpoint("/ws/live")
                .setAllowedOriginPatterns(allowedOrigins);
    }

    @Override
    public void configureClientInboundChannel(org.springframework.messaging.simp.config.ChannelRegistration registration) {
        // Add JWT interceptor for WebSocket authentication
        registration.interceptors(webSocketJwtInterceptor);
    }
}