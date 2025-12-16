/**
 * Edge extraction and filtering for plotter-friendly rendering
 *
 * The key insight: we don't filter edges by checking overlaps.
 * Instead, we render blocks back-to-front with white fills,
 * then extract only the visible outlines.
 *
 * But for pure line art (no fills), we need smart edge management.
 */

/**
 * Get all edges from a block's bounds with chamfers
 */
export function getBlockEdges(block) {
    const { x, y, w, h } = block.bounds;
    const c = block.chamfer || { tl: 0, tr: 0, bl: 0, br: 0 };
    const edges = [];

    // Skip special shapes
    if (block.type === 'dome' || block.type === 'spire') return edges;

    // Top edge segments
    if (c.tl > 0) {
        // Top-left chamfer
        edges.push({ x1: x, y1: y + c.tl, x2: x + c.tl, y2: y, block, side: 'chamfer-tl' });
    }

    // Top line
    const topX1 = x + c.tl;
    const topX2 = x + w - c.tr;
    if (topX2 > topX1) {
        edges.push({ x1: topX1, y1: y, x2: topX2, y2: y, block, side: 'top' });
    }

    if (c.tr > 0) {
        // Top-right chamfer
        edges.push({ x1: x + w - c.tr, y1: y, x2: x + w, y2: y + c.tr, block, side: 'chamfer-tr' });
    }

    // Right edge
    const rightY1 = y + c.tr;
    const rightY2 = y + h - c.br;
    edges.push({ x1: x + w, y1: rightY1, x2: x + w, y2: rightY2, block, side: 'right' });

    if (c.br > 0) {
        // Bottom-right chamfer
        edges.push({ x1: x + w, y1: y + h - c.br, x2: x + w - c.br, y2: y + h, block, side: 'chamfer-br' });
    }

    // Bottom edge
    const botX1 = x + w - c.br;
    const botX2 = x + c.bl;
    if (botX1 > botX2) {
        edges.push({ x1: botX1, y1: y + h, x2: botX2, y2: y + h, block, side: 'bottom' });
    }

    if (c.bl > 0) {
        // Bottom-left chamfer
        edges.push({ x1: x + c.bl, y1: y + h, x2: x, y2: y + h - c.bl, block, side: 'chamfer-bl' });
    }

    // Left edge
    const leftY1 = y + h - c.bl;
    const leftY2 = y + c.tl;
    edges.push({ x1: x, y1: leftY1, x2: x, y2: leftY2, block, side: 'left' });

    return edges;
}

/**
 * Check if an edge is fully contained within another block's bounds
 * (meaning it's an internal edge and shouldn't be drawn)
 */
function edgeInsideBlock(edge, block, tolerance = 1) {
    if (edge.block === block) return false;

    const { x, y, w, h } = block.bounds;

    // Check if both endpoints are inside the block
    const p1Inside = edge.x1 >= x - tolerance && edge.x1 <= x + w + tolerance &&
                     edge.y1 >= y - tolerance && edge.y1 <= y + h + tolerance;
    const p2Inside = edge.x2 >= x - tolerance && edge.x2 <= x + w + tolerance &&
                     edge.y2 >= y - tolerance && edge.y2 <= y + h + tolerance;

    return p1Inside && p2Inside;
}

/**
 * Check if an edge lies exactly on another block's boundary
 * (shared edge - only draw once)
 */
function edgeOnBlockBoundary(edge, block, tolerance = 2) {
    if (edge.block === block) return false;

    const { x, y, w, h } = block.bounds;

    // Check if edge is horizontal
    if (Math.abs(edge.y1 - edge.y2) < tolerance) {
        // Is it on the top or bottom of the other block?
        if (Math.abs(edge.y1 - y) < tolerance || Math.abs(edge.y1 - (y + h)) < tolerance) {
            // Check X overlap
            const edgeMinX = Math.min(edge.x1, edge.x2);
            const edgeMaxX = Math.max(edge.x1, edge.x2);
            return edgeMinX >= x - tolerance && edgeMaxX <= x + w + tolerance;
        }
    }

    // Check if edge is vertical
    if (Math.abs(edge.x1 - edge.x2) < tolerance) {
        // Is it on the left or right of the other block?
        if (Math.abs(edge.x1 - x) < tolerance || Math.abs(edge.x1 - (x + w)) < tolerance) {
            // Check Y overlap
            const edgeMinY = Math.min(edge.y1, edge.y2);
            const edgeMaxY = Math.max(edge.y1, edge.y2);
            return edgeMinY >= y - tolerance && edgeMaxY <= y + h + tolerance;
        }
    }

    return false;
}

/**
 * Filter edges to remove internal/duplicate lines
 *
 * Strategy: For each edge, check if it's:
 * 1. Fully inside another block (don't draw)
 * 2. On the boundary of a block in front (don't draw - front block will draw it)
 * 3. Otherwise, draw it
 */
