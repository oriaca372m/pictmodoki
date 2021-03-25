import { ImageCanvasDrawer, LayerDrawCommand, Position, Color, LayerId } from 'common'
import { App } from './main'

export interface PaintTool {
	enable(): void
	disable(): void

	readonly isEnabled: boolean
}

export class PenTool implements PaintTool {
	private _pathPositions: Position[] | undefined
	color: Color = '#ff0000'
	width = 10
	mode: 'stroke' | 'erase' = 'stroke'
	private readonly _imageCanvas: ImageCanvasDrawer
	private readonly _canvasElm: HTMLCanvasElement
	private _targetLayerId: LayerId | undefined

	private _isEnabled = false

	constructor(private readonly _app: App) {
		this._imageCanvas = _app.imageCanvas
		this._canvasElm = _app.canvasElm

		this._canvasElm.addEventListener('mousedown', (e) => {
			if (!this._isEnabled) {
				return
			}
			this._startStroke(this._getPosFromEvent(e))
		})

		this._canvasElm.addEventListener('mousemove', (e) => {
			if (!this._isEnabled) {
				return
			}
			this._continueStroke(this._getPosFromEvent(e))
		})

		this._canvasElm.addEventListener('mouseup', () => {
			if (!this._isEnabled) {
				return
			}
			this._finishStroke()
		})
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

	private _startStroke(pos: Position) {
		if (this._pathPositions !== undefined) {
			return
		}

		this._targetLayerId = this._app.selectedLayerId
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
			layer: this._app.selectedLayerId!,
			drawCommand: this._constructCommand(),
		})

		this._pathPositions = undefined
	}

	private _getPosFromEvent(e: MouseEvent): Position {
		const rect = this._canvasElm.getBoundingClientRect()
		const x = e.clientX - rect.left
		const y = e.clientY - rect.top

		return { x, y }
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
