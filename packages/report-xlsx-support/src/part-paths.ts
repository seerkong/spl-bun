export function resolvePart(base: string, target: string): string {
    const segments = (target.startsWith("/") ? target.slice(1) : `${base.slice(0, base.lastIndexOf("/") + 1)}${target}`).split("/"), result: string[] = [];
    for (const segment of segments) {
        if (segment === "..") {
            if (!result.length)
                throw new Error("Part target escapes archive");
            result.pop();
        }
        else if (segment !== "." && segment)
            result.push(segment);
    }
    return result.join("/");
}
export function relativePart(owner: string, target: string): string {
    const from = owner.split("/").slice(0, -1), to = target.split("/");
    while (from.length && to.length && from[0] === to[0]) {
        from.shift();
        to.shift();
    }
    return [...from.map(() => ".."), ...to].join("/");
}
export function relPathFor(path: string): string { return `${path.slice(0, path.lastIndexOf("/") + 1)}_rels/${path.slice(path.lastIndexOf("/") + 1)}.rels`; }
