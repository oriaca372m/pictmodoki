export function unreachable(): never
export function unreachable(_: never): never

export function unreachable(_?: unknown): never {
	throw Error('This must never happen!')
}

export function throwError(error: Error): never {
	throw error
}

export function isSetsEqual<T>(a: Set<T>, b: Set<T>): boolean {
	if (a.size !== b.size) {
		return false
	}

	for (const v of a) {
		if (!b.has(v)) {
			return false
		}
	}

	return true
}
