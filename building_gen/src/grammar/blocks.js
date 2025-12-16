import { random, chance, randomRange, randomInt, lerp, createBuildingHarmony } from '../utils/random.js';

/**
 * Block types:
 * - building: Root container
 * - body: Main building mass
 * - wing: Side extensions
 * - tower: Vertical projections
 * - setback: Art deco stepped sections
 * - base: Foundation/ground floor
 * - crown: Top section
 * - dome: Curved top
 * - spire: Pointed top
 * - floor: Horizontal division
 * - bay: Vertical division (window column)
 */

// Z-order for rendering (higher = front)
export const Z_ORDER = {
    base: 0,
    wing: 1,
    body: 2,
    setback: 3,
    tower: 4,
    crown: 5,
    dome: 6,
    spire: 7,
};

export function createBlock(type, bounds, options = {}) {
    return {
        type,
        bounds: { ...bounds },
        children: [],
        depth: options.depth || 0,
        zOrder: Z_ORDER[type] || 0,
        chamfer: options.chamfer || { tl: 0, tr: 0, bl: 0, br: 0 },
        side: options.side || null,
        parent: options.parent || null,
        // Flags
        hasWindows: options.hasWindows !== false,
        hasDoor: options.hasDoor || false,
        hasOrnaments: options.hasOrnaments !== false,
        hasHatching: options.hasHatching !== false,
        // Irregular shape (for ruin/brutalist)
        outline: options.outline || null, // Array of {x, y} points, or null for rectangle
        broken: options.broken || false,
    };
}

/**
 * Generate irregular outline for a block (ruin/brutalist style)
 * Returns array of points forming a polygon
 */
export function generateIrregularOutline(bounds, style, blockType) {
    const { x, y, w, h } = bounds;
    const points = [];

    // Decay amount from style
    const decay = style.decay || 0;
    const isRuin = style.silhouette === 'broken';
    const isBrutalist = style.silhouette === 'block' && style.chamferAmount === 0;

    if (!isRuin && !isBrutalist) {
        return null; // Use regular rectangle
    }

    if (isRuin) {
        // Ruin: irregular top edge, possibly missing corners
        const topVariation = h * decay * 0.5;
        const segments = 5 + Math.floor(random() * 4);

        // Bottom left
        points.push({ x: x, y: y + h });

        // Left side (possibly broken)
        if (chance(decay * 0.3)) {
            // Missing bottom-left chunk
            points.push({ x: x + w * 0.1, y: y + h });
            points.push({ x: x + w * 0.1, y: y + h * 0.7 });
            points.push({ x: x, y: y + h * 0.7 });
        }

        // Go up left side with some variation
        const leftSteps = 2 + Math.floor(random() * 2);
        for (let i = leftSteps; i >= 0; i--) {
            const py = y + (h * i / leftSteps) * 0.9;
            const px = x + (random() - 0.5) * w * 0.05 * decay;
            points.push({ x: Math.max(x, px), y: py });
        }

        // Irregular top edge
        for (let i = 0; i <= segments; i++) {
            const t = i / segments;
            const px = x + w * t;
            // More variation in the middle, less at edges
            const edgeFactor = 1 - Math.abs(t - 0.5) * 2;
            const variation = topVariation * edgeFactor * (0.5 + random() * 0.5);
            const py = y + variation;

            // Occasional sharp drop (collapsed section)
            if (i > 0 && i < segments && chance(decay * 0.2)) {
                points.push({ x: px - w * 0.02, y: py + h * 0.1 });
                points.push({ x: px + w * 0.02, y: py + h * 0.1 });
            }

            points.push({ x: px, y: py });
        }

        // Right side going down
        const rightSteps = 2 + Math.floor(random() * 2);
        for (let i = 0; i <= rightSteps; i++) {
            const py = y + (h * i / rightSteps) * 0.9;
            const px = x + w + (random() - 0.5) * w * 0.05 * decay;
            points.push({ x: Math.min(x + w, px), y: py });
        }

        // Bottom right (possibly broken)
        if (chance(decay * 0.3)) {
            points.push({ x: x + w, y: y + h * 0.8 });
            points.push({ x: x + w * 0.9, y: y + h * 0.8 });
            points.push({ x: x + w * 0.9, y: y + h });
        } else {
            points.push({ x: x + w, y: y + h });
        }

    } else if (isBrutalist) {
        // Brutalist: geometric but with stepped/angular variations
        const stepCount = 2 + Math.floor(random() * 3);
        const stepSize = w * 0.05;

        // Bottom left
        points.push({ x: x, y: y + h });

        // Left side with steps
        for (let i = stepCount; i >= 0; i--) {
            const py = y + h * (i / stepCount) * 0.8;
            const indent = (i % 2 === 0) ? 0 : stepSize;
            points.push({ x: x + indent, y: py });
            if (indent > 0 && i > 0) {
                points.push({ x: x + indent, y: py - h * 0.05 });
                points.push({ x: x, y: py - h * 0.05 });
            }
        }

        // Top with angular cutout
        points.push({ x: x, y: y });
        if (chance(0.5)) {
            // Angular top
            points.push({ x: x + w * 0.3, y: y });
            points.push({ x: x + w * 0.35, y: y + h * 0.05 });
            points.push({ x: x + w * 0.65, y: y + h * 0.05 });
            points.push({ x: x + w * 0.7, y: y });
        }
        points.push({ x: x + w, y: y });

        // Right side with steps (mirrored)
        for (let i = 0; i <= stepCount; i++) {
            const py = y + h * (i / stepCount) * 0.8;
            const indent = (i % 2 === 0) ? 0 : stepSize;
            if (indent > 0 && i > 0) {
                points.push({ x: x + w, y: py - h * 0.05 });
                points.push({ x: x + w - indent, y: py - h * 0.05 });
            }
            points.push({ x: x + w - indent, y: py });
        }

        // Bottom right
        points.push({ x: x + w, y: y + h });
    }

    return points;
}

