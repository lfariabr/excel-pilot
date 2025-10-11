type Store = Map<string, { count: number; expireAt?: number }>;

const store: Store = new Map();

function nowSec() { return Math.floor(Date.now() / 1000); }

export function resetStore() {
  store.clear();
}

function getTTL(key: string) {
  const entry = store.get(key);
  if (!entry || !entry.expireAt) return -1;
  const ttl = entry.expireAt - nowSec();
  return ttl > 0 ? ttl : -2; // -2 if expired
}

function ensureKey(key: string) {
  if (!store.has(key)) store.set(key, { count: 0 });
  return store.get(key)!;
}

export function makeRedisMock() {
  return {
    // Minimal methods used elsewhere (if any tests call them)
    get: async (key: string) => {
      const entry = store.get(key);
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
  };
}