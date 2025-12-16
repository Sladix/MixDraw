import { random, chance } from '../utils/random.js';

/**
 * Generic hatching system for any shape
 * Now with proper clipping to complex shapes
 */
export function hatchArea(bounds, options = {}) {
    const {
        style = 'diagonal',
        density = 4,
        angle = 45,
        strokeWidth = 0.5,
        coverage = 0.3,
        side = 'left',
        clipPath = null, // Paper.js path for clipping
    } = options;

    const paths = [];
    const { x, y, w, h } = bounds;

    // Determine hatch area based on side
    let hatchBounds;
    switch (side) {
        case 'left':
            hatchBounds = { x, y, w: w * coverage, h };
            break;
        case 'right':
            hatchBounds = { x: x + w * (1 - coverage), y, w: w * coverage, h };
            break;
        case 'top':
            hatchBounds = { x, y, w, h: h * coverage };
            break;
        case 'bottom':
            hatchBounds = { x, y: y + h * (1 - coverage), w, h: h * coverage };
            break;
        case 'all':
        default:
            hatchBounds = bounds;
    }

    let rawLines = [];

    switch (style) {
        case 'diagonal':
            rawLines = generateDiagonalLines(hatchBounds, density, angle);
            break;
        case 'horizontal':
            rawLines = generateDiagonalLines(hatchBounds, density, 0);
            break;
        case 'vertical':
            rawLines = generateDiagonalLines(hatchBounds, density, 90);
            break;
        case 'cross':
            rawLines = [
                ...generateDiagonalLines(hatchBounds, density * 1.5, 45),
                ...generateDiagonalLines(hatchBounds, density * 1.5, -45),
            ];
            break;
        case 'random':
            rawLines = generateRandomLines(hatchBounds, density);
            break;
    }

    // Clip lines to shape if clipPath provided
    for (const line of rawLines) {
        const clippedPaths = clipLineToShape(line, clipPath, strokeWidth);
        paths.push(...clippedPaths);
    }

    return paths;
}

/**
 * Generate diagonal parallel lines
 */
function generateDiagonalLines(bounds, spacing, angleDeg) {
    const lines = [];
    const { x, y, w, h } = bounds;
    const angle = angleDeg * Math.PI / 180;

    const cos = Math.cos(angle);
    const sin = Math.sin(angle);

    const diagonal = Math.sqrt(w * w + h * h);
    const lineCount = Math.ceil(diagonal / spacing);

    const cx = x + w / 2;
    const cy = y + h / 2;

    for (let i = -lineCount; i <= lineCount; i++) {
        const offset = i * spacing;
        const len = diagonal;

        lines.push({
            x1: cx + offset * cos - len * sin,
            y1: cy + offset * sin + len * cos,
            x2: cx + offset * cos + len * sin,
            y2: cy + offset * sin - len * cos,
        });
    }

    return lines;
}

/**
 * Generate random short lines
 */
function generateRandomLines(bounds, density) {
    const lines = [];
    const { x, y, w, h } = bounds;
    const lineCount = Math.floor((w * h) / (density * density * 10));

    for (let i = 0; i < lineCount; i++) {
        if (!chance(0.7)) continue;

        const x1 = x + random() * w;
        const y1 = y + random() * h;
        const len = density * (0.5 + random());
        const angle = random() * Math.PI * 2;

        lines.push({
            x1,
            y1,
            x2: x1 + Math.cos(angle) * len,
            y2: y1 + Math.sin(angle) * len,
        });
    }

    return lines;
}

/**
 * Clip a line to a Paper.js path shape
 * Returns array of paths (may be split into multiple segments)
 */
