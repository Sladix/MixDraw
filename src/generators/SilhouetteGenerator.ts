import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom } from '../utils/random';

// --- 1. Data Structures & Interfaces ---

/**
 * Defines the physical dimensions of the skeleton.
 * Purely structural, no coordinate data.
 */
interface SkeletonDimensions {
    headSize: number;
    shoulderWidth: number;
    hipWidth: number;

    // Bone Lengths
    torsoLen: number;
    upperArmLen: number;
    foreArmLen: number;
    thighLen: number;
    shinLen: number;
    neckLen: number;
}

/**
 * The calculated coordinates of every joint in the body.
 */
interface JointMap {
    // Anchors
    root: paper.Point; // Usually the midpoint between hips
    neck: paper.Point;
    headCenter: paper.Point;

    // Torso Points
    leftShoulder: paper.Point;
    rightShoulder: paper.Point;
    leftHip: paper.Point;
    rightHip: paper.Point;

    // Limbs
    leftElbow: paper.Point;
    leftHand: paper.Point;
    rightElbow: paper.Point;
    rightHand: paper.Point;

    leftKnee: paper.Point;
    leftFoot: paper.Point;
    rightKnee: paper.Point;
    rightFoot: paper.Point;
}

/**
 * Human-readable pose configuration.
 * Angles are in degrees. 0 = Straight Down (Natural Gravity).
 * Positive = Outward/Forward (context dependent).
 */
interface PoseConfig {
    anchor: 'feet' | 'hips'; // Determines Y-axis alignment

    // NEW: Core skeletal tilts (optional, default 0)
    hipTilt?: number;        // Lateral tilt (degrees) - creates contrapposto
    shoulderTilt?: number;   // Counter-tilt (degrees) - balances hip tilt
    torsoLean?: number;      // Forward/back lean (degrees) from pelvis

    // [UpperAngle, LowerAngle]
    // Arms: 0 = Down. + = Outward (Abduction).
    leftArm: [number, number];
    rightArm: [number, number];

    // Legs: 0 = Straight Down.
    // Thigh: + = Forward/Up (Sitting). - = Back.
    // Shin: + = Back (Kneeling). - = Forward (Kick).
    // Stance: Spread width multiplier (0 to 1)
    leftLeg: [number, number];
    rightLeg: [number, number];
    stanceWidth: number;
}

type PoseType = 'standing_neutral' | 'standing_akimbo' | 'standing_victory' | 'sitting_stool' | 'sitting_floor' | 'sitting_crossed' | 'sitting_kneeling';
type AccessoryType = 'none' | 'suitcase' | 'glasses';
type HatType = 'none' | 'conical' | 'wide-brim' | 'top';

// --- 2. The Generator Class ---

export class SilhouetteGenerator implements Generator {
    type = 'silhouette';
    name = 'Silhouette';
    description = 'Generates geometric human silhouettes with unified vector kinematics';
    tags = ['organic', 'figure', 'silhouette', 'character'];

    // --- Pose Registry (Easy to Extend) ---

