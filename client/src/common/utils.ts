export function unreachable(): never
export function unreachable(_: never): never

export function unreachable(_?: unknown): never {
	throw Error('This must never happen!')
}

export function throwError(error: Error): never {
	throw error
}
