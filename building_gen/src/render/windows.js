import { random, chance, randomRange } from '../utils/random.js';
import { rectsOverlap } from '../utils/geometry.js';

/**
 * Reserved areas tracking - ornaments reserve space first, then windows fill the rest
 */
let reservedAreas = [];

export function clearReservedAreas() {
    reservedAreas = [];
}

export function reserveArea(bounds) {
    reservedAreas.push(bounds);
}

export function isAreaFree(bounds, padding = 5) {
    const padded = {
        x: bounds.x - padding,
        y: bounds.y - padding,
        w: bounds.w + padding * 2,
        h: bounds.h + padding * 2,
    };

    for (const reserved of reservedAreas) {
        if (rectsOverlap(padded, reserved)) {
            return false;
        }
    }
    return true;
}

/**
 * Draw all windows for a block
 */
export function drawWindows(block, style, strokeWidth = 1) {
    const paths = [];

    if (!block.hasWindows) return paths;

    const { x, y, w, h } = block.bounds;

    // Skip if block is too small
    if (w < 30 || h < 40) return paths;

    const margin = 10;
    const innerX = x + margin;
    const innerY = y + margin;
    const innerW = w - margin * 2;
    const innerH = h - margin * 2;

    // Adjust density based on block type
    let densityX = style.windowDensityX;
    let densityY = style.windowDensityY;

    if (block.type === 'tower') {
        densityX = Math.max(2, Math.floor(densityX * 0.5));
    }
    if (block.type === 'wing') {
        densityX = Math.max(2, Math.floor(densityX * 0.6));
        densityY = Math.max(3, Math.floor(densityY * 0.7));
    }
    if (block.type === 'setback') {
        densityY = Math.max(2, Math.floor(densityY * 0.4));
    }

    const cellW = innerW / densityX;
    const cellH = innerH / densityY;
    const windowW = cellW * 0.6 * style.windowAspect;
    const windowH = cellH * 0.7;

    for (let row = 0; row < densityY; row++) {
        for (let col = 0; col < densityX; col++) {
            // Random skip for variety
            if (chance(0.15)) continue;

            // Decay for ruin style
            if (style.decay && chance(style.decay)) continue;

            const cx = innerX + cellW * (col + 0.5);
            const cy = innerY + cellH * (row + 0.5);

            // Check if area is free (not reserved by ornaments)
            const windowBounds = {
                x: cx - windowW / 2,
                y: cy - windowH / 2,
                w: windowW,
                h: windowH,
            };

            if (!isAreaFree(windowBounds)) continue;

            const windowPath = drawWindow(cx, cy, windowW, windowH, style.windowStyle, strokeWidth);
            if (windowPath) paths.push(...windowPath);
        }
    }

    return paths;
}

/**
 * Draw a single window
 */
export function drawWindow(cx, cy, w, h, windowStyle, strokeWidth = 1) {
    const paths = [];
    const x = cx - w / 2;
    const y = cy - h / 2;
    const sw = strokeWidth * 0.7;

    switch (windowStyle) {
        case 'arch': {
            // Gothic pointed arch
            const archPath = new paper.Path({
                strokeColor: '#1a1a1a',
                strokeWidth: sw,
            });
            const archHeight = h * 0.3;

            archPath.add(new paper.Point(x, y + h));
            archPath.add(new paper.Point(x, y + archHeight));
            archPath.add(new paper.Point(cx, y));
            archPath.add(new paper.Point(x + w, y + archHeight));
            archPath.add(new paper.Point(x + w, y + h));

            paths.push(archPath);
            break;
        }

        case 'grid': {
            // Simple rectangle with optional dividers
            const rect = new paper.Path.Rectangle({
                point: [x, y],
                size: [w, h],
                strokeColor: '#1a1a1a',
                strokeWidth: sw,
            });
            paths.push(rect);

            // Cross dividers
            if (chance(0.5)) {
                const vLine = new paper.Path({
                    strokeColor: '#1a1a1a',
                    strokeWidth: sw * 0.6,
                });
                vLine.add(new paper.Point(cx, y));
                vLine.add(new paper.Point(cx, y + h));
                paths.push(vLine);
            }

            if (chance(0.3)) {
                const hLine = new paper.Path({
                    strokeColor: '#1a1a1a',
                    strokeWidth: sw * 0.6,
                });
                hLine.add(new paper.Point(x, cy));
                hLine.add(new paper.Point(x + w, cy));
                paths.push(hLine);
            }
            break;
        }

        case 'slit': {
            // Narrow vertical slit
            const slitW = w * 0.4;
            const slitPath = new paper.Path.Rectangle({
                point: [cx - slitW / 2, y],
                size: [slitW, h],
                strokeColor: '#1a1a1a',
                strokeWidth: sw,
            });
            paths.push(slitPath);
            break;
        }

        case 'broken': {
            // Partial/damaged window
            if (chance(0.3)) return paths; // Empty

            const rect = new paper.Path({
                strokeColor: '#1a1a1a',
                strokeWidth: sw,
            });

            const corners = [
                [x, y + h], [x, y], [x + w, y], [x + w, y + h]
            ];

            let started = false;
            for (let i = 0; i < corners.length; i++) {
                if (chance(0.7)) {
                    if (!started) {
                        rect.add(new paper.Point(corners[i]));
                        started = true;
                    } else {
                        rect.add(new paper.Point(corners[i]));
                    }
                } else if (started) {
                    // Break the path, start a new one
                    if (rect.segments.length > 1) paths.push(rect);
                    started = false;
                }
            }

            if (started && rect.segments.length > 1) paths.push(rect);
            break;
        }

        case 'round': {
            // Round-top window (Baroque)
            const archHeight = h * 0.25;
            const archPath = new paper.Path({
                strokeColor: '#1a1a1a',
                strokeWidth: sw,
            });

            archPath.add(new paper.Point(x, y + h));
            archPath.add(new paper.Point(x, y + archHeight));
            archPath.arcTo(
                new paper.Point(cx, y),
                new paper.Point(x + w, y + archHeight)
            );
            archPath.add(new paper.Point(x + w, y + h));

            paths.push(archPath);
            break;
        }

        default: {
            // Simple rectangle
            const rect = new paper.Path.Rectangle({
                point: [x, y],
                size: [w, h],
                strokeColor: '#1a1a1a',
                strokeWidth: sw,
            });
            paths.push(rect);
        }
    }

    return paths;
}

