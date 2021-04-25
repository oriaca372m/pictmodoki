import { LayerDrawCommand, Position, Color, LayerId } from 'common'

import { App } from './app'
import { PaintApp } from './paint-app'
import { ImageCanvasDrawerWithPreview } from './image-canvas-drawer-with-preview'

export interface PaintTool {
	enable(): void
	disable(): void

	onMouseMoved(pos: Position): void
	onMouseDown(pos: Position): void
	onMouseUp(pos: Position): void

	readonly isEnabled: boolean
}

export class PenTool implements PaintTool {
	private _pathPositions: Position[] | undefined
	color: Color = '#ff0000'
	width = 10
	private readonly _imageCanvas: ImageCanvasDrawerWithPreview
	private _targetLayerId: LayerId | undefined

	private _isEnabled = false

	constructor(private readonly _app: PaintApp) {
		this._imageCanvas = _app.imageCanvas
	}

	enable(): void {
		this._isEnabled = true
	}

	disable(): void {
		this._finishStroke()
		this._isEnabled = false
	}

	get isEnabled(): boolean {
		return this._isEnabled
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

	private _finishStroke() {
		if (this._pathPositions === undefined) {
			return
		}

		this._imageCanvas.endPreview()
		this._app.render()

		this._app.commandSender.command({
			kind: 'drawLayer',
			layer: this._targetLayerId!,
			drawCommand: this._constructCommand(),
		})

		this._pathPositions = undefined
	}

	private _constructCommand(): LayerDrawCommand {
		return {
			kind: 'stroke',
			positions: this._pathPositions!,
			color: this.color,
			width: this.width,
		}
	}
}

export class EraserTool implements PaintTool {
	private _pathPositions: Position[] | undefined
	width = 10
	private readonly _imageCanvas: ImageCanvasDrawerWithPreview
	private _targetLayerId: LayerId | undefined

	private _isEnabled = false

	constructor(private readonly _app: PaintApp) {
		this._imageCanvas = _app.imageCanvas
	}

	enable(): void {
		this._isEnabled = true
	}

	disable(): void {
		this._finishStroke()
		this._isEnabled = false
	}

	get isEnabled(): boolean {
		return this._isEnabled
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

	private _finishStroke() {
		if (this._pathPositions === undefined) {
			return
		}

		this._imageCanvas.endPreview()
		this._app.render()

		this._app.commandSender.command({
			kind: 'drawLayer',
			layer: this._targetLayerId!,
			drawCommand: this._constructCommand(),
		})

		this._pathPositions = undefined
	}

	private _constructCommand(): LayerDrawCommand {
		return {
			kind: 'erase',
			positions: this._pathPositions!,
			width: this.width,
		}
	}
}

export class MovingTool implements PaintTool {
	private _isEnabled = false

	private _lastPos: Position | undefined
	private _mouseMoveHandler: (e: MouseEvent) => void

	constructor(private readonly _app: App) {
		this._mouseMoveHandler = (e) => this._onScrollContainerMouseMoved({ x: e.x, y: e.y })
	}

	enable(): void {
		this._isEnabled = true
	}

	disable(): void {
		this.onMouseUp()
		this._isEnabled = false
	}

	get isEnabled(): boolean {
		return this._isEnabled
	}

	onMouseDown(_pos: Position): void {
		this._app.canvasScrollContainerElm.addEventListener('mousemove', this._mouseMoveHandler)
	}

	onMouseMoved(_pos: Position): void {
		// pass
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
