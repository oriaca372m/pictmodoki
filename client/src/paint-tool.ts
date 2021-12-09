import { Position } from 'common'
import { LayerDrawCommand, LayerId } from 'common/dist/image-canvas'

import { AppState } from './app'
import { PaintApp } from './paint-app'
import { InputManager, PointerPosition } from './input-manager'
import { ImageCanvasDrawerWithPreview } from './image-canvas-drawer-with-preview'
import { toRgbCode } from './components/color-picker/color'

export interface PaintTool {
	enable(): void
	disable(): void

	readonly isEnabled: boolean
}

abstract class PaintToolBase implements PaintTool {
	#isEnabled = false

	constructor(readonly paintApp: PaintApp) {}

	enable(): void {
		this.#isEnabled = true
		if (this.buttonPressedHandler !== undefined) {
			this.inputManager.buttonPressed.on(this.buttonPressedHandler)
		}
		if (this.buttonReleasedHandler !== undefined) {
			this.inputManager.buttonReleased.on(this.buttonReleasedHandler)
		}
		if (this.pointerMovedHandler !== undefined) {
			this.inputManager.pointerMoved.on(this.pointerMovedHandler)
		}
	}

	disable(): void {
		this.#isEnabled = false
		if (this.buttonPressedHandler !== undefined) {
			this.inputManager.buttonPressed.off(this.buttonPressedHandler)
		}
		if (this.buttonReleasedHandler !== undefined) {
			this.inputManager.buttonReleased.off(this.buttonReleasedHandler)
		}
		if (this.pointerMovedHandler !== undefined) {
			this.inputManager.pointerMoved.off(this.pointerMovedHandler)
		}
	}

	get isEnabled(): boolean {
		return this.#isEnabled
	}

	protected get inputManager(): InputManager {
		return this.paintApp.inputManager
	}

	protected get state(): AppState {
		return this.paintApp.state
	}

	protected buttonPressedHandler: ((e: string) => void) | undefined
	protected buttonReleasedHandler: ((e: string) => void) | undefined
	protected pointerMovedHandler: ((e: PointerPosition) => void) | undefined
}

abstract class DrawingToolBase extends PaintToolBase {
	protected _pathPositions: Position[] | undefined
	private readonly _imageCanvas: ImageCanvasDrawerWithPreview
	private _targetLayerId: LayerId | undefined

	constructor(paintApp: PaintApp) {
		super(paintApp)
		this._imageCanvas = paintApp.drawer

		this.pointerMovedHandler = (e) => {
			if (this.inputManager.isPressed('pointer-0')) {
				this._startStroke(e.imagePos)
				this.onMouseMoved(e.imagePos)
			} else {
				this.onMouseUp(this.inputManager.pointerPos.imagePos)
			}
		}
	}

	disable(): void {
		this._finishStroke()
		super.disable()
	}

	onMouseMoved(pos: Position): void {
		this._continueStroke(pos)
	}

	onMouseUp(_pos: Position): void {
		this._finishStroke()
	}

	private _startStroke(pos: Position) {
		if (this._pathPositions !== undefined) {
			return
		}

		this._targetLayerId = this.paintApp.layerManager.selectedLayerId
		if (this._targetLayerId === undefined) {
			return
		}

		this._pathPositions = [pos]
		this._imageCanvas.startPreview(this._targetLayerId)
	}

	private _continueStroke({ x, y }: Position) {
		if (this._pathPositions === undefined) {
			return
		}

		const lastPosition = this._pathPositions[this._pathPositions.length - 1]
		if (lastPosition.x === x && lastPosition.y === y) {
			return
		}

		this._pathPositions.push({ x, y })
		this._imageCanvas.drawPreview(this._constructCommand())
		this.paintApp.render()
	}

	protected _finishStroke(): boolean {
		if (this._pathPositions === undefined) {
			return false
		}

		this._imageCanvas.endPreview()
		this.paintApp.render()

		const res = this.paintApp.commandSender.command({
			kind: 'drawLayer',
			layer: this._targetLayerId!,
			drawCommand: this._constructCommand(),
		})

		this._pathPositions = undefined
		return res
	}

	protected abstract _constructCommand(): LayerDrawCommand
}

export class PenTool extends DrawingToolBase {
	protected _constructCommand(): LayerDrawCommand {
		return {
			kind: 'stroke',
			positions: this._pathPositions!,
			color: toRgbCode(this.state.color.value),
			width: this.state.penSize.value,
		}
	}

	protected _finishStroke(): boolean {
		if (super._finishStroke()) {
			this.paintApp.colorHistory.addColor(this.state.color.value)
			return true
		}

		return false
	}
}

export class EraserTool extends DrawingToolBase {
	protected _constructCommand(): LayerDrawCommand {
		return {
			kind: 'erase',
			positions: this._pathPositions!,
			opacity: this.state.color.value.opacity,
			width: this.state.eraserSize.value,
		}
	}
}

interface ZoomState {
	startPos: Position
	startScale: number
}

export class MovingTool extends PaintToolBase {
	#zoomState: ZoomState | undefined

	constructor(paintApp: PaintApp) {
		super(paintApp)
		this.buttonPressedHandler = (e) => {
			console.log('test', e)
			this.onMouseDown()
		}
		this.buttonReleasedHandler = () => {
			this.onMouseUp()
		}
		this.pointerMovedHandler = (e) => {
			this.#onMouseMovedScrollContainer(e.scrollerPos)
		}
	}

	disable(): void {
		this.onMouseUp()
		super.disable()
	}

	onMouseDown(): void {
		if (this.inputManager.isPressed('key-ShiftLeft')) {
			this.#zoomState = {
				startPos: this.inputManager.pointerPos.scrollerPos,
				startScale: this.state.scale.value,
			}
		}
	}

	onMouseUp(): void {
		this.#zoomState = undefined
	}

	#onMouseMovedScrollContainer(pos: Position): void {
		if (!this.inputManager.isPressed('pointer-0')) {
			return
		}

		if (this.#zoomState === undefined) {
			this.#scroll(pos)
		} else {
			this.#zoom(pos)
		}
	}

	#zoom(pos: Position): void {
		const state = this.#zoomState!
		const dy = state.startPos.y - pos.y
		this.state.scale.value = Math.max(1, Math.floor(state.startScale + dy / 2))
	}

	#scroll(pos: Position): void {
		const dx = this.inputManager.lastPointerPos.scrollerPos.x - pos.x
		const dy = this.inputManager.lastPointerPos.scrollerPos.y - pos.y
		if (dx === 0 || dy === 0) {
			return
		}

		this.paintApp.app.canvasScrollContainerElm.scrollBy(dx, dy)
	}
}
