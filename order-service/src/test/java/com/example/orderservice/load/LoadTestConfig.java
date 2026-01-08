package com.example.orderservice.load;

import lombok.Getter;
import java.io.InputStream;
import java.util.Properties;

/**
 * Configuration for load testing
 */
@Getter
public class LoadTestConfig {
    private final String gatewayUrl;
    private final int totalUsers;
    private final int ordersPerUser;
    private final int rampUpSeconds;
    private final String userPrefix;
    private final boolean cleanupAfterTest;
    private final int codPercent;
    private final int vnpayPercent;
    private final int momoPercent;
    
    public LoadTestConfig() {
        Properties props = new Properties();
        try (InputStream input = getClass().getClassLoader()
                .getResourceAsStream("load-test.properties")) {
            if (input != null) {
                props.load(input);
            }
        } catch (Exception e) {
            System.err.println("Could not load config, using defaults: " + e.getMessage());
        }
        
        this.gatewayUrl = props.getProperty("gateway.url", "http://localhost:8080");
        this.totalUsers = Integer.parseInt(props.getProperty("test.users.total", "100"));
        this.ordersPerUser = Integer.parseInt(props.getProperty("test.orders.per.user", "50"));
        this.rampUpSeconds = Integer.parseInt(props.getProperty("test.ramp.up.seconds", "30"));
        this.userPrefix = props.getProperty("test.users.prefix", "load-test-user-");
        this.cleanupAfterTest = Boolean.parseBoolean(props.getProperty("test.cleanup.after", "true"));
        this.codPercent = Integer.parseInt(props.getProperty("payment.cod.percent", "40"));
        this.vnpayPercent = Integer.parseInt(props.getProperty("payment.vnpay.percent", "30"));
        this.momoPercent = Integer.parseInt(props.getProperty("payment.momo.percent", "30"));
    }
    
    public int getTotalOrders() {
        return totalUsers * ordersPerUser;
    }
}
