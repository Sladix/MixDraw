// Seeded random number generator (Mulberry32)
export function createRng(seed) {
    return function() {
        let t = seed += 0x6D2B79F5;
        t = Math.imul(t ^ t >>> 15, t | 1);
        t ^= t + Math.imul(t ^ t >>> 7, t | 61);
        return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
}

// Global RNG instance (set by setRng)
let rng = createRng(42);

export function setRng(newRng) {
    rng = newRng;
}

export function getRng() {
    return rng;
}

export function random() {
    return rng();
}

export function pick(arr) {
    return arr[Math.floor(rng() * arr.length)];
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

export function randomRange(min, max) {
    return lerp(min, max, rng());
}

export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 0.99));
}

export function shuffle(arr) {
    const result = [...arr];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(rng() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function chance(probability) {
    return rng() < probability;
}

/**
 * Simple 1D value noise for smooth variation
 */
export function valueNoise(x, frequency = 1) {
    const xi = Math.floor(x * frequency);
    const xf = (x * frequency) - xi;

    // Use RNG state seeded by position
    const hash = (n) => {
        let h = n * 374761393;
        h = (h ^ (h >> 13)) * 1274126177;
        return ((h ^ (h >> 16)) >>> 0) / 4294967296;
    };

    const a = hash(xi);
    const b = hash(xi + 1);

    // Smooth interpolation
    const t = xf * xf * (3 - 2 * xf);
    return lerp(a, b, t);
}

/**
 * Building harmony - creates correlated parameters for aesthetic coherence
 * @param {number} seed - Base seed for the building
 * @returns {object} Harmonious parameter modifiers
 */
export function createBuildingHarmony(seed) {
    const hash = (key) => {
        let h = seed + key * 374761393;
        h = Math.imul(h ^ h >>> 15, h | 1);
        h ^= h + Math.imul(h ^ h >>> 7, h | 61);
        return ((h ^ h >>> 14) >>> 0) / 4294967296;
    };

    // Core character traits (0-1)
    const massiveness = hash(1);     // Thick vs thin
    const verticality = hash(2);      // Tall vs wide
    const complexity = hash(3);       // Simple vs elaborate
    const symmetry = hash(4);         // Symmetric vs asymmetric
    const regularity = hash(5);       // Regular vs chaotic

    return {
        massiveness,
        verticality,
        complexity,
        symmetry,
        regularity,

        // Derived properties
        wingWidth: lerp(0.25, 0.5, massiveness),
        wingHeight: lerp(0.4, 0.8, 1 - verticality),
        towerWidth: lerp(0.12, 0.3, massiveness),
        towerHeight: lerp(0.25, 0.6, verticality),

        // Position variations (use symmetry to control)
        leftBias: symmetry > 0.7 ? 0.5 : lerp(0.3, 0.7, hash(6)),

        // Detail density
        windowDensity: lerp(0.7, 1.3, complexity),
        ornamentLevel: lerp(0.5, 1.5, complexity),
    };
}
