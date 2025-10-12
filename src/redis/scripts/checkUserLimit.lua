-- Increment the counter atomically
local count = redis.call('INCR', KEYS[1])
-- On first increment, set expiration
if count == 1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
end

-- Repair TTL if missing (orphaned key)
local ttl = redis.call('TTL', KEYS[1])
if ttl == -1 then
    redis.call('EXPIRE', KEYS[1], ARGV[1])
    ttl = tonumber(ARGV[1])
end

-- Return the count and TTL
return {count, ttl}