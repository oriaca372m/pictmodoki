export interface Listener<T> {
	(event: T): unknown
}

export class TypedEvent<T> {
	private readonly _listeners = new Set<Listener<T> | Listener<T | void>>()
	private readonly _listenersOncer = new Set<Listener<T>>()

	on(listener: Listener<T>): void
	on(listener: Listener<T>, runOnceImmediately: false): void
	on(listener: Listener<T | void>, runOnceImmediately: true): void
	on(listener: Listener<T> | Listener<T | void>, runOnceImmediately = false): void {
		this._listeners.add(listener)

		if (runOnceImmediately) {
			;(listener as Listener<T | void>)(undefined)
		}
	}

	once(listener: Listener<T>): void {
		this._listenersOncer.add(listener)
	}

	off(listener: Listener<T> | Listener<T | void>): void {
		this._listeners.delete(listener)
	}

	emit(event: T): void {
		this._listeners.forEach((listener) => listener(event))

		this._listenersOncer.forEach((listener) => listener(event))
		this._listenersOncer.clear()
	}
}