    private static readonly POSES: Record<PoseType, PoseConfig> = {
        'standing_neutral': {
            anchor: 'feet',
            stanceWidth: 0.2,
            hipTilt: -5,        // Right hip higher (weight-bearing)
            shoulderTilt: 3,    // Left shoulder compensates (contrapposto)
            torsoLean: 0,
            leftArm:  [5, 5],
            rightArm: [-5, -5],
            leftLeg:  [-5, 2],    // Slightly bent (relaxed)
            rightLeg: [5, 0]      // Straight (weight-bearing)
        },
        'standing_akimbo': {
            anchor: 'feet',
            stanceWidth: 0.4,
            hipTilt: 0,
            shoulderTilt: 0,
            torsoLean: -2,  // Slight forward lean (confident stance)
            leftArm:  [45, -60], // Elbow out, hand in to hip
            rightArm: [-45, 60],
            leftLeg:  [0, 0],
            rightLeg: [0, 0]
        },
        'standing_victory': {
            anchor: 'feet',
            stanceWidth: 0.5,
            hipTilt: 0,
            shoulderTilt: 0,
            torsoLean: 0,
            leftArm:  [150, 160], // Raised high V shape
            rightArm: [-150, -160],
            leftLeg:  [0, 0],
            rightLeg: [0, 0]
        },
        'sitting_stool': {
            anchor: 'hips',
            stanceWidth: 0.2,
            hipTilt: 0,
            shoulderTilt: 0,
            torsoLean: -5,  // Slight forward lean
            leftArm:  [10, 80],   // Resting on lap
            rightArm: [-10, -80],
            leftLeg:  [80, 10],   // Thighs at ~80° (sitting on stool)
            rightLeg: [80, 10]
        },
        'sitting_floor': {
            anchor: 'hips',
            stanceWidth: 0.15,
            hipTilt: 0,
            shoulderTilt: 0,
            torsoLean: -15,     // Forward lean (reaching)
            leftArm:  [15, 45],  // Arms reaching forward/down
            rightArm: [-15, -45],
            leftLeg:  [85, 5],   // Thighs nearly horizontal forward (FIXED: was 0, 0)
            rightLeg: [85, 5]
        },
        'sitting_crossed': {
            anchor: 'hips',
            stanceWidth: 0.4,
            hipTilt: -3,        // Hip tilts when crossing legs
            shoulderTilt: 3,    // Compensating tilt
            torsoLean: -8,      // Relaxed forward lean
            leftArm:  [25, 70],
            rightArm: [-45, 80],
            leftLeg:  [85, -70],   // Left leg crossed over
            rightLeg: [95, -95]    // Right leg more vertical
        },
        'sitting_kneeling': {
            anchor: 'hips',
            stanceWidth: 0.3,
            hipTilt: 0,
            shoulderTilt: 0,
            torsoLean: 5,       // Slight back lean for balance
            leftArm:  [10, 0],  // Arms resting on thighs
            rightArm: [-10, 0],
            leftLeg:  [0, -180],   // Shins folded back completely
            rightLeg: [0, -180]
        }
    };

    generate(t: number, params: Record<string, any>, seed: number): Shape {
        const rng = seededRandom(seed);
        const config = this.resolveParams(params, rng);

        // 1. Calculate Structural Dimensions (Lengths)
        const dimensions = this.calculateSkeletonDimensions(config);

        // 2. Apply Pose (Calculates Coordinates)
        const joints = this.applyPose(dimensions, config.pose, rng);

        // 3. Draw Shapes
        const paths: paper.Path[] = [];

        // Layer order: Rear Limbs -> Torso/Head -> Front Limbs -> Accessories
        // Note: For silhouette, layer order only matters for internal overlapping logic if we separate shapes.
        // We will merge them into a single group.

        paths.push(this.drawTorso(joints, config.exaggeration));
        paths.push(this.drawHead(joints, config.headTilt));
        paths.push(...this.drawLimbs(joints));

        // 4. Accessories
        if (config.hasCloak) paths.push(this.drawCloak(joints));
        if (config.hat !== 'none') paths.push(...this.drawHat(config.hat, joints, rng));
        if (config.hasFlag) paths.push(...this.drawFlag(joints, rng));
        if (config.accessory === 'suitcase') paths.push(...this.drawSuitcase(joints, config.pose));
        if (config.accessory === 'glasses') paths.push(...this.drawGlasses(joints));

        // 5. Directional flip
        if (config.facing === 'left') {
            paths.forEach(p => {
                p.scale(-1, 1);
                p.position.x *= -1;
            });
        }

        // 6. Style & Output
        paths.forEach(p => {
            p.strokeColor = new paper.Color('black');
            p.strokeWidth = 1;
            p.strokeCap = 'round';
            p.strokeJoin = 'round';
        });

        const group = new paper.Group(paths);
        const bounds = group.bounds;
        group.remove();

        // Calculate Anchor Point
        // If standing, anchor is between feet. If sitting, anchor is the crotch/root.
        let anchorPoint = new paper.Point(0, 0);
        if (SilhouetteGenerator.POSES[config.pose as PoseType].anchor === 'hips') {
            anchorPoint = new paper.Point(0, joints.root.y);
        }

        return { paths, bounds, anchor: anchorPoint };
    }

    // --- 3. Core Logic: Kinematics & Anatomy ---

    /**
     * Step 1: Calculate bone lengths based on height and proportions.
     * This establishes the "T-Pose" dimensions.
     */
    private calculateSkeletonDimensions(config: any): SkeletonDimensions {
        const h = config.height;
        const headSize = h / 8; // Classic 8-head proportion

        // Exaggeration logic
        const ex = config.exaggeration;
        const shoulderMult = 1 + (ex * 0.5); // Wider shoulders
        const legMult = 1 + (ex * 0.2); // Longer legs

        const legTotal = (h * config.legLengthRatio) * legMult;

        return {
            headSize,
            neckLen: headSize * 0.3,
            shoulderWidth: (headSize * config.shoulderWidthRatio) * shoulderMult,
            hipWidth: headSize * config.hipWidthRatio,

            torsoLen: h - headSize - legTotal, // Remaining height is torso

            // CORRECTED: Standard anatomical proportions (3.5 heads total)
            upperArmLen: headSize * 1.75,  // Was 1.6
            foreArmLen: headSize * 1.75,   // Was 1.4

            thighLen: legTotal * 0.5,
            shinLen: legTotal * 0.5
        };
    }

