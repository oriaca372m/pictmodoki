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

export class MovingTool extends PaintToolBase {
	private _lastPos: Position | undefined
	private _mouseMoveHandler: (e: MouseEvent) => void

	constructor(private readonly _app: App) {
		super()
		this._mouseMoveHandler = (e) => this._onScrollContainerMouseMoved({ x: e.x, y: e.y })
	}

	disable(): void {
		this.onMouseUp()
		super.disable()
	}

	onMouseDown(_pos: Position): void {
		this._app.canvasScrollContainerElm.addEventListener('mousemove', this._mouseMoveHandler)
	}

	private _onScrollContainerMouseMoved(pos: Position): void {
		if (this._lastPos !== undefined) {
			const dx = this._lastPos.x - pos.x
			const dy = this._lastPos.y - pos.y
			if (dx === 0 || dy === 0) {
				return
			}

			this._app.canvasScrollContainerElm.scrollBy(dx, dy)
		}

		this._lastPos = pos
	}

	onMouseUp(): void {
		this._app.canvasScrollContainerElm.removeEventListener('mousemove', this._mouseMoveHandler)
		this._lastPos = undefined
	}
}
