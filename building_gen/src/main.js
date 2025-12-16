import { createRng, setRng, random } from './utils/random.js';
import { getStyle, STYLES } from './styles/presets.js';
import { createBuilding, Z_ORDER } from './grammar/blocks.js';
import { getBlockEdges, filterEdges, edgesToPaths, blockToFilledPath } from './render/edges.js';
import { drawWindows, drawDoors, clearReservedAreas } from './render/windows.js';
import { drawOrnaments } from './render/ornaments.js';
import { hatchArea, hatchTriangle, hatchDome, hatchPolygon } from './render/hatching.js';

export { STYLES };

const FORMATS = {
    'a4': { w: 595, h: 842 },
    'a4-landscape': { w: 842, h: 595 },
    'a3': { w: 842, h: 1190 },
    'square': { w: 700, h: 700 },
};

export function getFormat(name) {
    return FORMATS[name] || FORMATS['a4'];
}

/**
 * Main generation function
 */
export function generate(params) {
    const {
        seed = 42,
        format = 'a4',
        margin = 40,
        style: styleName = 'gothic',
        character = 0.5,
        strokeWidth = 1.5,
        showWindows = true,
        showOrnaments = true,
        showDoors = true,
        hatching = false,
        hatchDensity = 4,
        hatchSide = 'left',
        hatchAngle = 45,
        hatchStyle = 'diagonal',
        useFills = true,
        // Expert params
        expertMode = false,
        towerProbability,
        towerCount,
        wingProbability,
        setbackLevels,
        aspectRatio,
        baseHeightRatio,
        windowDensity = 1.0,
        ornamentLevel = 1.0,
        chamferAmount,
        decay,
    } = params;

    // Reset RNG
    const rng = createRng(seed);
    setRng(rng);

    // Clear reserved areas from previous generation
    clearReservedAreas();

    // Get canvas size
    const canvasSize = getFormat(format);

    // Get style with character applied
    let style = getStyle(styleName, character);

    // Apply expert overrides
    if (expertMode) {
        style = {
            ...style,
            towerProbability: towerProbability ?? style.towerProbability,
            towerCount: { min: 0, max: towerCount ?? style.towerCount.max },
            wingProbability: wingProbability ?? style.wingProbability,
            setbackLevels: setbackLevels ?? style.setbackLevels,
            aspectRatio: aspectRatio ?? style.aspectRatio,
            baseHeightRatio: baseHeightRatio ?? style.baseHeightRatio,
            chamferAmount: chamferAmount ?? style.chamferAmount,
            decay: decay ?? style.decay,
            windowDensityX: Math.round(style.windowDensityX * windowDensity),
            windowDensityY: Math.round(style.windowDensityY * windowDensity),
            ornamentLevel: style.ornamentLevel * ornamentLevel,
        };
    }

    // Calculate drawing bounds
    const bounds = {
        x: margin,
        y: margin,
        w: canvasSize.w - margin * 2,
        h: canvasSize.h - margin * 2,
    };

    // Adjust for aspect ratio
    const targetAspect = style.aspectRatio;
    const currentAspect = bounds.w / bounds.h;

    if (currentAspect > targetAspect) {
        const newW = bounds.h * targetAspect;
        bounds.x += (bounds.w - newW) / 2;
        bounds.w = newW;
    }

    // Generate building structure
    const blocks = createBuilding(bounds, style, seed);

    // Sort by z-order (back to front)
    blocks.sort((a, b) => a.zOrder - b.zOrder);

    // Render everything
    const allPaths = [];

    const renderOptions = {
        strokeWidth,
        showWindows,
        showOrnaments,
        showDoors,
        hatching,
        hatchDensity,
        hatchSide,
        hatchAngle,
        hatchStyle,
    };

    if (useFills) {
        // Strategy 1: White fills for occlusion (simpler, cleaner)
        allPaths.push(...renderWithFills(blocks, style, renderOptions));
    } else {
        // Strategy 2: Edge filtering (pure line art)
        allPaths.push(...renderEdgesOnly(blocks, style, renderOptions));
    }

    return {
        paths: allPaths,
        blocks,
        canvasSize,
    };
}

/**
 * Render with white fills for occlusion handling
 * Two-pass rendering: ALL fills first, then ALL details
 */
