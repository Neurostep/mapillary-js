import {IPotentialEdge} from "../../src/Edge";

export class EdgeCalculatorHelper {
    public createPotentialEdge(key: string = "pkey"): IPotentialEdge {
        return {
            distance: 0,
            motionChange: 0,
            verticalMotion: 0,
            directionChange: 0,
            verticalDirectionChange: 0,
            rotation: 0,
            worldMotionAzimuth: 0,
            sameSequence: false,
            sameMergeCc: false,
            fullPano: false,
            apiNavImIm: { key: key }
        };
    }
}

export default EdgeCalculatorHelper;