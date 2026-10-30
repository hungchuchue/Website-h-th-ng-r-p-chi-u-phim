"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const store = new Map();
const cache = {
    get(key) {
        const entry = store.get(key);
        if (!entry || entry.expiresAt < Date.now()) {
            store.delete(key);
            return undefined;
        }
        return entry.value;
    },
    set(key, value, ttlSeconds) {
        store.set(key, { value, expiresAt: Date.now() + ttlSeconds * 1000 });
    },
    flushAll() {
        store.clear();
    }
};
exports.default = cache;
//# sourceMappingURL=cache.js.map