
export function isHalloweenEventActive(now = new Date()) {
    const year = now.getUTCFullYear();

    const opens = Date.UTC(year, 9, 26, 15, 0, 0);
    const closes = Date.UTC(year, 10, 5, 15, 0, 0);

    const timestamp = now.getTime();

    return timestamp >= opens && timestamp < closes;
}