    /**
     * Step 2: Calculate actual 2D coordinates by applying angles to dimensions.
     * Now includes hip tilt, shoulder tilt, and torso lean for anatomical realism.
     */
    private applyPose(dim: SkeletonDimensions, poseName: PoseType, rng: () => number): JointMap {
        const pose = SilhouetteGenerator.POSES[poseName];

        // Extract tilt parameters (with defaults for backward compatibility)
        const hipTilt = pose.hipTilt || 0;
        const shoulderTilt = pose.shoulderTilt || 0;
        const torsoLean = pose.torsoLean || 0;

        // Root is temporarily (0,0). We will offset later based on Anchor.
        const root = new paper.Point(0, 0);

        // 1. Torso Construction with Lean (Upwards from Root)
        // Apply torso lean (rotate spine vector)
        const leanRad = torsoLean * Math.PI / 180;
        const spineVector = new paper.Point(
            Math.sin(leanRad) * dim.torsoLen,
            -Math.cos(leanRad) * dim.torsoLen
        );
        const neckBase = root.add(spineVector);

        // Neck and head follow torso lean
        const neck = neckBase.add(new paper.Point(
            Math.sin(leanRad) * dim.neckLen,
            -Math.cos(leanRad) * dim.neckLen
        ));
        const headCenter = neck.add(new paper.Point(
            Math.sin(leanRad) * dim.headSize * 0.5,
            -Math.cos(leanRad) * dim.headSize * 0.5
        ));

        // 2. Apply shoulder tilt (lateral tilt for contrapposto)
        const shoulderTiltRad = shoulderTilt * Math.PI / 180;
        const shoulderOffset = dim.shoulderWidth / 2;
        const leftShoulderTilt = Math.sin(shoulderTiltRad) * shoulderOffset;
        const rightShoulderTilt = -Math.sin(shoulderTiltRad) * shoulderOffset;

        const leftShoulder = neckBase.add(new paper.Point(-shoulderOffset, leftShoulderTilt));
        const rightShoulder = neckBase.add(new paper.Point(shoulderOffset, rightShoulderTilt));

        // 3. Apply hip tilt (creates contrapposto weight shift)
        const hipTiltRad = hipTilt * Math.PI / 180;
        const hipOffset = dim.hipWidth / 2;
        const leftHipTilt = Math.sin(hipTiltRad) * hipOffset;
        const rightHipTilt = -Math.sin(hipTiltRad) * hipOffset;

        const leftHip = root.add(new paper.Point(-hipOffset, leftHipTilt));
        const rightHip = root.add(new paper.Point(hipOffset, rightHipTilt));

        // 2. Limb Kinematics
        // Helper to rotate a bone from a joint
        const resolveLimb = (start: paper.Point, len1: number, ang1: number, len2: number, ang2: number, isLeft: boolean) => {
            // Base vector is straight down (0, length)
            // Left side rotation: Positive = Clockwise (Outward)
            // Right side rotation: Negative = Counter-Clockwise (Outward)
            const angleMod = isLeft ? 1 : 1; // Both use same system, but config handles sign

            const joint1 = start.add(new paper.Point(0, len1).rotate(ang1 * angleMod));
            // The second angle is relative to the first bone's angle (accumulative) or absolute?
            // Let's make it relative to vertical for easier config reading.
            const joint2 = joint1.add(new paper.Point(0, len2).rotate(ang2 * angleMod));
            return [joint1, joint2];
        };

        const [leftElbow, leftHand] = resolveLimb(
            leftShoulder, dim.upperArmLen, pose.leftArm[0], dim.foreArmLen, pose.leftArm[1], true
        );
        const [rightElbow, rightHand] = resolveLimb(
            rightShoulder, dim.upperArmLen, pose.rightArm[0], dim.foreArmLen, pose.rightArm[1], false
        );

        const [leftKnee, leftFoot] = resolveLimb(
            leftHip, dim.thighLen, pose.leftLeg[0] - pose.stanceWidth, dim.shinLen, pose.leftLeg[1] - pose.stanceWidth, true
        );
        const [rightKnee, rightFoot] = resolveLimb(
            rightHip, dim.thighLen, pose.rightLeg[0] + pose.stanceWidth, dim.shinLen, pose.rightLeg[1] + pose.stanceWidth, false
        );

        // 3. Vertical Offset (Anchoring)
        let yOffset = 0;
        if (pose.anchor === 'feet') {
            // Find lowest foot point to align to y=0
            const lowestY = Math.max(leftFoot.y, rightFoot.y);
            yOffset = -lowestY;
        } else {
            // Anchor to hips (Sitting)
            yOffset = 0; // Hips are already at 0 roughly (root)
            // Adjust so root is exactly at 0 if needed, currently root is 0.
        }

        const offset = new paper.Point(0, yOffset);

        // Apply offset to all points
        const map: any = {
            root, neck, headCenter,
            leftShoulder, rightShoulder, leftHip, rightHip,
            leftElbow, leftHand, rightElbow, rightHand,
            leftKnee, leftFoot, rightKnee, rightFoot
        };

        for (const key in map) {
            map[key] = map[key].add(offset);
        }

        return map as JointMap;
    }

