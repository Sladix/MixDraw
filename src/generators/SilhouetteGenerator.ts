import paper from 'paper';
import type { Generator, Shape, ParamDefinition } from '../types';
import { seededRandom } from '../utils/random';

// Joint positions for anatomical structure
interface Joints {
    // Head
    headTop: paper.Point;
    headCenter: paper.Point;
    neck: paper.Point;

    // Upper body
    leftShoulder: paper.Point;
    rightShoulder: paper.Point;
    chest: paper.Point;

    // Arms
    leftElbow: paper.Point;
    rightElbow: paper.Point;
    leftHand: paper.Point;
    rightHand: paper.Point;

    // Core
    waist: paper.Point;
    leftHip: paper.Point;
    rightHip: paper.Point;
    crotch: paper.Point;

    // Legs
    leftKnee: paper.Point;
    rightKnee: paper.Point;
    leftAnkle: paper.Point;
    rightAnkle: paper.Point;
    leftFoot: paper.Point;
    rightFoot: paper.Point;

    // Metadata
    headSize: number; // Used for proportional calculations
}

type PoseType = 'standing_hanging' | 'standing_akimbo' | 'standing_raised' | 'sitting_relaxed' | 'sitting_side';
type FacingDirection = 'left' | 'right';
type HatType = 'none' | 'conical' | 'wide-brim' | 'top' | 'cap' | 'bowler';

export class SilhouetteGenerator implements Generator {
    type = 'silhouette';
    name = 'Silhouette';
    description = 'Generates geometric human silhouettes with varied poses and accessories';
    tags = ['organic', 'figure', 'silhouette', 'character'];

