import { Position } from 'common'

import { TypedEvent } from './typed-event'
import { PaintApp } from './paint-app'

export interface PointerPosition {
	scrollerPos: Position
	imagePos: Position
}

function getKeyName(e: KeyboardEvent): string {
	return `key-${e.code}`
}

function getButtonName(e: PointerEvent): string {
	return `pointer-${e.button}`
}

export class InputManager {
	pointerPos!: PointerPosition
	lastPointerPos!: PointerPosition

	#buttonPressedState = new Map<string, boolean>()

	constructor(readonly paintApp: PaintApp) {
		window.addEventListener('keydown', (e) => {
			if (e.repeat) {
				return
			}

			this.#pressButton(getKeyName(e))
		})

		window.addEventListener('keyup', (e) => {
			this.#releaseButton(getKeyName(e))
		})

		const scrollerElm = this.paintApp.app.canvasScrollContainerElm
		scrollerElm.addEventListener('pointerdown', (e) => {
			this.#movePointer(this.#createPointerPos(e))
			this.#pressButton(getButtonName(e))
		})

		scrollerElm.addEventListener('pointermove', (e) => {
			for (const coalesced of e.getCoalescedEvents()) {
				this.#movePointer(this.#createPointerPos(coalesced))
			}
		})

		scrollerElm.addEventListener('pointerup', (e) => {
			this.#movePointer(this.#createPointerPos(e))
			this.#releaseButton(getButtonName(e))
		})
	}

	buttonPressed = new TypedEvent<string>()
	buttonReleased = new TypedEvent<string>()
	pointerMoved = new TypedEvent<PointerPosition>()

	isPressed(button: string): boolean {
		return this.#buttonPressedState.get(button) ?? false
	}

	#pressButton(name: string): void {
		if (!this.isPressed(name)) {
			this.#buttonPressedState.set(name, true)
			this.buttonPressed.emit(name)
		}
	}

	#releaseButton(name: string): void {
		if (this.isPressed(name)) {
			this.#buttonPressedState.set(name, false)
			this.buttonReleased.emit(name)
		}
	}

	#movePointer(pos: PointerPosition) {
		this.lastPointerPos = this.pointerPos
		this.pointerPos = pos
		this.pointerMoved.emit(pos)
	}

	#createPointerPos(scrollerEvent: PointerEvent): PointerPosition {
		const scrollerPos = { x: scrollerEvent.x, y: scrollerEvent.y }
		return {
			scrollerPos,
			imagePos: this.scrollerPosToImagePos(scrollerPos),
		}
	}

	scrollerPosToImagePos(e: Position, allowOutOfArea = false) {
		const containerPos = this.scrollerPosToContainerPos(e)
		return this.containerPosToImagePos(containerPos, allowOutOfArea)
	}

	scrollerPosToContainerPos(e: Position): Position {
		const scrollerElm = this.paintApp.app.canvasScrollContainerElm
		return { x: scrollerElm.scrollLeft + e.x, y: scrollerElm.scrollTop + e.y }
	}

	containerPosToImagePos(e: Position, allowOutOfArea = false): Position {
		const state = this.paintApp.state

		// 中央を0とした座標に変換
		const containerElm = this.paintApp.app.canvasContainerElm
		let x = e.x - containerElm.clientWidth / 2
		let y = e.y - containerElm.clientHeight / 2

		// 拡大率に合わせて座標変換
		const scale = state.scale.value / 100
		x /= scale
		y /= scale

		// 角度に応じて座標変換
		const rot = -state.rotation.value * (Math.PI / 180)
		if (rot !== 0) {
			const nx = x * Math.cos(rot) - y * Math.sin(rot)
			const ny = x * Math.sin(rot) + y * Math.cos(rot)
			x = nx
			y = ny
		}

		// キャンバスの左上を0とした座標に変換
		const canvasSize = this.paintApp.drawer.model.size
		x += canvasSize.width / 2
		y += canvasSize.height / 2

		if (allowOutOfArea) {
			return { x, y }
		}

		// はみ出し防止
		x = Math.max(0, Math.min(x, canvasSize.width))
		y = Math.max(0, Math.min(y, canvasSize.height))

		return { x, y }
	}

	imagePosToContainerPos(e: Position): Position {
		const state = this.paintApp.state

		// 中央を0とした座標に変換
		const canvasSize = this.paintApp.drawer.model.size
		let x = e.x - canvasSize.width / 2
		let y = e.y - canvasSize.height / 2

		// 回転
		const rot = state.rotation.value * (Math.PI / 180)
		if (rot !== 0) {
			const nx = x * Math.cos(rot) - y * Math.sin(rot)
			const ny = x * Math.sin(rot) + y * Math.cos(rot)
			x = nx
			y = ny
		}

		// 拡大
		const scale = state.scale.value / 100
		x *= scale
		y *= scale

		// 左上を0とした座標に変換
		const containerElm = this.paintApp.app.canvasContainerElm
		x += containerElm.clientWidth / 2
		y += containerElm.clientHeight / 2

		return { x, y }
	}
}
