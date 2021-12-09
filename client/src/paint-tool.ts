import { Position } from 'common'
import { LayerDrawCommand, LayerId } from 'common/dist/image-canvas'

import { App } from './app'
import { PaintApp } from './paint-app'
import { ImageCanvasDrawerWithPreview } from './image-canvas-drawer-with-preview'
import { toRgbCode } from './components/color-picker/color'

export interface PaintTool {
	enable(): void
	disable(): void

	onMouseMoved(pos: Position): void
	onMouseDown(pos: Position): void
	onMouseUp(pos: Position): void

	onKeyDown(e: KeyboardEvent): void
	onKeyUp(e: KeyboardEvent): void

	readonly isEnabled: boolean
}

abstract class PaintToolBase implements PaintTool {
	private _isEnabled = false

	enable(): void {
		this._isEnabled = true
	}

	disable(): void {
		this._isEnabled = false
	}

	get isEnabled(): boolean {
		return this._isEnabled
	}

	onMouseDown(_pos: Position): void {
		// pass
	}
	onMouseMoved(_pos: Position): void {
		// pass
	}
	onMouseUp(_pos: Position): void {
		// pass
	}

	onKeyDown(_e: KeyboardEvent): void {
		// pass
	}
	onKeyUp(_e: KeyboardEvent): void {
		// pass
	}
}

abstract class DrawingToolBase extends PaintToolBase {
	protected _pathPositions: Position[] | undefined
	private readonly _imageCanvas: ImageCanvasDrawerWithPreview
	private _targetLayerId: LayerId | undefined

	constructor(protected readonly _app: PaintApp) {
		super()
		this._imageCanvas = _app.drawer
	}

	disable(): void {
		this._finishStroke()
		super.disable()
	}

	onMouseDown(pos: Position): void {
		this._startStroke(pos)
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

		this._targetLayerId = this._app.layerManager.selectedLayerId
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
		this._app.render()
	}

	protected _finishStroke(): boolean {
		if (this._pathPositions === undefined) {
			return false
		}

		this._imageCanvas.endPreview()
		this._app.render()

		const res = this._app.commandSender.command({
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
			color: toRgbCode(this._app.state.color.value),
			width: this._app.state.penSize.value,
		}
	}

	protected _finishStroke(): boolean {
		if (super._finishStroke()) {
			this._app.colorHistory.addColor(this._app.state.color.value)
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
			opacity: this._app.state.color.value.opacity,
			width: this._app.state.eraserSize.value,
		}
	}
}

interface ZoomState {
	startPos: Position
	startScale: number
}

export class MovingTool extends PaintToolBase {
	#zoomState: ZoomState | undefined
	#lastPos: Position | undefined
	private _mouseMoveHandler: (e: MouseEvent) => void
	#isMouseDown = false
	#shouldZoom = false

	constructor(private readonly _app: App) {
		super()
		this._mouseMoveHandler = (e) => {
			this.#onMouseMovedScrollContainer({ x: e.x, y: e.y })
		}
	}

	enable(): void {
		this._app.canvasScrollContainerElm.addEventListener('mousemove', this._mouseMoveHandler)
		super.enable()
	}

	disable(): void {
		this._app.canvasScrollContainerElm.removeEventListener('mousemove', this._mouseMoveHandler)
		this.onMouseUp()
		this.#shouldZoom = false
		super.disable()
	}

	onMouseDown(): void {
		this.#isMouseDown = true
		if (this.#shouldZoom) {
			this.#zoomState = {
				startPos: this.#lastPos!,
				startScale: this._app.state.scale.value,
			}
		}
	}

	onMouseUp(): void {
		this.#isMouseDown = false
		this.#zoomState = undefined
	}

	#onMouseMovedScrollContainer(pos: Position): void {
		try {
			if (!this.#isMouseDown || this.#lastPos === undefined) {
				return
			}

			if (this.#zoomState === undefined) {
				this.#scroll(pos)
			} else {
				this.#zoom(pos)
			}
		} finally {
			this.#lastPos = pos
		}
	}

	onKeyDown(e: KeyboardEvent) {
		if (e.repeat) {
			return
		}

		if (e.code === 'ShiftLeft') {
			this.#shouldZoom = true
		}
	}

	onKeyUp(e: KeyboardEvent) {
		if (e.code === 'ShiftLeft') {
			this.#shouldZoom = false
			this.#zoomState = undefined
		}
	}

	#zoom(pos: Position): void {
		const state = this.#zoomState!
		const dy = state.startPos.y - pos.y
		this._app.state.scale.value = Math.max(1, Math.floor(state.startScale + dy / 2))
	}

	#scroll(pos: Position): void {
		const dx = this.#lastPos!.x - pos.x
		const dy = this.#lastPos!.y - pos.y
		if (dx === 0 || dy === 0) {
			return
		}

		this._app.canvasScrollContainerElm.scrollBy(dx, dy)
	}
}
