export interface SliderScaler {
	scale(x: number): number
	rscale(x: number): number
}

export class PenScaler implements SliderScaler {
	#k: number
	#a: number

	// k: min~maxのうち精密に調整したい割合
	// a: 精密調整にバーの全体の何割を使うか
	constructor(k = 0.05, a = 0.4) {
		this.#k = k
		this.#a = a
	}

	scale(x: number): number {
		if (x < this.#k) {
			return (x / this.#k) * this.#a
		} else {
			return ((x - this.#k) / (1 - this.#k)) * (1 - this.#a) + this.#a
		}
	}

	rscale(x: number): number {
		if (x < this.#a) {
			return (x * this.#k) / this.#a
		} else {
			return ((x - this.#a) / (1 - this.#a)) * (1 - this.#k) + this.#k
		}
	}
}

export class PassThroughScaler implements SliderScaler {
	scale(x: number): number {
		return x
	}

	rscale(x: number): number {
		return x
	}
}
