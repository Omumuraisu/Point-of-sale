export function safeJson<T>(value: T): T {
    return JSON.parse(
        JSON.stringify(value, (_key, val) => {
            if (typeof val === "bigint") {
                return val.toString();
            }
            return val;
        })
    ) as T;
}