    generate(t: number, params: Record<string, any>, seed: number): Shape {
        const rng = seededRandom(seed);

        // Resolve parameters with RNG variations
        const height = typeof params.height === 'number'
            ? params.height
            : params.height.min + rng() * (params.height.max - params.height.min);

        const shoulderWidthRatio = typeof params.shoulderWidth === 'number'
            ? params.shoulderWidth
            : params.shoulderWidth.min + rng() * (params.shoulderWidth.max - params.shoulderWidth.min);

        const hipWidthRatio = typeof params.hipWidth === 'number'
            ? params.hipWidth
            : params.hipWidth.min + rng() * (params.hipWidth.max - params.hipWidth.min);

        const legLengthRatio = typeof params.legLength === 'number'
            ? params.legLength
            : params.legLength.min + rng() * (params.legLength.max - params.legLength.min);

        const exaggeration = typeof params.exaggeration === 'number'
            ? params.exaggeration
            : params.exaggeration.min + rng() * (params.exaggeration.max - params.exaggeration.min);

        const stance = typeof params.stance === 'number'
            ? params.stance
            : params.stance.min + rng() * (params.stance.max - params.stance.min);

        const headTilt = typeof params.headTilt === 'number'
            ? params.headTilt
            : params.headTilt.min + rng() * (params.headTilt.max - params.headTilt.min);

        const postureVariation = typeof params.postureVariation === 'number'
            ? params.postureVariation
            : params.postureVariation.min + rng() * (params.postureVariation.max - params.postureVariation.min);

        // Resolve pose
        let pose: PoseType = params.pose === 'random'
            ? (['standing_hanging', 'standing_akimbo', 'standing_raised', 'sitting_relaxed', 'sitting_side'] as PoseType[])[Math.floor(rng() * 5)]
            : params.pose;

        // Resolve facing
        const facing: FacingDirection = params.facing === 'random'
            ? (rng() > 0.5 ? 'left' : 'right')
            : params.facing;

        // Resolve hat
        let hat: HatType = params.hat === 'random'
            ? (['none', 'conical', 'wide-brim', 'top', 'cap', 'bowler'] as HatType[])[Math.floor(rng() * 6)]
            : params.hat;

        // Resolve flag and cloak probabilities
        const hasFlag = typeof params.flag === 'number' ? rng() < params.flag : rng() < 0.2;
        const hasCloak = typeof params.cloak === 'number' ? rng() < params.cloak : rng() < 0.2;

        // Calculate joints
        const joints = this.calculateJoints(
            height,
            shoulderWidthRatio,
            hipWidthRatio,
            legLengthRatio,
            exaggeration,
            stance,
            postureVariation,
            pose,
            rng
        );

        // Generate body parts
        const paths: paper.Path[] = [];

        // Body (torso before limbs for layering)
        paths.push(...this.generateTorso(joints, exaggeration));

        // Head
        paths.push(...this.generateHead(joints, headTilt));

        // Arms and legs (pose-dependent)
        paths.push(...this.generateArms(joints, pose));
        paths.push(...this.generateLegs(joints));

        // Accessories
        if (hasCloak) {
            paths.push(...this.generateCloak(joints));
        }

        if (hat !== 'none') {
            paths.push(...this.generateHat(hat, joints, rng));
        }

        if (hasFlag) {
            paths.push(...this.generateFlag(joints, pose, rng));
        }

        

        // add joints for debug
        // joints debug circles
        // for (const key in joints) {
        //     if (Object.prototype.hasOwnProperty.call(joints, key)) {
        //         const point = (joints as any)[key];
        //         if (key === 'headSize') continue;
        //         const circle = new paper.Path.Circle({
        //             center: point,
        //             radius: 10,
        //             strokeColor: new paper.Color('red'),
        //             fillColor: new paper.Color('red')
        //         });
        //         paths.push(circle);
        //     }
        // }

        // Apply facing direction (flip horizontally if facing left)
        if (facing === 'left') {
            paths.forEach(path => {
                path.scale(-1, 1); // Flip around Y-axis
                path.position.x *= -1; // Reposition
            });
        }

        // Set stroke properties (strokeWidth will be overridden by layer)
        paths.forEach(path => {
            path.strokeColor = new paper.Color('black');
            path.strokeWidth = 1;
        });

        // Calculate bounds
        const group = new paper.Group(paths);
        const bounds = group.bounds;
        group.remove();

        // Anchor depends on pose
        const anchor = pose.startsWith('sitting')
            ? new paper.Point(0, joints.crotch.y) // Seat point for sitting
            : new paper.Point(0, 0); // Feet for standing

        return { paths, bounds, anchor };
    }

