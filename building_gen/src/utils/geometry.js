// Cohen-Sutherland line clipping
export function clipLineToRect(x1, y1, x2, y2, rx, ry, rx2, ry2) {
    const INSIDE = 0, LEFT = 1, RIGHT = 2, BOTTOM = 4, TOP = 8;

    function code(x, y) {
        let c = INSIDE;
        if (x < rx) c |= LEFT;
        else if (x > rx2) c |= RIGHT;
        if (y < ry) c |= TOP;
        else if (y > ry2) c |= BOTTOM;
        return c;
    }

    let c1 = code(x1, y1);
    let c2 = code(x2, y2);

    while (true) {
        if (!(c1 | c2)) {
            return { x1, y1, x2, y2 };
        }
        if (c1 & c2) {
            return null;
        }

        const c = c1 || c2;
        let x, y;

        if (c & TOP) {
            x = x1 + (x2 - x1) * (ry - y1) / (y2 - y1);
            y = ry;
        } else if (c & BOTTOM) {
            x = x1 + (x2 - x1) * (ry2 - y1) / (y2 - y1);
            y = ry2;
        } else if (c & RIGHT) {
            y = y1 + (y2 - y1) * (rx2 - x1) / (x2 - x1);
            x = rx2;
        } else {
            y = y1 + (y2 - y1) * (rx - x1) / (x2 - x1);
            x = rx;
        }

        if (c === c1) {
            x1 = x; y1 = y;
            c1 = code(x1, y1);
        } else {
            x2 = x; y2 = y;
            c2 = code(x2, y2);
        }
    }
}

// Check if a point is inside a rectangle
export function pointInRect(px, py, rx, ry, rw, rh) {
    return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
}

// Check if two rectangles overlap
export function rectsOverlap(r1, r2) {
    return !(r1.x + r1.w < r2.x || r2.x + r2.w < r1.x ||
             r1.y + r1.h < r2.y || r2.y + r2.h < r1.y);
}

// Get rectangle intersection
export function rectIntersection(r1, r2) {
    const x = Math.max(r1.x, r2.x);
    const y = Math.max(r1.y, r2.y);
    const w = Math.min(r1.x + r1.w, r2.x + r2.w) - x;
    const h = Math.min(r1.y + r1.h, r2.y + r2.h) - y;

    if (w <= 0 || h <= 0) return null;
    return { x, y, w, h };
}

// Distance between two points
export function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
}

// Normalize a vector
export function normalize(x, y) {
    const len = Math.sqrt(x * x + y * y);
    if (len === 0) return { x: 0, y: 0 };
    return { x: x / len, y: y / len };
}
