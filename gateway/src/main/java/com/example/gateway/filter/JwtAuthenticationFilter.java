package com.example.gateway.filter;

import com.example.gateway.util.JwtUtil;
import org.springframework.cloud.gateway.filter.GatewayFilter;
import org.springframework.cloud.gateway.filter.GatewayFilterChain;
import org.springframework.http.HttpStatus;
import org.springframework.http.server.reactive.ServerHttpRequest;
import org.springframework.http.server.reactive.ServerHttpResponse;
import org.springframework.stereotype.Component;
import org.springframework.web.server.ServerWebExchange;
import reactor.core.publisher.Mono;

import java.util.List;
import java.util.function.Predicate;

@Component
public class JwtAuthenticationFilter implements GatewayFilter {
    private final JwtUtil jwtUtil;

    public JwtAuthenticationFilter(JwtUtil jwtUtil) {
        this.jwtUtil = jwtUtil;
    }

    @Override
    public Mono<Void> filter(ServerWebExchange exchange, GatewayFilterChain chain) {
        ServerHttpRequest request = exchange.getRequest();

        if ("OPTIONS".equals(request.getMethod().toString())) {
            return chain.filter(exchange);
        }

        final List<String> apiEndpoints = List.of(
                "/v1/auth/login",
                "/v1/auth/register",
                "/v1/auth/forgotPassword",
                "/v1/auth/verifyOtp",
                "/v1/auth/updatePassword",
                "/v1/auth/login/google",
                "/v1/auth/refresh",
                "/v1/oauth2/callback",
                "/v1/auth/user/getUserByEmail/",
                "/v1/user/getUserByEmail/",
                "/v1/eureka",
                "/v1/stock/product/list",
                "/v1/stock/product/getProductById/",
                "/v1/stock/category/getAll",
                "/v1/file-storage/get/",
                "/v1/user/vets/getAllVet",
                "/v1/user/vets/search",
                "/v1/user/shop-owners/",
                "/v1/stock/reviews/product/",
                "/v1/file-storage/download/",
                "/v1/user/ads/active",
                // Search endpoints - Public for guest users
                "/v1/stock/search/query",
                "/v1/stock/search/autocomplete",
                "/v1/user/ads/active",
                "/v1/stock/analytics/view/",
                "/v1/stock/analytics/visit",
                "/v1/stock/analytics/cart-add");

        Predicate<ServerHttpRequest> isApiSecured = r -> apiEndpoints.stream()
                .noneMatch(uri -> r.getURI().getPath().startsWith(uri));

        if (isApiSecured.test(request)) {
            if (authMissing(request))
                return onError(exchange);

            String token = request.getHeaders().getOrEmpty("Authorization").get(0);

            if (token != null && token.startsWith("Bearer ")) {
                token = token.substring(7);
            }

            try {
                jwtUtil.validateToken(token);
            } catch (Exception e) {
                return onError(exchange);
            }
        }

        return chain.filter(exchange);
    }

    private Mono<Void> onError(ServerWebExchange exchange) {
        ServerHttpResponse response = exchange.getResponse();
        response.setStatusCode(HttpStatus.UNAUTHORIZED);
        return response.setComplete();
    }

    private boolean authMissing(ServerHttpRequest request) {
        return !request.getHeaders().containsKey("Authorization");
    }
}