    /**
     * Calculate all joint positions using 8-heads-tall proportion system
     */
    private calculateJoints(
        height: number,
        shoulderWidthRatio: number,
        hipWidthRatio: number,
        legLengthRatio: number,
        exaggeration: number,
        stance: number,
        postureVariation: number,
        pose: PoseType,
        rng: () => number
    ): Joints {
        // Base proportions (8 heads tall)
        const headSize = height / 8;

        // Apply exaggeration to proportions
        const exagShoulderMult = 1 + exaggeration * 0.4; // Up to 40% wider
        const exagHipMult = 1 - exaggeration * 0.2; // Up to 20% narrower
        const exagLegMult = 1 + exaggeration * 0.15; // Up to 15% longer

        const shoulderWidth = headSize * shoulderWidthRatio * exagShoulderMult;
        const hipWidth = headSize * hipWidthRatio * exagHipMult;

        // Helper function to add small random variations
        const vary = (value: number) => value * (1 + (rng() - 0.5) * 2 * postureVariation);

        // Standing pose (origin at feet, Y-axis up)
        if (pose.startsWith('standing')) {
            const legLength = height * legLengthRatio * exagLegMult;
            const torsoLength = height - headSize - legLength;

            return {
                // Head
                headTop: new paper.Point(0, -height),
                headCenter: new paper.Point(0, -height + headSize * 0.5),
                neck: new paper.Point(0, -height + headSize),

                // Upper body
                leftShoulder: new paper.Point(vary(-shoulderWidth / 2), vary(-height + headSize * 1.2)),
                rightShoulder: new paper.Point(vary(shoulderWidth / 2), vary(-height + headSize * 1.2)),
                chest: new paper.Point(0, -height + headSize * 1.5),

                // Arms (will be positioned by pose)
                leftElbow: new paper.Point(0, 0), // Placeholder
                rightElbow: new paper.Point(0, 0),
                leftHand: new paper.Point(0, 0),
                rightHand: new paper.Point(0, 0),

                // Core
                waist: new paper.Point(0, vary(-legLength - torsoLength * 0.5)),
                leftHip: new paper.Point(vary(-hipWidth / 2), vary(-legLength)),
                rightHip: new paper.Point(vary(hipWidth / 2), vary(-legLength)),
                crotch: new paper.Point(0, -legLength),

                // Legs
                leftKnee: new paper.Point(vary(-stance * headSize / 2), vary(-legLength * 0.5)),
                rightKnee: new paper.Point(vary(stance * headSize / 2), vary(-legLength * 0.5)),
                leftAnkle: new paper.Point(vary(-stance * headSize / 2), vary(-headSize * 0.2)),
                rightAnkle: new paper.Point(vary(stance * headSize / 2), vary(-headSize * 0.2)),
                leftFoot: new paper.Point(vary(-stance * headSize / 2), 0),
                rightFoot: new paper.Point(vary(stance * headSize / 2), 0),

                headSize
            };
        } else {
            // Sitting pose (origin at seat point)
            const sittingHeight = height * 0.65; // Sitting figures are shorter
            const torsoLength = sittingHeight * 0.5;
            const legLength = height * legLengthRatio * exagLegMult;

            let joints =  {
                // Head
                headTop: new paper.Point(0, -sittingHeight),
                headCenter: new paper.Point(0, -sittingHeight + headSize * 0.5),
                neck: new paper.Point(0, -sittingHeight + headSize),

                // Upper body
                leftShoulder: new paper.Point(vary(-shoulderWidth / 2), vary(-sittingHeight + headSize * 1.3)),
                rightShoulder: new paper.Point(vary(shoulderWidth / 2), vary(-sittingHeight + headSize * 1.3)),
                chest: new paper.Point(0, -sittingHeight + headSize * 1.6),

                // Arms (will be positioned by pose)
                leftElbow: new paper.Point(0, 0),
                rightElbow: new paper.Point(0, 0),
                leftHand: new paper.Point(0, 0),
                rightHand: new paper.Point(0, 0),

                // Core
                waist: new paper.Point(0, vary(-torsoLength * 0.6)),
                leftHip: new paper.Point(vary(-hipWidth / 2), vary(0)),
                rightHip: new paper.Point(vary(hipWidth / 2), vary(0)),
                crotch: new paper.Point(0, 0), // Seat point

                leftKnee: new paper.Point(vary(-stance * headSize / 2), vary(-legLength * 0.5)),
                rightKnee: new paper.Point(vary(stance * headSize / 2), vary(-legLength * 0.5)),
                leftAnkle: new paper.Point(vary(-stance * headSize / 2), vary(-headSize * 0.2)),
                rightAnkle: new paper.Point(vary(stance * headSize / 2), vary(-headSize * 0.2)),
                leftFoot: new paper.Point(vary(-stance * headSize / 2), 0),
                rightFoot: new paper.Point(vary(stance * headSize / 2), 0),

                headSize
            };

            

            if (pose.startsWith('sitting')) {
                // For sitting poses, adjust leg as it the crotch is the anchor point is on the ground, so legs up, knees at waist height and feet forward
                joints.leftKnee = new paper.Point(joints.leftHip.x * 2, joints.waist.y);
                joints.leftAnkle = new paper.Point(joints.leftHip.x * 4, joints.crotch.y);
                joints.leftFoot = new paper.Point(joints.leftHip.x * 4.5, joints.crotch.y);

                joints.rightKnee = new paper.Point(joints.rightKnee.x, joints.waist.y);
                joints.rightAnkle = new paper.Point(joints.leftHip.x *2, joints.crotch.y);
                joints.rightFoot = new paper.Point(joints.leftHip.x*2.5, joints.crotch.y);
                
            }

            return joints;
        }
    }

