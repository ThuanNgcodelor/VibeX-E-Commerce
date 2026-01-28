package com.example.orderservice.service;

import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Deque;
import java.util.List;
import java.util.concurrent.ConcurrentLinkedDeque;

import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

import ch.qos.logback.classic.Level;
import ch.qos.logback.classic.Logger;
import ch.qos.logback.classic.LoggerContext;
import ch.qos.logback.classic.spi.ILoggingEvent;
import ch.qos.logback.core.AppenderBase;
import jakarta.annotation.PostConstruct;

/**
 * Service để capture logs từ Order Service và lưu vào RAM cho mục đích Demo.
 * CHÚ Ý: Chỉ dùng cho môi trường DEV/DEMO, không dành cho Production!
 */
@Service
public class DebugLogService {

    private static final int MAX_LOGS = 100;
    private final Deque<String> logBuffer = new ConcurrentLinkedDeque<>();
    private final DateTimeFormatter formatter = DateTimeFormatter.ofPattern("HH:mm:ss.SSS")
            .withZone(ZoneId.systemDefault());

    @PostConstruct
    public void init() {
        LoggerContext loggerContext = (LoggerContext) LoggerFactory.getILoggerFactory();
        
        // Create custom appender
        AppenderBase<ILoggingEvent> memoryAppender = new AppenderBase<>() {
            @Override
            protected void append(ILoggingEvent event) {
                String loggerName = event.getLoggerName();
                // Only capture order-service logs
                if (loggerName.startsWith("com.example.orderservice")) {
                    String formattedLog = String.format("[%s] [%s] %s - %s",
                            formatter.format(Instant.ofEpochMilli(event.getTimeStamp())),
                            event.getLevel().toString(),
                            loggerName.substring(loggerName.lastIndexOf('.') + 1),
                            event.getFormattedMessage());
                    
                    logBuffer.addLast(formattedLog);
                    
                    // Trim if exceeds max
                    while (logBuffer.size() > MAX_LOGS) {
                        logBuffer.pollFirst();
                    }
                }
            }
        };
        
        memoryAppender.setContext(loggerContext);
        memoryAppender.setName("MEMORY_APPENDER");
        memoryAppender.start();
        
        // Attach to root logger to capture all logs from order-service
        Logger rootLogger = loggerContext.getLogger("com.example.orderservice");
        rootLogger.addAppender(memoryAppender);
        rootLogger.setLevel(Level.INFO);
    }

    /**
     * Lấy danh sách log gần nhất
     * @param count Số lượng log muốn lấy (max 100)
     * @return Danh sách log strings
     */
    public List<String> getRecentLogs(int count) {
        int limit = Math.min(count, MAX_LOGS);
        List<String> logs = new ArrayList<>(logBuffer);
        
        // Return last 'limit' logs
        int startIndex = Math.max(0, logs.size() - limit);
        return logs.subList(startIndex, logs.size());
    }

    /**
     * Xóa toàn bộ buffer (reset)
     */
    public void clearLogs() {
        logBuffer.clear();
    }
}