/**
 * Draw doors for a block (typically the base)
 */
export function drawDoors(block, style, strokeWidth = 1) {
    const paths = [];

    if (!block.hasDoor) return paths;

    const { x, y, w, h } = block.bounds;
    const sw = strokeWidth;

    // Calculate door size
    const doorW = Math.min(w * 0.15, 30);
    const doorH = h * 0.85;

    // Number of doors based on width
    const doorCount = w > 200 ? 3 : w > 100 ? 1 : 1;
    const spacing = w / (doorCount + 1);

    for (let i = 0; i < doorCount; i++) {
        const doorX = x + spacing * (i + 1) - doorW / 2;
        const doorY = y + h - doorH;

        // Reserve this area
        reserveArea({ x: doorX - 5, y: doorY - 5, w: doorW + 10, h: doorH + 10 });

        // Draw door based on style
        const doorPaths = drawDoor(doorX, doorY, doorW, doorH, style, sw);
        paths.push(...doorPaths);
    }

    return paths;
}

function drawDoor(x, y, w, h, style, strokeWidth) {
    const paths = [];
    const cx = x + w / 2;

    // Determine door style based on building style
    const isGothic = style.windowStyle === 'arch';
    const isBaroque = style.useDome || style.useColumns;
    const isModern = style.windowStyle === 'grid' || style.windowStyle === 'slit';

    if (isGothic) {
        // Gothic: pointed arch door (ogive)
        paths.push(...drawGothicDoor(x, y, w, h, strokeWidth));
    } else if (isBaroque) {
        // Baroque: rounded arch with ornate frame
        paths.push(...drawBaroqueDoor(x, y, w, h, strokeWidth));
    } else if (isModern) {
        // Modern: clean rectangular with glass panels
        paths.push(...drawModernDoor(x, y, w, h, strokeWidth));
    } else {
        // Default: simple arched door
        paths.push(...drawSimpleArchDoor(x, y, w, h, strokeWidth));
    }

    // Steps (for all styles except modern)
    if (!isModern) {
        const stepCount = 3;
        const stepHeight = 2.5;
        for (let i = 0; i < stepCount; i++) {
            const stepY = y + h + i * stepHeight;
            const stepW = w * (1 + 0.15 * (i + 1));
            const stepX = cx - stepW / 2;

            const step = new paper.Path({
                strokeColor: '#1a1a1a',
                strokeWidth: strokeWidth * 0.5,
            });
            step.add(new paper.Point(stepX, stepY));
            step.add(new paper.Point(stepX + stepW, stepY));
            paths.push(step);
        }
    }

    return paths;
}