    /**
     * Generate head (circle with optional tilt)
     */
    private generateHead(joints: Joints, headTilt: number): paper.Path[] {
        const head = new paper.Path.Circle({
            center: joints.headCenter,
            radius: joints.headSize * 0.5
        });

        // Apply head tilt
        if (Math.abs(headTilt) > 0.1) {
            head.rotate(headTilt, joints.neck);
        }

        return [head];
    }

    /**
     * Generate torso (geometric trapezoid)
     */
    private generateTorso(joints: Joints, exaggeration: number): paper.Path[] {
        const torso = new paper.Path();

        // Shoulders to hips trapezoid
        torso.add(joints.leftShoulder);
        torso.add(joints.rightShoulder);
        torso.add(joints.rightHip);
        torso.add(joints.leftHip);
        torso.closePath();

        // Optional: slight smoothing for less angular look
        if (exaggeration < 0.5) {
            torso.smooth({ type: 'geometric', factor: 0.2 });
        }

        return [torso];
    }

    /**
     * Generate arms based on pose
     */
    private generateArms(joints: Joints, pose: PoseType): paper.Path[] {
        const paths: paper.Path[] = [];

        // Calculate arm joint positions based on pose
        let leftElbow: paper.Point, rightElbow: paper.Point;
        let leftHand: paper.Point, rightHand: paper.Point;

        const shoulderToElbow = joints.headSize * 1.5;
        const elbowToHand = joints.headSize * 1.5;

        switch (pose) {
            case 'standing_hanging':
                // Arms hanging at sides
                leftElbow = joints.leftShoulder.add(new paper.Point(-joints.headSize * 0.2, shoulderToElbow * 0.7));
                rightElbow = joints.rightShoulder.add(new paper.Point(joints.headSize * 0.2, shoulderToElbow * 0.7));
                leftHand = leftElbow.add(new paper.Point(0, elbowToHand));
                rightHand = rightElbow.add(new paper.Point(0, elbowToHand));
                break;

            case 'standing_akimbo':
                // Hands on hips
                leftElbow = joints.leftShoulder.add(new paper.Point(-joints.headSize * 0.8, shoulderToElbow * 0.6));
                rightElbow = joints.rightShoulder.add(new paper.Point(joints.headSize * 0.8, shoulderToElbow * 0.6));
                leftHand = joints.leftHip.add(new paper.Point(-joints.headSize * 0.2, 0));
                rightHand = joints.rightHip.add(new paper.Point(joints.headSize * 0.2, 0));
                break;

            case 'standing_raised':
                // One arm raised, one hanging
                leftElbow = joints.leftShoulder.add(new paper.Point(-joints.headSize * 0.5, -shoulderToElbow * 0.7));
                leftHand = leftElbow.add(new paper.Point(-joints.headSize * 0.3, -elbowToHand * 0.8));
                rightElbow = joints.rightShoulder.add(new paper.Point(joints.headSize * 0.2, shoulderToElbow * 0.7));
                rightHand = rightElbow.add(new paper.Point(0, elbowToHand));
                break;

            case 'sitting_relaxed':
                // Arms resting on knees
                leftElbow = joints.leftShoulder.add(new paper.Point(-joints.headSize * 0.3, shoulderToElbow));
                rightElbow = joints.rightShoulder.add(new paper.Point(joints.headSize * 0.3, shoulderToElbow));
                leftHand = joints.leftKnee.add(new paper.Point(-joints.headSize * 0.2, 0));
                rightHand = joints.rightKnee.add(new paper.Point(joints.headSize * 0.2, 0));
                break;

            case 'sitting_side':
                // Profile view, arms at sides
                leftElbow = joints.leftShoulder.add(new paper.Point(joints.headSize * 0.3, shoulderToElbow * 0.6));
                rightElbow = joints.rightShoulder.add(new paper.Point(joints.headSize * 0.5, shoulderToElbow * 0.6));
                leftHand = leftElbow.add(new paper.Point(0, elbowToHand * 0.8));
                rightHand = rightElbow.add(new paper.Point(0, elbowToHand * 0.8));
                break;
        }

        // Draw arms as polylines (shoulder -> elbow -> hand)
        const leftArm = new paper.Path([joints.leftShoulder, leftElbow, leftHand]);
        const rightArm = new paper.Path([joints.rightShoulder, rightElbow, rightHand]);

        paths.push(leftArm, rightArm);

        return paths;
    }

