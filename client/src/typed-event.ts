export interface Listener<T> {
	(event: T): unknown
}

export class TypedEvent<T> {
	private readonly _listeners = new Set<Listener<T>>()
	private readonly _listenersOncer = new Set<Listener<T>>()

	on(listener: Listener<T>): void {
		this._listeners.add(listener)
	}

	once(listener: Listener<T>): void {
		this._listenersOncer.add(listener)
	}

	off(listener: Listener<T>): void {
		this._listeners.delete(listener)
	}

	emit(event: T): void {
		this._listeners.forEach((listener) => listener(event))

		this._listenersOncer.forEach((listener) => listener(event))
		this._listenersOncer.clear()
	}
}
