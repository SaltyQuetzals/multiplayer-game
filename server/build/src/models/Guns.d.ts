export declare abstract class Gun {
    readonly fireRateInMillis: number;
    protected readonly damage: number;
    protected readonly clipSize: number;
    protected shotsInClip: number;
    protected canFire: boolean;
    ammoRemaining: number;
    constructor(fireRateInMillis: number, damage: number, clipSize: number, ammoRemaining: number);
    fire(firing?: Function): void;
}
export declare class SixShooter extends Gun {
    constructor(ammoRemaining?: number);
}
