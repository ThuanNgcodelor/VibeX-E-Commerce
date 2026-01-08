package com.example.orderservice.load;

import lombok.Getter;
import lombok.extern.slf4j.Slf4j;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import java.util.concurrent.atomic.AtomicLong;

/**
 * Collects and reports load test metrics
 */
@Slf4j
@Getter
public class MetricsCollector {
    private final AtomicLong totalRequests = new AtomicLong(0);
    private final AtomicLong successfulRequests = new AtomicLong(0);
    private final AtomicLong failedRequests = new AtomicLong(0);
    private final List<Long> latencies = new CopyOnWriteArrayList<>();
    
    private long startTime;
    private long endTime;
    
    public void start() {
        startTime = System.currentTimeMillis();
        log.info("=== Load Test Started ===");
    }
    
    public void end() {
        endTime = System.currentTimeMillis();
        log.info("=== Load Test Ended ===");
    }
    
    public void recordSuccess(long latencyMs) {
        totalRequests.incrementAndGet();
        successfulRequests.incrementAndGet();
        latencies.add(latencyMs);
    }
    
    public void recordFailure(long latencyMs) {
        totalRequests.incrementAndGet();
        failedRequests.incrementAndGet();
        latencies.add(latencyMs);
    }
    
    public void printReport() {
        long duration = (endTime - startTime) / 1000; // seconds
        double throughput = duration > 0 ? successfulRequests.get() / (double) duration : 0;
        
        List<Long> sortedLatencies = new ArrayList<>(latencies);
        Collections.sort(sortedLatencies);
        
        System.out.println("\n");
        System.out.println("╔═══════════════════════════════════════════════════════════╗");
        System.out.println("║           LOAD TEST RESULTS - CHECKOUT PERFORMANCE        ║");
        System.out.println("╠═══════════════════════════════════════════════════════════╣");
        System.out.println(String.format("║ Total Duration:           %-31s ║", duration + " seconds"));
        System.out.println(String.format("║ Total Requests:           %-31s ║", totalRequests.get()));
        System.out.println(String.format("║ Successful Requests:      %-31s ║", successfulRequests.get()));
        System.out.println(String.format("║ Failed Requests:          %-31s ║", failedRequests.get()));
        System.out.println(String.format("║ Success Rate:             %-31s ║", 
            String.format("%.2f%%", (successfulRequests.get() * 100.0 / totalRequests.get()))));
        System.out.println("╠═══════════════════════════════════════════════════════════╣");
        System.out.println(String.format("║ ⚡ THROUGHPUT:            %-31s ║", 
            String.format("%.2f orders/second", throughput)));
        System.out.println("╠═══════════════════════════════════════════════════════════╣");
        System.out.println("║ LATENCY PERCENTILES (ms):                                 ║");
        System.out.println(String.format("║   p50 (median):           %-31s ║", getPercentile(sortedLatencies, 50)));
        System.out.println(String.format("║   p90:                    %-31s ║", getPercentile(sortedLatencies, 90)));
        System.out.println(String.format("║   p95:                    %-31s ║", getPercentile(sortedLatencies, 95)));
        System.out.println(String.format("║   p99:                    %-31s ║", getPercentile(sortedLatencies, 99)));
        System.out.println(String.format("║   Min:                    %-31s ║", sortedLatencies.isEmpty() ? "N/A" : sortedLatencies.get(0)));
        System.out.println(String.format("║   Max:                    %-31s ║", sortedLatencies.isEmpty() ? "N/A" : sortedLatencies.get(sortedLatencies.size() - 1)));
        System.out.println("╚═══════════════════════════════════════════════════════════╝");
        System.out.println("\n");
        
        // Log summary
        log.info("THROUGHPUT: {:.2f} orders/second", throughput);
        log.info("SUCCESS RATE: {:.2f}%", (successfulRequests.get() * 100.0 / totalRequests.get()));
        log.info("LATENCY p50: {}ms, p95: {}ms, p99: {}ms", 
            getPercentile(sortedLatencies, 50),
            getPercentile(sortedLatencies, 95),
            getPercentile(sortedLatencies, 99));
    }
    
    private long getPercentile(List<Long> sortedList, int percentile) {
        if (sortedList.isEmpty()) return 0;
        int index = (int) Math.ceil(percentile / 100.0 * sortedList.size()) - 1;
        index = Math.max(0, Math.min(index, sortedList.size() - 1));
        return sortedList.get(index);
    }
}