    // --- 4. Drawing Logic ---

    private drawTorso(j: JointMap, egg: number): paper.Path {
        // Trapezoid from shoulders to hips
        const path = new paper.Path({
            segments: [j.leftShoulder, j.rightShoulder, j.rightHip, j.leftHip],
            closed: true
        });
        // Smooth it slightly for organic feel
        path.smooth({ type: 'geometric', factor: egg });
        return path;
    }

    private drawHead(j: JointMap, tilt: number): paper.Path {
        const r = j.headCenter.getDistance(j.neck) * 0.8;
        const head = new paper.Path.Circle({
            center: j.headCenter,
            radius: r
        });
        if (Math.abs(tilt) > 1) head.rotate(tilt, j.neck);
        return head;
    }

    private drawLimbs(j: JointMap): paper.Path[] {
        // Arms
        const lArm = new paper.Path({ segments: [j.leftShoulder, j.leftElbow, j.leftHand] });
        const rArm = new paper.Path({ segments: [j.rightShoulder, j.rightElbow, j.rightHand] });

        // Legs
        const lLeg = new paper.Path({ segments: [j.leftHip, j.leftKnee, j.leftFoot] });
        const rLeg = new paper.Path({ segments: [j.rightHip, j.rightKnee, j.rightFoot] });

        return [lArm, rArm, lLeg, rLeg];
    }

    // --- 5. Accessories ---

    private drawFlag(j: JointMap, rng: () => number): paper.Path[] {
        // Attach to highest hand
        const isLeftHigh = j.leftHand.y < j.rightHand.y;
        // Only if significantly higher, else default right
        const useLeft = isLeftHigh && (j.rightHand.y - j.leftHand.y > 10);
        const hand = useLeft ? j.leftHand : j.rightHand;

        const h = j.headCenter.getDistance(j.neck) * 2; // Ref size
        const poleLen = h * 4;

        // Pole
        const pole = new paper.Path.Line(
            hand.add(new paper.Point(0, h * 0.5)),
            hand.add(new paper.Point(0, -poleLen))
        );

        // Wavy Flag
        const flagTop = pole.segments[1].point;
        const width = h * 2.5;
        const height = h * 1.5;
        const flag = new paper.Path();
        flag.add(flagTop);

        const steps = 10;
        const amp = h * 0.2;
        const freq = Math.PI/2 - rng() ;

        // Wave out
        for(let i=1; i<=steps; i++) {
            const x = (i/steps) * width;
            const y = Math.sin(x*freq) * amp;
            const dir = useLeft ? -1 : 1;
            flag.add(flagTop.add(new paper.Point(x*dir, y)));
        }
        // Return
        for(let i=steps; i>=0; i--) {
            const x = (i/steps) * width;
            const y = Math.sin(x*freq + 1) * amp + height;
            const dir = useLeft ? -1 : 1;
            flag.add(flagTop.add(new paper.Point(x*dir, y)));
        }
        flag.closePath();
        flag.smooth();

        return [pole, flag];
    }

