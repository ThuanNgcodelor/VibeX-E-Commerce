package com.example.stockservice.service.cache;

import lombok.RequiredArgsConstructor;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.util.concurrent.TimeUnit;
import java.util.function.Supplier;



//Hàm này dùng để lock Cache
@Service
@RequiredArgsConstructor
public class RedisLockService {

    private final StringRedisTemplate redisTemplate;

    public boolean tryLock(String lockKey, long timeout, TimeUnit unit) {
        Boolean acquired = redisTemplate.opsForValue()
                .setIfAbsent(lockKey, "1", timeout, unit);
        return Boolean.TRUE.equals(acquired);
    }


    public void unlock(String lockKey) {
        redisTemplate.delete(lockKey);
    }

    public <T> T executeWithLock(String lockKey, int timeoutSeconds, Supplier<T> action) {
        if (tryLock(lockKey, timeoutSeconds, TimeUnit.SECONDS)) {
            try {
                return action.get();
            } finally {
                unlock(lockKey);
            }
        } else {
            // Lock busy, wait a bit and retry
            // Ideally we should throw exception or wait/retry with backoff
            // For now, let's wait 50ms and recurse once (or throw)
            try {
                TimeUnit.MILLISECONDS.sleep(50);
            } catch (InterruptedException e) {
                Thread.currentThread().interrupt();
            }
            // Retry once
            if (tryLock(lockKey, timeoutSeconds, TimeUnit.SECONDS)) {
                try {
                    return action.get();
                } finally {
                    unlock(lockKey);
                }
            }
            throw new RuntimeException("Could not acquire lock for key: " + lockKey);
        }
    }
}
