import { ref, computed, WritableComputedRef } from 'vue'
import lodash from 'lodash'

import { TypedEvent, Listener } from './typed-event'

export class Bindable<T> {
	private _value: T
	private _boundTo: Bindable<T> | undefined
	private _boundListener: Listener<void> | undefined

	valueChanged = new TypedEvent<void>()

	constructor(v: T) {
		this._value = v
	}

	set value(v: T) {
		if (this._boundTo !== undefined) {
			this._boundTo.value = v
			return
		}

		if (lodash.isEqual(this._value, v)) {
			return
		}

		this._value = v
		this.valueChanged.emit()
	}

	get value(): T {
		if (this._boundTo !== undefined) {
			return this._boundTo.value
		}

		return this._value
	}

	bindTo(them: Bindable<T>, useOurValue = false): void {
		this.unbind()

		if (useOurValue) {
			them.value = this._value
		}

		this._boundTo = them
		this._boundListener = () => {
			this.valueChanged.emit()
		}
		them.valueChanged.on(this._boundListener)

		if (!useOurValue && lodash.isEqual(this._value, them.value)) {
			this.valueChanged.emit()
		}
	}

	unbind(): void {
		if (this._boundTo === undefined) {
			return
		}

		this._value = this._boundTo.value
		this._boundTo.valueChanged.off(this._boundListener!)
		this._boundTo = undefined
		this._boundListener = undefined
	}

	toComputed(): WritableComputedRef<T> {
		const updater = ref(0)
		this.valueChanged.on(() => {
			updater.value += 1
		})

		return computed({
			get: () => {
				updater.value
				return this.value
			},
			set: (val) => {
				this.value = lodash.cloneDeep(val)
			},
		})
	}
}