    private drawSuitcase(j: JointMap, pose: PoseType): paper.Path[] {
        if (!SilhouetteGenerator.POSES[pose].anchor.includes('feet')) return []; // Standing only

        // Attach to lowest hand
        const useLeft = j.leftHand.y > j.rightHand.y;
        const hand = useLeft ? j.leftHand : j.rightHand;

        const size = j.headCenter.getDistance(j.neck) * 2; // Ref unit

        const handle = new paper.Path.Rectangle({
            point: hand.add(new paper.Point(-size*0.15, 0)),
            size: [size*0.3, size*0.2]
        });

        const box = new paper.Path.Rectangle({
            point: hand.add(new paper.Point(-size*0.6, size*0.2)),
            size: [size*1.2, size*0.9],
            radius: 2
        });

        return [handle, box];
    }

    private drawGlasses(j: JointMap): paper.Path[] {
        const eyeY = j.headCenter.y;
        const r = j.headCenter.getDistance(j.neck) * 0.3;
        const gap = r * 0.5;

        const l = new paper.Path.Circle(new paper.Point(j.headCenter.x - r - gap/2, eyeY), r);
        const rLens = new paper.Path.Circle(new paper.Point(j.headCenter.x + r + gap/2, eyeY), r);
        const bridge = new paper.Path.Line(
            new paper.Point(j.headCenter.x - gap/2, eyeY),
            new paper.Point(j.headCenter.x + gap/2, eyeY)
        );
        return [l, rLens, bridge];
    }

    private drawHat(type: HatType, j: JointMap, rng: () => number): paper.Path[] {
        // FIXED: Hat positioning closer to head (was 0.9, now 0.5)
        const top = j.headCenter.add(new paper.Point(0, -j.headCenter.getDistance(j.neck) * 0.5));
        const w = j.headCenter.getDistance(j.neck) * 2.5;
        const paths: paper.Path[] = [];

        if (type === 'conical') {
            // FIXED: Larger, more visible conical hat
            const p = new paper.Path();
            p.add(top.add(new paper.Point(0, -w*0.8)));      // Peak: was 0.3, now 0.8 (taller)
            p.add(top.add(new paper.Point(-w*0.6, 0)));      // Base: was w/2, now w*0.6 (wider)
            p.add(top.add(new paper.Point(w*0.6, 0)));
            p.closed = true;
            paths.push(p);
        } else if (type === 'wide-brim') {
            // NEW: Wide-brim hat (sun hat / witch hat style)
            const brimWidth = w * 1.4;
            const crownHeight = w * 0.4;

            // Crown (rounded top part)
            const crown = new paper.Path.Rectangle({
                point: top.add(new paper.Point(-w * 0.35, -crownHeight)),
                size: [w * 0.7, crownHeight],
                radius: w * 0.15  // Rounded corners
            });

            // Wide brim (ellipse)
            const brim = new paper.Path.Ellipse({
                center: top,
                size: [brimWidth, w * 0.2]
            });

            paths.push(crown, brim);
        } else if (type === 'top') {
            // Top hat (existing, unchanged)
            const brim = new paper.Path.Line(
                top.add(new paper.Point(-w*0.4, 0)),
                top.add(new paper.Point(w*0.4, 0))
            );
            const cyl = new paper.Path.Rectangle({
                point: top.add(new paper.Point(-w*0.25, -w*0.6)),
                size: [w*0.5, w*0.6]
            });
            paths.push(brim, cyl);
        }
        return paths;
    }

    private drawCloak(j: JointMap): paper.Path {
        // Physics-based draping: cape flows OUTWARD from shoulders (not inward)
        // Widens as it falls due to gravity and momentum
        const shoulderWidth = j.leftShoulder.getDistance(j.rightShoulder);
        const bottomY = Math.max(j.leftFoot.y, j.rightFoot.y, j.root.y) + 10;

        // Cape widens progressively from shoulders to bottom
        const shoulderFlare = shoulderWidth * 0.3;   // Drapes past shoulders
        const bottomFlare = shoulderWidth * 0.8;      // Much wider at bottom

        const path = new paper.Path();
        path.add(j.leftShoulder);

        // Left side: shoulder → bottom (outward curve with proper draping)
        path.cubicCurveTo(
            j.leftShoulder.add(new paper.Point(-shoulderFlare, bottomY * 0.2)),  // Control: flows out
            new paper.Point(j.root.x - bottomFlare, bottomY - 20),               // Control: wide at bottom
            new paper.Point(j.root.x - bottomFlare * 0.5, bottomY)               // End: narrower edge
        );

        // Bottom arc (weighted drape sag)
        path.cubicCurveTo(
            new paper.Point(j.root.x, bottomY + 5),      // Slight sag at center
            new paper.Point(j.root.x, bottomY + 5),
            new paper.Point(j.root.x + bottomFlare * 0.5, bottomY)
        );

        // Right side: bottom → shoulder (mirror of left)
        path.cubicCurveTo(
            new paper.Point(j.root.x + bottomFlare, bottomY - 20),
            j.rightShoulder.add(new paper.Point(shoulderFlare, bottomY * 0.2)),
            j.rightShoulder
        );

        path.closePath();
        return path;
    }

