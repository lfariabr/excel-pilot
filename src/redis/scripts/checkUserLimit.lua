local count = redis.call('INCR', KEYS[1])
    if count == 1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
    end

    local ttl = redis.call('TTL', KEYS[1])
    if ttl == -1 then
        redis.call('EXPIRE', KEYS[1], ARGV[1])
        ttl = tonumber(ARGV[1])
    end
    
    return {count, ttl}