function clipLineToShape(line, clipPath, strokeWidth) {
    const paths = [];

    if (!clipPath) {
        // No clip path - just create the line
        const path = new paper.Path({
            strokeColor: '#1a1a1a',
            strokeWidth: strokeWidth,
        });
        path.add(new paper.Point(line.x1, line.y1));
        path.add(new paper.Point(line.x2, line.y2));
        paths.push(path);
        return paths;
    }

    // Create a temporary line path
    const linePath = new paper.Path({
        segments: [
            new paper.Point(line.x1, line.y1),
            new paper.Point(line.x2, line.y2),
        ],
    });

    // Find intersections with clip path
    const intersections = linePath.getIntersections(clipPath);

    if (intersections.length === 0) {
        // Line is either fully inside or fully outside
        const midPoint = new paper.Point(
            (line.x1 + line.x2) / 2,
            (line.y1 + line.y2) / 2
        );

        if (clipPath.contains(midPoint)) {
            // Fully inside - draw it
            const path = new paper.Path({
                strokeColor: '#1a1a1a',
                strokeWidth: strokeWidth,
            });
            path.add(new paper.Point(line.x1, line.y1));
            path.add(new paper.Point(line.x2, line.y2));
            paths.push(path);
        }
        // Fully outside - don't draw
    } else if (intersections.length >= 2) {
        // Sort intersections by position along line
        intersections.sort((a, b) => a.offset - b.offset);

        // Draw segments that are inside the shape
        const points = [
            new paper.Point(line.x1, line.y1),
            ...intersections.map(i => i.point),
            new paper.Point(line.x2, line.y2),
        ];

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const mid = new paper.Point(
                (p1.x + p2.x) / 2,
                (p1.y + p2.y) / 2
            );

            if (clipPath.contains(mid)) {
                const path = new paper.Path({
                    strokeColor: '#1a1a1a',
                    strokeWidth: strokeWidth,
                });
                path.add(p1);
                path.add(p2);
                paths.push(path);
            }
        }
    } else if (intersections.length === 1) {
        // One intersection - one end is inside, one outside
        const p1 = new paper.Point(line.x1, line.y1);
        const p2 = new paper.Point(line.x2, line.y2);
        const intersection = intersections[0].point;

        const p1Inside = clipPath.contains(p1);

        const path = new paper.Path({
            strokeColor: '#1a1a1a',
            strokeWidth: strokeWidth,
        });

        if (p1Inside) {
            path.add(p1);
            path.add(intersection);
        } else {
            path.add(intersection);
            path.add(p2);
        }
        paths.push(path);
    }

    // Clean up temporary path
    linePath.remove();

    return paths;
}

/**
 * Hatch a triangular area (for spires)
 */
export function hatchTriangle(x1, y1, x2, y2, x3, y3, options = {}) {
    // Create clip path
    const clipPath = new paper.Path({
        segments: [
            new paper.Point(x1, y1),
            new paper.Point(x2, y2),
            new paper.Point(x3, y3),
        ],
        closed: true,
    });

    // Bounding box
    const minX = Math.min(x1, x2, x3);
    const maxX = Math.max(x1, x2, x3);
    const minY = Math.min(y1, y2, y3);
    const maxY = Math.max(y1, y2, y3);

    const paths = hatchArea(
        { x: minX, y: minY, w: maxX - minX, h: maxY - minY },
        { ...options, side: 'all', clipPath }
    );

    // Clean up clip path
    clipPath.remove();

    return paths;
}

/**
 * Hatch a dome/arc area
 */
export function hatchDome(cx, cy, width, height, options = {}) {
    const rx = width / 2;

    // Create clip path (arc + baseline)
    const clipPath = new paper.Path({
        closed: true,
    });

    // Bottom left
    clipPath.add(new paper.Point(cx - rx, cy));

    // Arc to top to bottom right
    clipPath.arcTo(
        new paper.Point(cx, cy - height),
        new paper.Point(cx + rx, cy)
    );

    const paths = hatchArea(
        { x: cx - rx, y: cy - height, w: width, h: height },
        { ...options, side: 'all', clipPath }
    );

    // Clean up
    clipPath.remove();

    return paths;
}

/**
 * Hatch an irregular polygon (for broken shapes)
 */
export function hatchPolygon(points, options = {}) {
    if (points.length < 3) return [];

    // Create clip path
    const clipPath = new paper.Path({
        segments: points.map(p => new paper.Point(p.x, p.y)),
        closed: true,
    });

    // Bounding box
    const bounds = clipPath.bounds;

    const paths = hatchArea(
        { x: bounds.x, y: bounds.y, w: bounds.width, h: bounds.height },
        { ...options, side: 'all', clipPath }
    );

    // Clean up
    clipPath.remove();

    return paths;
}