    // --- 6. Helper: Parameter Resolution ---

    private resolveParams(params: Record<string, any>, rng: () => number) {
        const getVal = (key: string, def: number) => {
            const p = params[key];
            if (typeof p === 'number') return p;
            if (p && typeof p.min === 'number') return p.min + rng() * (p.max - p.min);
            return def;
        };

        const pose = params.pose === 'random'
            ? Object.keys(SilhouetteGenerator.POSES)[Math.floor(rng() * Object.keys(SilhouetteGenerator.POSES).length)]
            : params.pose;

        return {
            height: getVal('height', 100),
            shoulderWidthRatio: getVal('shoulderWidth', 1.7),
            hipWidthRatio: getVal('hipWidth', 1.2),
            legLengthRatio: getVal('legLength', 0.5),
            exaggeration: getVal('exaggeration', 0.2),
            headTilt: getVal('headTilt', 0),

            pose: pose as PoseType,
            facing: params.facing === 'random' ? (rng() > 0.52 ? 'left' : 'right') : params.facing,

            hat: params.hat === 'random'
                ? (['none', 'conical', 'wide-brim', 'top'][Math.floor(rng() * 4)])
                : params.hat,

            accessory: params.accessory === 'random'
                ? (['none', 'suitcase', 'glasses'][Math.floor(rng() * 3)])
                : (params.accessory || 'none'),

            hasFlag: typeof params.flag === 'number' ? rng() < params.flag : rng() < 0.2,
            hasCloak: typeof params.cloak === 'number' ? rng() < params.cloak : rng() < 0.2,
        };
    }

    getDefaultParams(): Record<string, any> {
        return {
            height: 100,
            shoulderWidth: 1.7,
            hipWidth: 1.2,
            legLength: 0.5,
            exaggeration: 0.2,
            headTilt: 0,
            pose: 'random',
            facing: 'random',
            hat: 'random',
            accessory: 'random',  // CHANGED: was 'none', now 'random'
            flag: 0.2,
            cloak: 0.15
        };
    }

    getParamDefinitions(): ParamDefinition[] {
        return [
            {
                name: 'height', type: 'minmax', label: 'Height (mm)',
                min: 40, max: 1000, step: 1, defaultValue: 100
            },
            {
                name: 'pose', type: 'select', label: 'Pose',
                options: ['random', ...Object.keys(SilhouetteGenerator.POSES)],
                defaultValue: 'random'
            },
            {
                name: 'accessory', type: 'select', label: 'Accessory',
                options: ['random', 'none', 'suitcase', 'glasses'],  // ADDED: 'random'
                defaultValue: 'random'
            },
            {
                name: 'hat', type: 'select', label: 'Hat',
                options: ['random', 'none', 'conical', 'wide-brim', 'top'],  // ADDED: 'wide-brim'
                defaultValue: 'random'
            },
            {
                name: 'facing', type: 'select', label: 'Facing',
                options: ['random', 'left', 'right'],
                defaultValue: 'random'
            },
            { name: 'shoulderWidth', type: 'minmax', label: 'Shoulders', min: 1.0, max: 2.5, step: 0.1, defaultValue: 1.7 },
            { name: 'hipWidth', type: 'minmax', label: 'Hips', min: 0.8, max: 1.8, step: 0.1, defaultValue: 1.2 },
            { name: 'legLength', type: 'minmax', label: 'Leg Ratio', min: 0.4, max: 0.6, step: 0.01, defaultValue: 0.5 },
            { name: 'exaggeration', type: 'minmax', label: 'Exaggeration', min: 0, max: 1, step: 0.1, defaultValue: 0.2 },
            { name: 'flag', type: 'minmax', label: 'Flag Prob', min: 0, max: 1, step: 0.1, defaultValue: 0.2 },
            { name: 'cloak', type: 'minmax', label: 'Cloak Prob', min: 0, max: 1, step: 0.1, defaultValue: 0.15 },
        ];
    }
}