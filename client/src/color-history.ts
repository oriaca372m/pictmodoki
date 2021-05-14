import { HsvColor } from './components/color-picker/color'
import { TypedEvent } from './typed-event'
import lodash from 'lodash'

export class ColorHistory {
	private readonly _history: HsvColor[] = []
	readonly updated = new TypedEvent<void>()
	private readonly _max = 20

	addColor(color: HsvColor): void {
		const idx = this._history.findIndex((x) => lodash.isEqual(x, color))
		let changed = false
		if (idx === -1) {
			this._history.unshift(color)
			changed = true
		} else if (idx !== 0) {
			this._history.splice(idx, 1)
			this._history.unshift(color)
			changed = true
		}

		if (this._max < this._history.length) {
			this._history.splice(this._max)
			changed = true
		}

		if (changed) {
			this.updated.emit()
		}
	}

	get history(): readonly HsvColor[] {
		return this._history
	}
}
