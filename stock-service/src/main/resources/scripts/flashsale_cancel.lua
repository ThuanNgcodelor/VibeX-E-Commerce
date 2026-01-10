-- flashsale_cancel.lua
-- KEYS[1]: flashsale:stock:{productId}
-- KEYS[2]: flashsale:bought:{userId}:{productId}
-- KEYS[3]: flashsale:reserve:{orderId}:{productId}
-- ARGV[1]: limitPerUser (to check if we need to revert usage)

local stockKey = KEYS[1]
local boughtKey = KEYS[2]
local reserveKey = KEYS[3]
local limit = tonumber(ARGV[1])

local reservedQty = redis.call('GET', reserveKey)

if reservedQty then
    local qty = tonumber(reservedQty)
    
    -- 1. Restore Stock
    redis.call('INCRBY', stockKey, qty)
    
    -- 2. Restore User Limit (only if limit logic was used)
    if limit > 0 then
        redis.call('DECRBY', boughtKey, qty)
    end
    
    -- 3. Delete Reservation
    redis.call('DEL', reserveKey)
    return 1
else
    return 0 -- Reservation not found
end
