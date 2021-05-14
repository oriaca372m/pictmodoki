import lodash from 'lodash'

export interface HsvColor {
	hue: number
	opacity: number
	saturation: number
	value: number
}

export function hsvToRgb(h: number, s: number, v: number): [number, number, number] {
	const i = Math.floor(h * 6)
	const f = h * 6 - i
	const p = v * (1 - s)
	const q = v * (1 - f * s)
	const t = v * (1 - (1 - f) * s)

	let r = 0
	let g = 0
	let b = 0

	switch (i % 6) {
		case 0:
			;(r = v), (g = t), (b = p)
			break
		case 1:
			;(r = q), (g = v), (b = p)
			break
		case 2:
			;(r = p), (g = v), (b = t)
			break
		case 3:
			;(r = p), (g = q), (b = v)
			break
		case 4:
			;(r = t), (g = p), (b = v)
			break
		case 5:
			;(r = v), (g = p), (b = q)
			break
	}

	return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)]
}

export function rgbToHsv(r: number, g: number, b: number): [number, number, number] {
	const max = Math.max(r, g, b)
	const min = Math.min(r, g, b)
	const d = max - min
	const s = max === 0 ? 0 : d / max
	const v = max / 255
	let h = 0

	switch (max) {
		case min:
			h = 0
			break
		case r:
			h = g - b + d * (g < b ? 6 : 0)
			h /= 6 * d
			break
		case g:
			h = b - r + d * 2
			h /= 6 * d
			break
		case b:
			h = r - g + d * 4
			h /= 6 * d
			break
	}

	return [h, s, v]
}

function toBinaryString(v: number): string {
	return v.toString(16).padStart(2, '0')
}

export function toRgbCode(color: HsvColor): string {
	const [r, g, b] = hsvToRgb(color.hue, color.saturation, color.value)

	let a = ''
	if (color.opacity !== 0) {
		a = toBinaryString(255 - Math.floor(color.opacity * 255))
	}
	return `#${toBinaryString(r)}${toBinaryString(g)}${toBinaryString(b)}${a}`
}

export function toHsvColor(color: string | HsvColor): HsvColor {
	if (typeof color === 'string') {
		if (!color.startsWith('#')) {
			throw 'not color'
		}

		const [r, g, b, a] = lodash
			.chunk([...color.substring(1)], 2)
			.map((x) => parseInt(x.join(''), 16))

		if (r === undefined || g === undefined || b === undefined) {
			throw 'not color'
		}

		const [h, s, v] = rgbToHsv(r, g, b)
		return { hue: h, saturation: s, value: v, opacity: a ?? 0 }
	}

	return color
}
