import { ref, computed, ComputedRef } from 'vue'
import lodash from 'lodash'

import { TypedEvent } from './typed-event'

export class Bindable<T> {
	private _value: T
	valueChanged = new TypedEvent<void>()

	constructor(v: T) {
		this._value = v
	}

	set value(v: T) {
		if (lodash.isEqual(this._value, v)) {
			return
		}

		this._value = v
		this.valueChanged.emit()
	}

	get value(): T {
		return this._value
	}

	toComputed(): ComputedRef<T> {
		const updater = ref(0)
		this.valueChanged.on(() => {
			updater.value += 1
		})

		return computed({
			get: () => {
				updater.value
				return this._value
			},
			set: (val) => {
				this.value = val
			},
		})
	}
}
