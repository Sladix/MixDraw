import { random, chance, randomRange } from '../utils/random.js';
import { reserveArea } from './windows.js';

/**
 * Draw ornaments for a block - CALLED FIRST to reserve space
 */
export function drawOrnaments(block, style, strokeWidth = 1) {
    const paths = [];

    if (!block.hasOrnaments) return paths;
    if (style.ornamentLevel < 0.1) return paths;

    const { x, y, w, h } = block.bounds;
    const sw = strokeWidth;

    // Rosette (Gothic) - center of body
    if (style.useRosette && block.type === 'body' && chance(style.ornamentLevel)) {
        const rosetteRadius = Math.min(w, h) * 0.12;
        const rosetteCx = x + w / 2;
        const rosetteCy = y + h * 0.25;

        // Reserve area
        reserveArea({
            x: rosetteCx - rosetteRadius - 10,
            y: rosetteCy - rosetteRadius - 10,
            w: rosetteRadius * 2 + 20,
            h: rosetteRadius * 2 + 20,
        });

        paths.push(...drawRosette(rosetteCx, rosetteCy, rosetteRadius, sw));
    }

    // Sunburst (Art Deco) - top center of body
    if (style.useSunburst && block.type === 'body' && chance(style.ornamentLevel)) {
        const sunburstRadius = Math.min(w, h) * 0.1;
        const sunburstCx = x + w / 2;
        const sunburstCy = y + h * 0.15;

        // Reserve area
        reserveArea({
            x: sunburstCx - sunburstRadius - 10,
            y: sunburstCy - sunburstRadius - 10,
            w: sunburstRadius * 2 + 20,
            h: sunburstRadius * 2 + 20,
        });

        paths.push(...drawSunburst(sunburstCx, sunburstCy, sunburstRadius, sw));
    }

    // Pinnacles (Gothic towers)
    if (style.usePinnacles && block.type === 'tower') {
        const pinnacleW = w * 0.15;
        const pinnacleH = pinnacleW * 2;

        // Left pinnacle
        paths.push(...drawPinnacle(x - pinnacleW / 2, y, pinnacleW, pinnacleH, sw));
        // Right pinnacle
        paths.push(...drawPinnacle(x + w - pinnacleW / 2, y, pinnacleW, pinnacleH, sw));
    }

    // Vertical lines (Art Deco)
    if (style.useVerticalLines && (block.type === 'body' || block.type === 'setback')) {
        const lineCount = Math.floor(w / 25);
        for (let i = 1; i < lineCount; i++) {
            if (!chance(style.ornamentLevel)) continue;

            const lineX = x + (w / lineCount) * i;

            // Reserve thin vertical strips
            reserveArea({ x: lineX - 3, y: y + 5, w: 6, h: h - 10 });

            const line = new paper.Path({
                strokeColor: '#1a1a1a',
                strokeWidth: sw * 0.4,
            });
            line.add(new paper.Point(lineX, y + 5));
            line.add(new paper.Point(lineX, y + h - 5));
            paths.push(line);
        }
    }

    // Columns (Baroque base)
    if (style.useColumns && block.type === 'base') {
        const columnCount = Math.max(2, Math.floor(w / 50));
        for (let i = 1; i < columnCount; i++) {
            const colX = x + (w / columnCount) * i;

            // Reserve column area
            reserveArea({ x: colX - 8, y: y, w: 16, h: h });

            paths.push(...drawColumn(colX, y, h, sw));
        }
    }

    // Buttresses (Gothic wings/body)
    if (style.useButtresses && (block.type === 'body' || block.type === 'wing')) {
        const buttressCount = Math.floor(w / 60);
        for (let i = 1; i < buttressCount; i++) {
            if (!chance(0.7)) continue;

            const buttressX = x + (w / buttressCount) * i;

            // Reserve buttress area
            reserveArea({ x: buttressX - 10, y: y + h * 0.5, w: 20, h: h * 0.5 });

            paths.push(...drawButtress(buttressX, y + h, h * 0.4, sw));
        }
    }

    // Antennae (SciFi towers)
    if (style.useAntennae && block.type === 'tower' && chance(0.6)) {
        paths.push(...drawAntenna(x + w / 2, y, h * 0.25, sw));
    }

    // Pediments (Baroque - triangular tops)
    if (style.usePediments && block.type === 'body' && chance(style.ornamentLevel * 0.5)) {
        const pedimentW = w * 0.4;
        const pedimentH = pedimentW * 0.3;
        const pedimentX = x + w / 2 - pedimentW / 2;
        const pedimentY = y - pedimentH;

        // Reserve area
        reserveArea({ x: pedimentX, y: pedimentY, w: pedimentW, h: pedimentH + 5 });

        paths.push(...drawPediment(pedimentX, pedimentY, pedimentW, pedimentH, sw));
    }

    return paths;
}