    /**
     * Generate legs based on pose
     */
    private generateLegs(joints: Joints): paper.Path[] {
        const paths: paper.Path[] = [];

        // Draw legs as polylines (hip -> knee -> ankle -> foot)
        let leftLeg = new paper.Path([
            joints.leftHip,
            joints.leftKnee,
            joints.leftAnkle,
            joints.leftFoot
        ]);

        let rightLeg = new paper.Path([
            joints.rightHip,
            joints.rightKnee,
            joints.rightAnkle,
            joints.rightFoot
        ]);
        paths.push(leftLeg, rightLeg);

        return paths;
    }

    /**
     * Generate hat accessory
     */
    private generateHat(type: HatType, joints: Joints, rng: () => number): paper.Path[] {
        const paths: paper.Path[] = [];
        const hatScale = 0.9 + rng() * 0.2; // 0.9-1.1x variation

        switch (type) {
            case 'conical': {
                // Chinese rice farmer hat - wide cone
                const coneWidth = joints.headSize * 2.5 * hatScale;
                const coneHeight = joints.headSize * 0.8 * hatScale;
                const cone = new paper.Path([
                    new paper.Point(0, joints.headTop.y - coneHeight), // Peak
                    new paper.Point(-coneWidth / 2, joints.headTop.y), // Left brim
                    new paper.Point(coneWidth / 2, joints.headTop.y) // Right brim
                ]);
                cone.closePath();
                paths.push(cone);
                break;
            }

            case 'wide-brim': {
                // Sun hat - circle crown + wide brim
                const crownRadius = joints.headSize * 0.4 * hatScale;
                const brimWidth = joints.headSize * 1.5 * hatScale;
                const brimY = joints.headTop.y + joints.headSize * 0.1;

                // Crown
                const crown = new paper.Path.Circle({
                    center: new paper.Point(0, joints.headTop.y - crownRadius),
                    radius: crownRadius
                });

                // Brim (ellipse)
                const brim = new paper.Path.Ellipse({
                    center: new paper.Point(0, brimY),
                    size: [brimWidth, joints.headSize * 0.3 * hatScale]
                });

                paths.push(crown, brim);
                break;
            }

            case 'top': {
                // Top hat - tall cylinder
                const hatWidth = joints.headSize * 0.6 * hatScale;
                const hatHeight = joints.headSize * 1.2 * hatScale;
                const topHat = new paper.Path.Rectangle({
                    point: new paper.Point(-hatWidth / 2, joints.headTop.y - hatHeight),
                    size: [hatWidth, hatHeight]
                });

                // Brim
                const brimWidth = joints.headSize * 0.8 * hatScale;
                const brim = new paper.Path.Rectangle({
                    point: new paper.Point(-brimWidth / 2, joints.headTop.y - joints.headSize * 0.1),
                    size: [brimWidth, joints.headSize * 0.15]
                });

                paths.push(topHat, brim);
                break;
            }

            case 'cap': {
                // Baseball cap - forward-facing semi-circle + visor
                const capRadius = joints.headSize * 0.45 * hatScale;
                const visorLength = joints.headSize * 0.6 * hatScale;

                // Cap dome (arc)
                const cap = new paper.Path.Arc({
                    from: new paper.Point(-capRadius, joints.headTop.y),
                    through: new paper.Point(0, joints.headTop.y - capRadius),
                    to: new paper.Point(capRadius, joints.headTop.y)
                });

                // Visor
                const visor = new paper.Path([
                    new paper.Point(-capRadius * 0.5, joints.headTop.y),
                    new paper.Point(visorLength, joints.headTop.y + capRadius * 0.2),
                    new paper.Point(visorLength, joints.headTop.y + capRadius * 0.3),
                    new paper.Point(-capRadius * 0.5, joints.headTop.y + capRadius * 0.1)
                ]);
                visor.closePath();

                paths.push(cap, visor);
                break;
            }

            case 'bowler': {
                // Bowler hat - rounded dome + small brim
                const bowlerRadius = joints.headSize * 0.5 * hatScale;
                const brimWidth = joints.headSize * 0.9 * hatScale;

                // Dome (circle)
                const dome = new paper.Path.Circle({
                    center: new paper.Point(0, joints.headTop.y - bowlerRadius * 0.5),
                    radius: bowlerRadius
                });

                // Brim (ellipse)
                const brim = new paper.Path.Ellipse({
                    center: new paper.Point(0, joints.headTop.y),
                    size: [brimWidth, joints.headSize * 0.2 * hatScale]
                });

                paths.push(dome, brim);
                break;
            }
        }

        return paths;
    }

