-- flashsale_reserve.lua
-- KEYS[1]: flashsale:stock:{productId}
-- KEYS[2]: flashsale:bought:{userId}:{productId}
-- KEYS[3]: flashsale:reserve:{orderId}:{productId}
-- ARGV[1]: quantity
-- ARGV[2]: limitPerUser (0 or <0 means unlimited)
-- ARGV[3]: ttl

local stockKey = KEYS[1]
local boughtKey = KEYS[2]
local reserveKey = KEYS[3]

local quantity = tonumber(ARGV[1])
local limit = tonumber(ARGV[2])
local ttl = tonumber(ARGV[3])

-- 1. Check User Limit (if limit > 0)
if limit > 0 then
    local currentBought = tonumber(redis.call('GET', boughtKey) or '0')
    if (currentBought + quantity) > limit then
        return -2 -- Limit exceeded
    end
end

-- 2. Check Stock
local currentStock = tonumber(redis.call('GET', stockKey) or '0')
if currentStock < quantity then
    return 0 -- Insufficient stock
end

-- 3. Execute Reservation
redis.call('DECRBY', stockKey, quantity) 
-- Note: We DON'T increment boughtKey here yet, we only increment it upon CONFIRMATION or we can increment now?
-- Better to increment NOW to prevent race condition of same user spamming requests.
-- If reservation is cancelled/expires, we must decrement boughtKey back.
if limit > 0 then
    redis.call('INCRBY', boughtKey, quantity)
    -- Extend TTL for boughtKey to match session duration (or long enough)
    -- Assuming session duration is managed elsewhere, but set a safe TTL like 24h
    redis.call('EXPIRE', boughtKey, 86400) 
end

redis.call('SETEX', reserveKey, ttl, quantity)

return 1 -- Success