function drawRosette(cx, cy, radius, strokeWidth) {
    const paths = [];

    // Outer circle
    const outer = new paper.Path.Circle({
        center: [cx, cy],
        radius: radius,
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.6,
    });
    paths.push(outer);

    // Inner circle
    const inner = new paper.Path.Circle({
        center: [cx, cy],
        radius: radius * 0.4,
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.4,
    });
    paths.push(inner);

    // Petals/spokes
    const petalCount = 8;
    for (let i = 0; i < petalCount; i++) {
        const angle = (i / petalCount) * Math.PI * 2;
        const petal = new paper.Path({
            strokeColor: '#1a1a1a',
            strokeWidth: strokeWidth * 0.4,
        });
        petal.add(new paper.Point(
            cx + Math.cos(angle) * radius * 0.4,
            cy + Math.sin(angle) * radius * 0.4
        ));
        petal.add(new paper.Point(
            cx + Math.cos(angle) * radius * 0.9,
            cy + Math.sin(angle) * radius * 0.9
        ));
        paths.push(petal);
    }

    return paths;
}

function drawSunburst(cx, cy, radius, strokeWidth) {
    const paths = [];

    const rayCount = 15;
    for (let i = 0; i < rayCount; i++) {
        const angle = (i / rayCount) * Math.PI - Math.PI / 2;
        // Only upper half (sunburst rises)
        if (Math.sin(angle) > 0.1) continue;

        const length = radius * (0.6 + random() * 0.8);
        const ray = new paper.Path({
            strokeColor: '#1a1a1a',
            strokeWidth: strokeWidth * 0.4,
        });
        ray.add(new paper.Point(cx, cy));
        ray.add(new paper.Point(
            cx + Math.cos(angle) * length,
            cy + Math.sin(angle) * length
        ));
        paths.push(ray);
    }

    // Base arc
    const arc = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    arc.add(new paper.Point(cx - radius * 0.8, cy));
    arc.arcTo(
        new paper.Point(cx, cy - radius * 0.3),
        new paper.Point(cx + radius * 0.8, cy)
    );
    paths.push(arc);

    return paths;
}

function drawPinnacle(x, y, w, h, strokeWidth) {
    const paths = [];

    // Small spire
    const spire = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.6,
        closed: true,
    });
    spire.add(new paper.Point(x, y));
    spire.add(new paper.Point(x + w / 2, y - h));
    spire.add(new paper.Point(x + w, y));

    paths.push(spire);
    return paths;
}

function drawColumn(x, y, h, strokeWidth) {
    const paths = [];
    const colWidth = 8;

    // Column shaft (two lines)
    const left = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    left.add(new paper.Point(x - colWidth / 2, y + 5));
    left.add(new paper.Point(x - colWidth / 2, y + h - 5));

    const right = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    right.add(new paper.Point(x + colWidth / 2, y + 5));
    right.add(new paper.Point(x + colWidth / 2, y + h - 5));

    paths.push(left, right);

    // Capital (top)
    const capital = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    capital.add(new paper.Point(x - colWidth, y + 3));
    capital.add(new paper.Point(x + colWidth, y + 3));
    paths.push(capital);

    // Base
    const base = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    base.add(new paper.Point(x - colWidth, y + h - 3));
    base.add(new paper.Point(x + colWidth, y + h - 3));
    paths.push(base);

    return paths;
}

function drawButtress(x, baseY, height, strokeWidth) {
    const paths = [];
    const width = 15;

    // Flying buttress - angled support
    const buttress = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.6,
    });
    buttress.add(new paper.Point(x - width / 2, baseY));
    buttress.add(new paper.Point(x, baseY - height));
    buttress.add(new paper.Point(x + width / 2, baseY));

    paths.push(buttress);
    return paths;
}

function drawAntenna(x, y, height, strokeWidth) {
    const paths = [];

    // Main shaft
    const shaft = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.5,
    });
    shaft.add(new paper.Point(x, y));
    shaft.add(new paper.Point(x, y - height));
    paths.push(shaft);

    // Cross pieces
    const crossCount = 3;
    for (let i = 0; i < crossCount; i++) {
        const crossY = y - height * (0.3 + i * 0.25);
        const crossW = 8 - i * 2;

        const cross = new paper.Path({
            strokeColor: '#1a1a1a',
            strokeWidth: strokeWidth * 0.4,
        });
        cross.add(new paper.Point(x - crossW, crossY));
        cross.add(new paper.Point(x + crossW, crossY));
        paths.push(cross);
    }

    return paths;
}

function drawPediment(x, y, w, h, strokeWidth) {
    const paths = [];

    // Triangle
    const triangle = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.7,
    });
    triangle.add(new paper.Point(x, y + h));
    triangle.add(new paper.Point(x + w / 2, y));
    triangle.add(new paper.Point(x + w, y + h));
    triangle.closePath();

    paths.push(triangle);

    // Inner detail
    const innerMargin = w * 0.15;
    const innerH = h * 0.6;
    const inner = new paper.Path({
        strokeColor: '#1a1a1a',
        strokeWidth: strokeWidth * 0.4,
    });
    inner.add(new paper.Point(x + innerMargin, y + h));
    inner.add(new paper.Point(x + w / 2, y + h - innerH));
    inner.add(new paper.Point(x + w - innerMargin, y + h));

    paths.push(inner);

    return paths;
}
