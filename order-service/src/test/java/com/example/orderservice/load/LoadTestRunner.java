package com.example.orderservice.load;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.CommandLineRunner;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.context.annotation.ComponentScan;

import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.TimeUnit;

/**
 * Main load test runner
 * Run as: java -jar order-service.jar --spring.main.web-application-type=none
 */
@SpringBootApplication
@ComponentScan(basePackages = "com.example.orderservice")
@RequiredArgsConstructor
@Slf4j
public class LoadTestRunner implements CommandLineRunner {
    
    private final TestDataProvider dataProvider;
    
    public static void main(String[] args) {
        // Disable web server for load test
        System.setProperty("spring.main.web-application-type", "none");
        SpringApplication.run(LoadTestRunner.class, args);
    }
    
    @Override
    public void run(String... args) throws Exception {
        log.info("╔═══════════════════════════════════════════════════════════╗");
        log.info("║         CHECKOUT LOAD TEST - STARTING                    ║");
        log.info("╚═══════════════════════════════════════════════════════════╝");
        
        LoadTestConfig config = new LoadTestConfig();
        MetricsCollector metrics = new MetricsCollector();
        
        printConfig(config);
        
        // Step 1: Prepare test data
        log.info("Step 1: Preparing test data...");
        List<TestUser> users = dataProvider.getOrCreateUsers(
            config.getTotalUsers(), 
            config.getUserPrefix()
        );
        
        List<TestProduct> products = dataProvider.getAvailableProducts(10);
        
        if (products.isEmpty()) {
            log.error("No products with available stock found! Cannot run test.");
            return;
        }
        
        log.info("Test data ready: {} users, {} products", users.size(), products.size());
        
        // Step 2: Execute load test
        log.info("Step 2: Executing load test...");
        log.info("Creating {} orders ({} users × {} orders/user)", 
            config.getTotalOrders(), users.size(), config.getOrdersPerUser());
        
        metrics.start();
        
        ExecutorService executor = Executors.newFixedThreadPool(
            Math.min(config.getTotalUsers(), 200) // Max 200 concurrent threads
        );
        
        // Calculate delay between thread starts (ramp-up)
        long delayMs = (config.getRampUpSeconds() * 1000L) / users.size();
        
        for (TestUser user : users) {
            executor.submit(new CheckoutSimulator(
                user, 
                products, 
                config, 
                metrics, 
                config.getOrdersPerUser()
            ));
            
            // Ramp-up delay
            if (delayMs > 0) {
                Thread.sleep(delayMs);
            }
        }
        
        // Wait for all threads to complete
        executor.shutdown();
        log.info("All threads started. Waiting for completion...");
        
        boolean finished = executor.awaitTermination(10, TimeUnit.MINUTES);
        metrics.end();
        
        if (!finished) {
            log.warn("Load test timed out after 10 minutes!");
            executor.shutdownNow();
        }
        
        // Step 3: Print results
        log.info("Step 3: Collecting metrics...");
        metrics.printReport();
        
        // Step 4: Cleanup (optional)
        if (config.isCleanupAfterTest()) {
            log.info("Step 4: Cleaning up test users...");
            dataProvider.cleanupTestUsers(config.getUserPrefix());
        } else {
            log.info("Step 4: Skipping cleanup (cleanup.after=false)");
        }
        
        log.info("╔═══════════════════════════════════════════════════════════╗");
        log.info("║         CHECKOUT LOAD TEST - COMPLETED                   ║");
        log.info("╚═══════════════════════════════════════════════════════════╝");
    }
    
    private void printConfig(LoadTestConfig config) {
        log.info("");
        log.info("Configuration:");
        log.info("  Gateway URL:         {}", config.getGatewayUrl());
        log.info("  Total Users:         {}", config.getTotalUsers());
        log.info("  Orders per User:     {}", config.getOrdersPerUser());
        log.info("  Total Orders:        {}", config.getTotalOrders());
        log.info("  Ramp-up Time:        {} seconds", config.getRampUpSeconds());
        log.info("  User Prefix:         {}", config.getUserPrefix());
        log.info("  Cleanup After Test:  {}", config.isCleanupAfterTest());
        log.info("  Payment Distribution:");
        log.info("    COD:     {}%", config.getCodPercent());
        log.info("    VNPAY:   {}%", config.getVnpayPercent());
        log.info("    MOMO:    {}%", config.getMomoPercent());
        log.info("");
    }
}