export function getChamfer(style, blockType) {
    const amount = style.chamferAmount * 20;

    switch (blockType) {
        case 'tower':
        case 'setback':
            return { tl: amount, tr: amount, bl: 0, br: 0 };
        case 'body':
            return { tl: amount * 0.5, tr: amount * 0.5, bl: 0, br: 0 };
        default:
            return { tl: 0, tr: 0, bl: 0, br: 0 };
    }
}

/**
 * Determine tower positions based on count and harmony
 * Returns array of { x, baseY, onWing }
 */
function getTowerPositions(count, harmony, bodyX, bodyWidth, bodyY, leftWing, rightWing) {
    const positions = [];
    const centerX = bodyX + bodyWidth / 2;
    const hasWings = leftWing && rightWing;

    if (count === 0) return positions;

    if (count === 1) {
        // Single tower - center or on a wing
        if (hasWings && chance(0.3)) {
            // On a wing (based on asymmetry)
            const wing = harmony.leftBias > 0.5 ? leftWing : rightWing;
            positions.push({
                x: wing.bounds.x + wing.bounds.w / 2,
                baseY: wing.bounds.y,
                onWing: true,
            });
        } else {
            // Center of body
            positions.push({ x: centerX, baseY: bodyY, onWing: false });
        }
    } else if (count === 2) {
        // Two towers - symmetrical on body or wings
        if (hasWings && chance(0.4)) {
            // On wings
            positions.push({
                x: leftWing.bounds.x + leftWing.bounds.w / 2,
                baseY: leftWing.bounds.y,
                onWing: true,
            });
            positions.push({
                x: rightWing.bounds.x + rightWing.bounds.w / 2,
                baseY: rightWing.bounds.y,
                onWing: true,
            });
        } else {
            // On body sides
            const offset = bodyWidth * lerp(0.25, 0.4, harmony.symmetry);
            positions.push({ x: centerX - offset, baseY: bodyY, onWing: false });
            positions.push({ x: centerX + offset, baseY: bodyY, onWing: false });
        }
    } else if (count === 3) {
        // Three towers - center + sides or center + wings
        positions.push({ x: centerX, baseY: bodyY, onWing: false });

        if (hasWings && chance(0.5)) {
            // Center + wings
            positions.push({
                x: leftWing.bounds.x + leftWing.bounds.w / 2,
                baseY: leftWing.bounds.y,
                onWing: true,
            });
            positions.push({
                x: rightWing.bounds.x + rightWing.bounds.w / 2,
                baseY: rightWing.bounds.y,
                onWing: true,
            });
        } else {
            // Center + body sides
            const offset = bodyWidth * 0.35;
            positions.push({ x: centerX - offset, baseY: bodyY, onWing: false });
            positions.push({ x: centerX + offset, baseY: bodyY, onWing: false });
        }
    } else {
        // 4+ towers - mix of positions
        const offset = bodyWidth * 0.3;
        positions.push({ x: centerX - offset, baseY: bodyY, onWing: false });
        positions.push({ x: centerX + offset, baseY: bodyY, onWing: false });

        if (hasWings) {
            positions.push({
                x: leftWing.bounds.x + leftWing.bounds.w / 2,
                baseY: leftWing.bounds.y,
                onWing: true,
            });
            positions.push({
                x: rightWing.bounds.x + rightWing.bounds.w / 2,
                baseY: rightWing.bounds.y,
                onWing: true,
            });
        }
    }

    return positions.slice(0, count);
}

