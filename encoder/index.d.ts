export interface Size {
	width: number;
	height: number;
}

export class Encoder {
	constructor(path: string, in_size: Size, out_size: Size, framerate: number);
	init(): void;
	addFrame(rgbBuf: Buffer | Uint8Array | ArrayBuffer): void;
	finish(): void;
}
