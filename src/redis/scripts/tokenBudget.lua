local dailyKey = KEYS[1]
local monthlyKey = KEYS[2]
local tokens = tonumber(ARGV[1])
local dailyLimit = tonumber(ARGV[2])
local monthlyLimit = tonumber(ARGV[3])
local dailyTTLSeconds = tonumber(ARGV[4])
local monthlyTTLSeconds = tonumber(ARGV[5])

-- Increment both counters atomically
local daily = redis.call('INCRBY', dailyKey, tokens)
local monthly = redis.call('INCRBY', monthlyKey, tokens)

-- Ensure TTLs are set (repair orphaned keys)
local dttl = redis.call('TTL', dailyKey)
if dttl == -1 then
    redis.call('EXPIRE', dailyKey, dailyTTLSeconds)
    dttl = dailyTTLSeconds
end

local mttl = redis.call('TTL', monthlyKey)
if mttl == -1 then
    redis.call('EXPIRE', monthlyKey, monthlyTTLSeconds)
    mttl = monthlyTTLSeconds
end

-- Check limits and rollback if exceeded
local exceededDaily = (daily > dailyLimit)
local exceededMonthly = (monthly > monthlyLimit)
if exceededDaily or exceededMonthly then
    -- Atomic rollback
    redis.call('DECRBY', dailyKey, tokens)
    redis.call('DECRBY', monthlyKey, tokens)
    -- Read post-rollback values
    local dval = tonumber(redis.call('GET', dailyKey) or '0')
    local mval = tonumber(redis.call('GET', monthlyKey) or '0')

    -- Re-repair TTLs after rollback
    dttl = redis.call('TTL', dailyKey)
    if dttl == -1 then
        redis.call('EXPIRE', dailyKey, dailyTTLSeconds)
        dttl = dailyTTLSeconds
    end

    mttl = redis.call('TTL', monthlyKey)
    if mttl == -1 then
        redis.call('EXPIRE', monthlyKey, monthlyTTLSeconds)
        mttl = monthlyTTLSeconds
    end

    -- Return failure with rolled-back values
    return {0, dval, mval, dttl, mttl}
end

-- Return success with current values
return {1, daily, monthly, dttl, mttl}