export function createBuilding(bounds, style, seed = 42) {
    const blocks = [];
    const centerX = bounds.x + bounds.w / 2;
    const useIrregular = style.silhouette === 'broken' || (style.decay && style.decay > 0);

    // Create harmony for coherent proportions
    const harmony = createBuildingHarmony(seed);

    // Main body - use harmony for proportions
    const bodyWidthRatio = lerp(0.55, 0.85, harmony.massiveness);
    const bodyHeightRatio = lerp(0.45, 0.7, harmony.verticality);
    const bodyWidth = bounds.w * bodyWidthRatio;
    const bodyHeight = bounds.h * bodyHeightRatio;
    const bodyX = centerX - bodyWidth / 2;
    const bodyY = bounds.y + bounds.h - bodyHeight;

    const bodyBounds = { x: bodyX, y: bodyY, w: bodyWidth, h: bodyHeight };
    const body = createBlock('body', bodyBounds, {
        depth: 1,
        chamfer: getChamfer(style, 'body'),
        outline: useIrregular ? generateIrregularOutline(bodyBounds, style, 'body') : null,
    });
    blocks.push(body);

    // Base (foundation) - always has door
    const baseHeight = bodyHeight * style.baseHeightRatio;
    const base = createBlock('base', {
        x: bodyX,
        y: bodyY + bodyHeight - baseHeight,
        w: bodyWidth,
        h: baseHeight
    }, {
        depth: 2,
        parent: body,
        hasDoor: true,
        hasWindows: false,
    });
    body.children.push(base);
    blocks.push(base);

    // Track wings for tower placement
    let leftWing = null;
    let rightWing = null;

    // Wings - wider range, use harmony
    if (chance(style.wingProbability)) {
        // Wider wings for better balance (0.3 to 0.55 of body width)
        const wingWidthRatio = lerp(0.3, 0.55, harmony.wingWidth);
        const wingHeightRatio = lerp(0.35, 0.75, harmony.wingHeight);
        const wingWidth = bodyWidth * wingWidthRatio;
        const wingHeight = bodyHeight * wingHeightRatio;
        const wingY = bounds.y + bounds.h - wingHeight;

        // Left wing
        const leftWingBounds = { x: bodyX - wingWidth, y: wingY, w: wingWidth, h: wingHeight };
        leftWing = createBlock('wing', leftWingBounds, {
            depth: 1,
            chamfer: getChamfer(style, 'wing'),
            side: 'left',
            outline: useIrregular ? generateIrregularOutline(leftWingBounds, style, 'wing') : null,
        });
        blocks.push(leftWing);

        // Right wing (mirrored)
        const rightWingBounds = { x: bodyX + bodyWidth, y: wingY, w: wingWidth, h: wingHeight };
        rightWing = createBlock('wing', rightWingBounds, {
            depth: 1,
            chamfer: getChamfer(style, 'wing'),
            side: 'right',
            outline: useIrregular ? generateIrregularOutline(rightWingBounds, style, 'wing') : null,
        });
        blocks.push(rightWing);
    }

    // Towers - more varied placement (body center, body sides, or on wings)
    if (chance(style.towerProbability)) {
        const towerCount = randomInt(style.towerCount.min, style.towerCount.max);

        // Determine tower positions based on count and harmony
        const towerPositions = getTowerPositions(towerCount, harmony, bodyX, bodyWidth, bodyY, leftWing, rightWing);

        for (let i = 0; i < towerPositions.length; i++) {
            const pos = towerPositions[i];
            // Tower size varies with harmony - inverse relation to wing width for balance
            const towerWidthRatio = lerp(style.towerWidthRatio.min, style.towerWidthRatio.max, harmony.towerWidth);
            const towerHeightRatio = lerp(style.towerHeightRatio.min, style.towerHeightRatio.max, harmony.towerHeight);

            const towerWidth = bodyWidth * towerWidthRatio;
            const towerHeight = bodyHeight * towerHeightRatio * (pos.onWing ? 0.7 : 1);

            const towerX = pos.x - towerWidth / 2;
            const towerY = pos.baseY - towerHeight;
            const towerBounds = { x: towerX, y: towerY, w: towerWidth, h: towerHeight };

            const tower = createBlock('tower', towerBounds, {
                depth: 1,
                chamfer: getChamfer(style, 'tower'),
                outline: useIrregular ? generateIrregularOutline(towerBounds, style, 'tower') : null,
            });
            blocks.push(tower);

            // Spire on tower
            if (style.useSpires && chance(0.8)) {
                const spire = createSpire(tower.bounds, style);
                if (spire) blocks.push(spire);
            }
        }
    }

    // Setbacks (Art Deco style)
    if (style.setbackLevels > 0) {
        let currentWidth = bodyWidth;
        let currentY = bodyY;

        for (let i = 0; i < style.setbackLevels; i++) {
            const setbackRatio = randomRange(0.7, 0.85);
            const newWidth = currentWidth * setbackRatio;
            const setbackHeight = bodyHeight * randomRange(0.1, 0.2);
            const setbackX = centerX - newWidth / 2;
            const setbackY = currentY - setbackHeight;

            const setback = createBlock('setback', {
                x: setbackX, y: setbackY, w: newWidth, h: setbackHeight
            }, {
                depth: 1,
                chamfer: getChamfer(style, 'setback'),
            });
            blocks.push(setback);

            currentWidth = newWidth;
            currentY = setbackY;
        }

        // Final spire on top setback
        if (style.useSpires && chance(0.6)) {
            const topSetback = blocks[blocks.length - 1];
            const spire = createSpire(topSetback.bounds, style);
            if (spire) blocks.push(spire);
        }
    }

    // Dome (Baroque style)
    if (style.useDome && chance(0.7)) {
        const domeWidth = bodyWidth * randomRange(0.3, 0.5);
        const domeHeight = domeWidth * randomRange(0.4, 0.6);
        const domeX = centerX - domeWidth / 2;
        const domeY = bodyY - domeHeight;

        const dome = createBlock('dome', {
            x: domeX, y: domeY, w: domeWidth, h: domeHeight
        }, {
            depth: 1,
            hasWindows: false,
        });
        blocks.push(dome);
    }

    // Sort blocks by z-order (back to front)
    blocks.sort((a, b) => a.zOrder - b.zOrder);

    return blocks;
}

function createSpire(towerBounds, style) {
    const spireWidth = towerBounds.w;
    const angleRad = (style.spireAngle * Math.PI) / 180;
    const spireHeight = (spireWidth / 2) / Math.tan(angleRad / 2);

    return createBlock('spire', {
        x: towerBounds.x,
        y: towerBounds.y - spireHeight,
        w: spireWidth,
        h: spireHeight,
    }, {
        depth: 2,
        hasWindows: false,
        hasOrnaments: false,
    });
}