    /**
     * Generate flag accessory (held in hand)
     */
    private generateFlag(joints: Joints, pose: PoseType, rng: () => number): paper.Path[] {
        const paths: paper.Path[] = [];

        // Determine which hand holds the flag (prefer raised hand)
        let handPos: paper.Point;

        if (pose === 'standing_raised') {
            // Left hand is raised, use that
            handPos = joints.leftShoulder.add(new paper.Point(-joints.headSize * 0.8, -joints.headSize * 2.5));
        } else {
            // Default to right hand
            handPos = joints.rightShoulder.add(new paper.Point(joints.headSize * 0.5, joints.headSize * 0.5));
        }

        const poleHeight = joints.headSize * 3;
        const flagWidth = joints.headSize * 1.2;
        const flagHeight = joints.headSize * 0.8;

        // Pole (vertical line)
        const pole = new paper.Path([
            handPos,
            handPos.add(new paper.Point(0, -poleHeight))
        ]);

        // Flag (triangle or rectangle, fluttering)
        const flagTop = handPos.add(new paper.Point(0, -poleHeight));
        const flutter = rng() * joints.headSize * 0.3; // Random flutter

        const flag = new paper.Path([
            flagTop,
            flagTop.add(new paper.Point(flagWidth + flutter, flagHeight * 0.25)),
            flagTop.add(new paper.Point(flagWidth - flutter, flagHeight * 0.75)),
            flagTop.add(new paper.Point(0, flagHeight))
        ]);
        flag.closePath();

        paths.push(pole, flag);

        return paths;
    }

    /**
     * Generate cloak accessory (flowing from shoulders)
     */
    private generateCloak(joints: Joints): paper.Path[] {
        const paths: paper.Path[] = [];

        // Cloak flows from shoulders to near feet/seat
        const cloakBottom = joints.crotch.y * 0.8; // 80% down
        const cloakWidth = joints.headSize * 2;

        // Smooth curve from left shoulder, around back, to right shoulder
        const cloak = new paper.Path();
        cloak.add(joints.leftShoulder);

        // Control points for flowing curve
        const midY = (joints.leftShoulder.y + cloakBottom) / 2;
        cloak.add(new paper.Point(-cloakWidth / 2, midY));
        cloak.add(new paper.Point(-cloakWidth / 3, cloakBottom));
        cloak.add(new paper.Point(0, cloakBottom + joints.headSize * 0.2));
        cloak.add(new paper.Point(cloakWidth / 3, cloakBottom));
        cloak.add(new paper.Point(cloakWidth / 2, midY));
        cloak.add(joints.rightShoulder);

        cloak.smooth({ type: 'continuous' });

        paths.push(cloak);

        return paths;
    }

