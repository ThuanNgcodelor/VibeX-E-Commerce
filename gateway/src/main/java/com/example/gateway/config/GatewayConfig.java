package com.example.gateway.config;

import org.springframework.cloud.gateway.route.RouteLocator;
import org.springframework.cloud.gateway.route.builder.RouteLocatorBuilder;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;

import com.example.gateway.filter.JwtAuthenticationFilter;

@Configuration
public class GatewayConfig {
        private final JwtAuthenticationFilter filter;

        public GatewayConfig(JwtAuthenticationFilter filter) {
                this.filter = filter;
        }

        @Bean
        public RouteLocator routes(RouteLocatorBuilder builder) {
                return builder.routes()
                                .route("auth-service", r -> r.path("/v1/auth/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://auth-service"))
                                .route("auth-user-service", r -> r.path("/v1/auth/user/**")
                                                .filters(f -> f.rewritePath("/v1/auth/user/(?<segment>.*)",
                                                "/v1/user/${segment}"))
                                                .uri("lb://user-service"))
                                .route("user-service", r -> r.path("/v1/user/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://user-service"))
                                .route("stock-domains", r -> r.path("/v1/stock/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://stock-service"))
                                .route("file-storage", r -> r.path("/v1/file-storage/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://file-storage"))
                                .route("notification-service", r -> r.path("/v1/notifications/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://notification-service"))
                                .route("order-service", r -> r.path("/v1/order/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://order-service"))
                                .route("order-service", r -> r.path("/v1/payment/**")
                                                .filters(f -> f.filter(filter))
                                                .uri("lb://payment-service"))
                                .route("notification-websocket", r -> r.path("/ws/notifications/**")
                                                .uri("lb://notification-service"))
                                .route("live-websocket", r -> r.path("/ws/live/**")
                                                .uri("lb://notification-service"))
                                .build();
        }
}