function renderWithFills(blocks, style, options) {
    const {
        strokeWidth, showWindows, showOrnaments, showDoors,
        hatching, hatchDensity, hatchSide, hatchAngle, hatchStyle
    } = options;
    const paths = [];

    // PASS 1: All fills (back to front) - establishes occlusion
    for (const block of blocks) {
        const filledPath = blockToFilledPath(block, 'white');
        paths.push(filledPath);
    }

    // PASS 2: All details (back to front) - drawn ON TOP of all fills
    for (const block of blocks) {
        // Hatching
        if (hatching && block.hasHatching) {
            const hatchPaths = renderBlockHatching(block, style, {
                density: hatchDensity,
                side: hatchSide,
                angle: hatchAngle,
                style: hatchStyle,
                strokeWidth: strokeWidth * 0.3,
            });
            paths.push(...hatchPaths);
        }

        // Ornaments FIRST (reserve space)
        if (showOrnaments && block.hasOrnaments) {
            const ornamentPaths = drawOrnaments(block, style, strokeWidth);
            paths.push(...ornamentPaths);
        }

        // Doors (for base blocks)
        if (showDoors && block.hasDoor) {
            const doorPaths = drawDoors(block, style, strokeWidth);
            paths.push(...doorPaths);
        }

        // Windows LAST (avoid reserved areas)
        if (showWindows && block.hasWindows) {
            const windowPaths = drawWindows(block, style, strokeWidth);
            paths.push(...windowPaths);
        }
    }

    return paths;
}

/**
 * Render with edge filtering (pure line art, no fills)
 */
function renderEdgesOnly(blocks, style, options) {
    const {
        strokeWidth, showWindows, showOrnaments, showDoors,
        hatching, hatchDensity, hatchSide, hatchAngle, hatchStyle
    } = options;
    const paths = [];

    // Collect all edges
    const allEdges = [];
    for (const block of blocks) {
        allEdges.push(...getBlockEdges(block));
    }

    // Filter to external edges only
    const externalEdges = filterEdges(allEdges, blocks);

    // Convert to paths
    paths.push(...edgesToPaths(externalEdges, strokeWidth));

    // Special shapes (domes, spires) - drawn separately
    for (const block of blocks) {
        if (block.type === 'dome') {
            const domePath = drawDomePath(block.bounds, strokeWidth);
            paths.push(domePath);
        }
        if (block.type === 'spire') {
            const spirePaths = drawSpirePaths(block.bounds, strokeWidth);
            paths.push(...spirePaths);
        }
    }

    // Details
    for (const block of blocks) {
        if (hatching && block.hasHatching) {
            const hatchPaths = renderBlockHatching(block, style, {
                density: hatchDensity,
                side: hatchSide,
                angle: hatchAngle,
                style: hatchStyle,
                strokeWidth: strokeWidth * 0.3,
            });
            paths.push(...hatchPaths);
        }

        if (showOrnaments && block.hasOrnaments) {
            paths.push(...drawOrnaments(block, style, strokeWidth));
        }

        if (showDoors && block.hasDoor) {
            paths.push(...drawDoors(block, style, strokeWidth));
        }

        if (showWindows && block.hasWindows) {
            paths.push(...drawWindows(block, style, strokeWidth));
        }
    }

    return paths;
}

/**
 * Render hatching for a block based on its type
 */
function renderBlockHatching(block, stylePreset, options = {}) {
    const {
        density = 4,
        side = 'left',
        angle = 45,
        style: hatchStyle = stylePreset.hatchStyle || 'diagonal',
        strokeWidth = 0.5,
    } = options;

    const paths = [];

    if (block.type === 'spire') {
        const { x, y, w, h } = block.bounds;
        paths.push(...hatchTriangle(
            x, y + h,          // bottom left
            x + w / 2, y,      // top center
            x + w, y + h,      // bottom right
            {
                style: hatchStyle,
                density,
                angle,
                strokeWidth,
            }
        ));
    } else if (block.type === 'dome') {
        const { x, y, w, h } = block.bounds;
        paths.push(...hatchDome(
            x + w / 2, y + h, w, h,
            {
                style: hatchStyle,
                density,
                angle,
                strokeWidth,
            }
        ));
    } else if (block.outline && block.outline.length > 2) {
        // Irregular shape - use polygon hatching
        paths.push(...hatchPolygon(block.outline, {
            style: hatchStyle,
            density,
            angle,
            strokeWidth,
        }));
    } else {
        paths.push(...hatchArea(block.bounds, {
            style: hatchStyle,
            density,
            angle,
            side,
            coverage: 0.3,
            strokeWidth,
        }));
    }

    return paths;
}

function drawDomePath(bounds, strokeWidth) {
    const { x, y, w, h } = bounds;
    const path = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });

    const start = new paper.Point(x, y + h);
    const end = new paper.Point(x + w, y + h);
    const through = new paper.Point(x + w / 2, y);

    path.add(start);
    path.arcTo(through, end);

    return path;
}

function drawSpirePaths(bounds, strokeWidth) {
    const { x, y, w, h } = bounds;
    const paths = [];

    const left = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });
    left.add(new paper.Point(x, y + h));
    left.add(new paper.Point(x + w / 2, y));

    const right = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth,
    });
    right.add(new paper.Point(x + w / 2, y));
    right.add(new paper.Point(x + w, y + h));

    paths.push(left, right);
    return paths;
}

/**
 * Export to SVG
 */
export function exportSVG() {
    return paper.project.exportSVG({ asString: true });
}
