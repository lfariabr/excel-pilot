type StoreEntry = { count: number; expireAt?: number };
type SortedSetEntry = { member: string; score: number };
type Store = Map<string, StoreEntry>;
type SortedSetStore = Map<string, SortedSetEntry[]>;

const store: Store = new Map();
const sortedSets: SortedSetStore = new Map();

function nowSec() { return Math.floor(Date.now() / 1000); }

export function resetStore() {
  store.clear();
  sortedSets.clear();
}

function getEntry(key: string) {
  const entry = store.get(key);
  if (!entry) return undefined;
  if (entry.expireAt && entry.expireAt <= nowSec()) {
    store.delete(key);
    return undefined;
  }
  return entry;
}

function ensureKey(key: string) {
  const existing = getEntry(key);
  if (existing) return existing;
  const fresh: { count: number; expireAt?: number } = { count: 0 };
  store.set(key, fresh);
  return fresh;
}

function getTTL(key: string) {
  const entry = getEntry(key);
  if (!entry) return -2;
  if (!entry.expireAt) return -1;
  return entry.expireAt - nowSec();
}

export function makeRedisMock() {
  return {
    // Minimal methods used elsewhere (if any tests call them)
    get: async (key: string) => {
      const entry = getEntry(key);
      return entry ? String(entry.count) : null;
    },
    ttl: async (key: string) => getTTL(key),
    incr: async (key: string) => {
      const e = ensureKey(key);
      e.count += 1;
      return e.count;
    },
    incrby: async (key: string, delta: number) => {
      const e = ensureKey(key);
      e.count += delta;
      return e.count;
    },
    decrby: async (key: string, delta: number) => {
      const e = ensureKey(key);
      e.count -= delta;
      return e.count;
    },
    expire: async (key: string, seconds: number) => {
      const e = ensureKey(key);
      e.expireAt = nowSec() + seconds;
      return 1;
    },
    pipeline: () => {
      const ops: Array<() => any> = [];
      return {
        incrby: (k: string, d: number) => ops.push(() => (ensureKey(k).count += d)),
        decrby: (k: string, d: number) => ops.push(() => (ensureKey(k).count -= d)),
        expire: (k: string, s: number) => ops.push(() => (ensureKey(k).expireAt = nowSec() + s)),
        exec: async () => ops.map(fn => fn()),
      };
    },
    // Core: simulate your Lua scripts by recognizing argument shapes
    eval: async (script: string, numKeys: number, ...args: any[]) => {
      if (numKeys === 1) {
        // checkUserLimit(): args = [key, windowSec]
        const [key, windowSec] = args as [string, number];
        const e = ensureKey(key);
        e.count += 1;
        // set/repair TTL
        const ttl = getTTL(key);
        if (e.count === 1 || ttl === -1) {
          e.expireAt = nowSec() + windowSec;
        }
        const curTTL = Math.max(1, getTTL(key) === -1 ? windowSec : getTTL(key));
        return [e.count, curTTL];
      }
      if (numKeys === 2) {
        // checkUserTokenBudget():
        // args = [dailyKey, monthlyKey, tokens, dailyLimit, monthlyLimit, dailyTTL, monthlyTTL]
        const [dailyKey, monthlyKey, tokens, dailyLimit, monthlyLimit, dailyTTL, monthlyTTL] = args as [string, string, number, number, number, number, number];
        const d = ensureKey(dailyKey);
        const m = ensureKey(monthlyKey);
        d.count += tokens;
        m.count += tokens;
        // TTL repair
        if (getTTL(dailyKey) === -1) d.expireAt = nowSec() + dailyTTL;
        if (getTTL(monthlyKey) === -1) m.expireAt = nowSec() + monthlyTTL;
        const exceeded = d.count > dailyLimit || m.count > monthlyLimit;
        if (exceeded) {
          d.count -= tokens;
          m.count -= tokens;
          // return post-rollback values
          const dttl = getTTL(dailyKey) === -1 ? (d.expireAt = nowSec() + dailyTTL, dailyTTL) : Math.max(1, getTTL(dailyKey));
          const mttl = getTTL(monthlyKey) === -1 ? (m.expireAt = nowSec() + monthlyTTL, monthlyTTL) : Math.max(1, getTTL(monthlyKey));
          return [0, d.count, m.count, dttl, mttl];
        }
        const dttl = Math.max(1, getTTL(dailyKey));
        const mttl = Math.max(1, getTTL(monthlyKey));
        return [1, d.count, m.count, dttl, mttl];
      }
      throw new Error('Unsupported eval shape in mock');
    },
    // Sorted set operations for analytics
    zadd: async (key: string, ...args: any[]) => {
      if (!sortedSets.has(key)) {
        sortedSets.set(key, []);
      }
      const set = sortedSets.get(key)!;
      // zadd key score member
      const score = typeof args[0] === 'number' ? args[0] : parseFloat(args[0]);
      const member = args[1];
      set.push({ member, score });
      return set.length;
    },
    zincrby: async (key: string, increment: number, member: string) => {
      if (!sortedSets.has(key)) {
        sortedSets.set(key, []);
      }
      const set = sortedSets.get(key)!;
      const existing = set.find(e => e.member === member);
      if (existing) {
        existing.score += increment;
        return existing.score;
      } else {
        set.push({ member, score: increment });
        return increment;
      }
    },
    zcard: async (key: string) => {
      const set = sortedSets.get(key);
      return set ? set.length : 0;
    },
    zrange: async (key: string, start: number, stop: number, ...args: any[]) => {
      const set = sortedSets.get(key);
      if (!set || set.length === 0) return [];
      
      const sorted = [...set].sort((a, b) => a.score - b.score);
      const actualStop = stop === -1 ? sorted.length : stop + 1;
      const slice = sorted.slice(start, actualStop);
      
      // Check if WITHSCORES flag is present
      const withScores = args.includes('WITHSCORES');
      if (withScores) {
        const result: any[] = [];
        slice.forEach(e => {
          result.push(e.member, e.score.toString());
        });
        return result;
      }
      return slice.map(e => e.member);
    },
    zrangebyscore: async (key: string, min: number | string, max: number | string) => {
      const set = sortedSets.get(key);
      if (!set || set.length === 0) return [];
      
      const minScore = typeof min === 'string' ? parseFloat(min) : min;
      const maxScore = typeof max === 'string' ? parseFloat(max) : max;
      
      return set
        .filter(e => e.score >= minScore && e.score <= maxScore)
        .sort((a, b) => a.score - b.score)
        .map(e => e.member);
    },
    zremrangebyscore: async (key: string, min: number | string, max: number | string) => {
      const set = sortedSets.get(key);
      if (!set) return 0;
      
      const minScore = typeof min === 'string' ? parseFloat(min) : min;
      const maxScore = typeof max === 'string' ? parseFloat(max) : max;
      
      const initialLength = set.length;
      const filtered = set.filter(e => e.score < minScore || e.score > maxScore);
      sortedSets.set(key, filtered);
      return initialLength - filtered.length;
    },
    zscore: async (key: string, member: string) => {
      const set = sortedSets.get(key);
      if (!set) return null;
      const entry = set.find(e => e.member === member);
      return entry ? entry.score : null;
    },
    // Key operations
    keys: async (pattern: string) => {
      // Simple pattern matching: convert glob to regex
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      
      const allKeys = [...store.keys(), ...sortedSets.keys()];
      return allKeys.filter(k => regex.test(k));
    },
    del: async (...keys: string[]) => {
      let deleted = 0;
      keys.forEach(key => {
        if (store.has(key)) {
          store.delete(key);
          deleted++;
        }
        if (sortedSets.has(key)) {
          sortedSets.delete(key);
          deleted++;
        }
      });
      return deleted;
    },
    scan: async (cursor: string, ...args: any[]) => {
      // Simple mock: return all matching keys on first call, empty on subsequent
      if (cursor !== '0') {
        return ['0', []];
      }
      
      // Find MATCH argument
      const matchIndex = args.indexOf('MATCH');
      const pattern = matchIndex >= 0 ? args[matchIndex + 1] : '*';
      
      const regexPattern = pattern
        .replace(/\*/g, '.*')
        .replace(/\?/g, '.');
      const regex = new RegExp(`^${regexPattern}$`);
      
      const allKeys = [...store.keys(), ...sortedSets.keys()];
      const matchedKeys = allKeys.filter(k => regex.test(k));
      
      return ['0', matchedKeys];
    },
    multi: () => {
      const ops: Array<() => any> = [];
      const multiClient: any = {
        zadd: (key: string, ...args: any[]) => {
          ops.push(async () => {
            if (!sortedSets.has(key)) sortedSets.set(key, []);
            const set = sortedSets.get(key)!;
            const score = typeof args[0] === 'number' ? args[0] : parseFloat(args[0]);
            const member = args[1];
            set.push({ member, score });
            return set.length;
          });
          return multiClient;
        },
        zincrby: (key: string, increment: number, member: string) => {
          ops.push(async () => {
            if (!sortedSets.has(key)) sortedSets.set(key, []);
            const set = sortedSets.get(key)!;
            const existing = set.find(e => e.member === member);
            if (existing) {
              existing.score += increment;
              return existing.score;
            } else {
              set.push({ member, score: increment });
              return increment;
            }
          });
          return multiClient;
        },
        zremrangebyscore: (key: string, min: number | string, max: number | string) => {
          ops.push(async () => {
            const set = sortedSets.get(key);
            if (!set) return 0;
            const minScore = typeof min === 'string' ? parseFloat(min) : min;
            const maxScore = typeof max === 'string' ? parseFloat(max) : max;
            const initialLength = set.length;
            const filtered = set.filter(e => e.score < minScore || e.score > maxScore);
            sortedSets.set(key, filtered);
            return initialLength - filtered.length;
          });
          return multiClient;
        },
        expire: (key: string, seconds: number) => {
          ops.push(async () => {
            const e = ensureKey(key);
            e.expireAt = nowSec() + seconds;
            return 1;
          });
          return multiClient;
        },
        exec: async () => {
          const results = [];
          for (const op of ops) {
            results.push(await op());
          }
          return results;
        },
      };
      return multiClient;
    },
    // No-op for tests
    quit: async () => Promise.resolve(),
  };
}