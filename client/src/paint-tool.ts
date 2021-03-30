import { LayerDrawCommand, Position, Color, LayerId } from 'common'

import { PaintApp } from './main'
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
	mode: 'stroke' | 'erase' = 'stroke'
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
			kind: this.mode,
			positions: this._pathPositions!,
			color: this.color,
			width: this.width,
		}
	}
}