function drawGothicDoor(x, y, w, h, strokeWidth) {
    const paths = [];
    const cx = x + w / 2;

    // Gothic pointed arch (ogive) - two arcs meeting at a point
    const archStartY = y + h * 0.4; // Where the arch begins
    const peakY = y; // Top of the arch

    const outerPath = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });

    // Left side up
    outerPath.add(new paper.Point(x, y + h));
    outerPath.add(new paper.Point(x, archStartY));

    // Left arc curving to peak (control point creates the ogive shape)
    outerPath.cubicCurveTo(
        new paper.Point(x, archStartY - h * 0.25),
        new paper.Point(cx - w * 0.1, peakY + h * 0.05),
        new paper.Point(cx, peakY)
    );

    // Right arc from peak down
    outerPath.cubicCurveTo(
        new paper.Point(cx + w * 0.1, peakY + h * 0.05),
        new paper.Point(x + w, archStartY - h * 0.25),
        new paper.Point(x + w, archStartY)
    );

    // Right side down
    outerPath.add(new paper.Point(x + w, y + h));

    paths.push(outerPath);

    // Inner arch (decorative)
    const margin = w * 0.12;
    const innerPath = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });

    innerPath.add(new paper.Point(x + margin, y + h));
    innerPath.add(new paper.Point(x + margin, archStartY + margin));
    innerPath.cubicCurveTo(
        new paper.Point(x + margin, archStartY - h * 0.2),
        new paper.Point(cx - w * 0.05, peakY + h * 0.1),
        new paper.Point(cx, peakY + margin * 1.5)
    );
    innerPath.cubicCurveTo(
        new paper.Point(cx + w * 0.05, peakY + h * 0.1),
        new paper.Point(x + w - margin, archStartY - h * 0.2),
        new paper.Point(x + w - margin, archStartY + margin)
    );
    innerPath.add(new paper.Point(x + w - margin, y + h));

    paths.push(innerPath);

    return paths;
}

function drawBaroqueDoor(x, y, w, h, strokeWidth) {
    const paths = [];
    const cx = x + w / 2;

    // Baroque: semi-circular arch
    const archRadius = w / 2;
    const archStartY = y + archRadius;

    const outerPath = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });

    // Left side up
    outerPath.add(new paper.Point(x, y + h));
    outerPath.add(new paper.Point(x, archStartY));

    // Semi-circular arch
    outerPath.arcTo(
        new paper.Point(cx, y),
        new paper.Point(x + w, archStartY)
    );

    // Right side down
    outerPath.add(new paper.Point(x + w, y + h));

    paths.push(outerPath);

    // Decorative keystone
    const keystoneW = w * 0.15;
    const keystoneH = archRadius * 0.3;
    const keystone = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.6,
    });
    keystone.add(new paper.Point(cx - keystoneW / 2, y + keystoneH));
    keystone.add(new paper.Point(cx - keystoneW * 0.3, y));
    keystone.add(new paper.Point(cx + keystoneW * 0.3, y));
    keystone.add(new paper.Point(cx + keystoneW / 2, y + keystoneH));
    paths.push(keystone);

    // Inner frame
    const margin = w * 0.1;
    const innerPath = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    innerPath.add(new paper.Point(x + margin, y + h));
    innerPath.add(new paper.Point(x + margin, archStartY));
    innerPath.arcTo(
        new paper.Point(cx, y + margin),
        new paper.Point(x + w - margin, archStartY)
    );
    innerPath.add(new paper.Point(x + w - margin, y + h));
    paths.push(innerPath);

    // Door panels (double door)
    const divider = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    divider.add(new paper.Point(cx, archStartY));
    divider.add(new paper.Point(cx, y + h));
    paths.push(divider);

    return paths;
}

function drawModernDoor(x, y, w, h, strokeWidth) {
    const paths = [];
    const cx = x + w / 2;

    // Main frame
    const rect = new paper.Path.Rectangle({
        point: [x, y],
        size: [w, h],
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });
    paths.push(rect);

    // Glass panels (grid pattern)
    const cols = 2;
    const rows = 3;
    const panelMargin = w * 0.08;
    const panelW = (w - panelMargin * 3) / cols;
    const panelH = (h - panelMargin * (rows + 1)) / rows;

    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            const px = x + panelMargin + col * (panelW + panelMargin);
            const py = y + panelMargin + row * (panelH + panelMargin);

            const panel = new paper.Path.Rectangle({
                point: [px, py],
                size: [panelW, panelH],
                strokeColor: '#1a1a1a',
                strokeWidth: strokeWidth * 0.4,
            });
            paths.push(panel);
        }
    }

    // Door handle
    const handleY = y + h * 0.55;
    const handle = new paper.Path.Circle({
        center: [x + w * 0.8, handleY],
        radius: w * 0.05,
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    paths.push(handle);

    return paths;
}

function drawSimpleArchDoor(x, y, w, h, strokeWidth) {
    const paths = [];
    const cx = x + w / 2;

    // Simple rounded arch
    const archHeight = h * 0.25;

    const outerPath = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });

    outerPath.add(new paper.Point(x, y + h));
    outerPath.add(new paper.Point(x, y + archHeight));
    outerPath.arcTo(
        new paper.Point(cx, y),
        new paper.Point(x + w, y + archHeight)
    );
    outerPath.add(new paper.Point(x + w, y + h));

    paths.push(outerPath);

    // Simple center divider
    const divider = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    divider.add(new paper.Point(cx, y + archHeight * 0.8));
    divider.add(new paper.Point(cx, y + h));
    paths.push(divider);

    return paths;
}