    getDefaultParams(): Record<string, any> {
        return {
            height: 100,
            shoulderWidth: 1.7,
            hipWidth: 1.2,
            legLength: 0.5,
            exaggeration: 0.2,
            stance: 0.15,
            headTilt: 0,
            postureVariation: 0.05,
            pose: 'random',
            facing: 'random',
            hat: 'random',
            flag: 0.2,
            cloak: 0.15
        };
    }

    getParamDefinitions(): ParamDefinition[] {
        return [
            // Size
            {
                name: 'height',
                type: 'minmax',
                label: 'Height (mm)',
                min: 40,
                max: 600,
                step: 1,
                defaultValue: 100,
                description: 'Total height of the silhouette'
            },

            // Proportions
            {
                name: 'shoulderWidth',
                type: 'minmax',
                label: 'Shoulder Width',
                min: 1.2,
                max: 2.2,
                step: 0.1,
                defaultValue: 1.7,
                description: 'Shoulder width in head widths (1.2=narrow, 2.2=broad)'
            },
            {
                name: 'hipWidth',
                type: 'minmax',
                label: 'Hip Width',
                min: 0.8,
                max: 1.6,
                step: 0.1,
                defaultValue: 1.2,
                description: 'Hip width in head widths'
            },
            {
                name: 'legLength',
                type: 'minmax',
                label: 'Leg Length Ratio',
                min: 0.45,
                max: 0.55,
                step: 0.01,
                defaultValue: 0.5,
                description: 'Leg length as ratio of total height'
            },

            // Style
            {
                name: 'exaggeration',
                type: 'minmax',
                label: 'Exaggeration',
                min: 0,
                max: 1,
                step: 0.1,
                defaultValue: 0.2,
                description: '0=realistic, 1=heroic proportions'
            },
            {
                name: 'stance',
                type: 'minmax',
                label: 'Stance Width',
                min: 0,
                max: 0.4,
                step: 0.05,
                defaultValue: 0.15,
                description: 'Leg spread for standing poses (in head widths)'
            },
            {
                name: 'headTilt',
                type: 'minmax',
                label: 'Head Tilt (degrees)',
                min: -20,
                max: 20,
                step: 1,
                defaultValue: 0,
                description: 'Head tilt angle'
            },
            {
                name: 'postureVariation',
                type: 'minmax',
                label: 'Posture Variation',
                min: 0,
                max: 0.15,
                step: 0.01,
                defaultValue: 0.05,
                description: 'Random variation in joint positions'
            },

            // Pose & Orientation
            {
                name: 'pose',
                type: 'select',
                label: 'Pose',
                options: ['random', 'standing_hanging', 'standing_akimbo', 'standing_raised', 'sitting_relaxed', 'sitting_side'],
                defaultValue: 'random',
                description: 'Character pose'
            },
            {
                name: 'facing',
                type: 'select',
                label: 'Facing Direction',
                options: ['random', 'left', 'right'],
                defaultValue: 'random',
                description: 'Which direction the figure faces'
            },

            // Accessories
            {
                name: 'hat',
                type: 'select',
                label: 'Hat Type',
                options: ['random', 'none', 'conical', 'wide-brim', 'top', 'cap', 'bowler'],
                defaultValue: 'random',
                description: 'Hat accessory type'
            },
            {
                name: 'flag',
                type: 'minmax',
                label: 'Flag Probability',
                min: 0,
                max: 1,
                step: 0.1,
                defaultValue: 0.2,
                description: 'Probability of flag accessory (0=never, 1=always)'
            },
            {
                name: 'cloak',
                type: 'minmax',
                label: 'Cloak Probability',
                min: 0,
                max: 1,
                step: 0.1,
                defaultValue: 0.15,
                description: 'Probability of cloak accessory'
            }
        ];
    }
}