export function filterEdges(edges, blocks) {
    const result = [];
    const tolerance = 2;

    // Blocks sorted by z-order (back to front)
    const sortedBlocks = [...blocks].sort((a, b) => a.zOrder - b.zOrder);

    for (const edge of edges) {
        let shouldDraw = true;
        const edgeBlockIndex = sortedBlocks.findIndex(b => b === edge.block);

        // Check against all blocks IN FRONT of this edge's block
        for (let i = edgeBlockIndex + 1; i < sortedBlocks.length; i++) {
            const frontBlock = sortedBlocks[i];

            // Skip spires and domes (handled separately)
            if (frontBlock.type === 'spire' || frontBlock.type === 'dome') continue;

            // If edge is fully inside a front block, don't draw
            if (edgeInsideBlock(edge, frontBlock, tolerance)) {
                shouldDraw = false;
                break;
            }

            // If edge is on a front block's boundary, let front block draw it
            if (edgeOnBlockBoundary(edge, frontBlock, tolerance)) {
                shouldDraw = false;
                break;
            }
        }

        if (shouldDraw) {
            result.push(edge);
        }
    }

    return result;
}

/**
 * Convert edges to Paper.js paths
 */
export function edgesToPaths(edges, strokeWidth = 1.5) {
    const paths = [];

    for (const edge of edges) {
        const path = new paper.Path({
            strokeColor: '#1a1a1a',
            strokeWidth: strokeWidth,
            strokeCap: 'round',
            strokeJoin: 'round',
        });
        path.add(new paper.Point(edge.x1, edge.y1));
        path.add(new paper.Point(edge.x2, edge.y2));
        paths.push(path);
    }

    return paths;
}

/**
 * Create a filled shape for a block (for occlusion)
 */
export function blockToFilledPath(block, fillColor = 'white') {
    const { x, y, w, h } = block.bounds;
    const c = block.chamfer || { tl: 0, tr: 0, bl: 0, br: 0 };

    if (block.type === 'dome') {
        return createDomePath(block.bounds, fillColor);
    }

    if (block.type === 'spire') {
        return createSpirePath(block.bounds, fillColor);
    }

    // Irregular outline (ruin/brutalist)
    if (block.outline && block.outline.length > 2) {
        return createIrregularPath(block.outline, fillColor);
    }

    // Regular block with chamfers
    const path = new paper.Path({
        fillColor: fillColor,
        strokeColor: '#1a1a1a',
        strokeWidth: 1.5,
        closed: true,
    });

    // Start from top-left, going clockwise
    if (c.tl > 0) {
        path.add(new paper.Point(x, y + c.tl));
        path.add(new paper.Point(x + c.tl, y));
    } else {
        path.add(new paper.Point(x, y));
    }

    if (c.tr > 0) {
        path.add(new paper.Point(x + w - c.tr, y));
        path.add(new paper.Point(x + w, y + c.tr));
    } else {
        path.add(new paper.Point(x + w, y));
    }

    if (c.br > 0) {
        path.add(new paper.Point(x + w, y + h - c.br));
        path.add(new paper.Point(x + w - c.br, y + h));
    } else {
        path.add(new paper.Point(x + w, y + h));
    }

    if (c.bl > 0) {
        path.add(new paper.Point(x + c.bl, y + h));
        path.add(new paper.Point(x, y + h - c.bl));
    } else {
        path.add(new paper.Point(x, y + h));
    }

    return path;
}

function createIrregularPath(outline, fillColor) {
    const path = new paper.Path({
        fillColor: fillColor,
        strokeColor: '#1a1a1a',
        strokeWidth: 1.5,
        closed: true,
    });

    for (const point of outline) {
        path.add(new paper.Point(point.x, point.y));
    }

    return path;
}

function createDomePath(bounds, fillColor) {
    const { x, y, w, h } = bounds;
    const path = new paper.Path({
        fillColor: fillColor,
        strokeColor: '#1a1a1a',
        strokeWidth: 1.5,
    });

    const start = new paper.Point(x, y + h);
    const end = new paper.Point(x + w, y + h);
    const through = new paper.Point(x + w / 2, y);

    path.add(start);
    path.arcTo(through, end);
    path.closePath();

    return path;
}

function createSpirePath(bounds, fillColor) {
    const { x, y, w, h } = bounds;
    const path = new paper.Path({
        fillColor: fillColor,
        strokeColor: '#1a1a1a',
        strokeWidth: 1.5,
        closed: true,
    });

    path.add(new paper.Point(x, y + h));
    path.add(new paper.Point(x + w / 2, y));
    path.add(new paper.Point(x + w, y + h));

    return path;
}
