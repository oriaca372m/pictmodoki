import { Position } from 'common'

import { PaintApp } from './main'
import { PaintTool } from './paint-tool'

export class ToolManager {
	private _selectedTool: PaintTool | undefined
	private _tools = new Map<string, PaintTool>()

	constructor(
		private readonly _app: PaintApp,
		private readonly _canvasContainerElm: HTMLDivElement
	) {
		this._canvasContainerElm.addEventListener('mousedown', (e) => {
			this.onMouseDown(this._getPosFromEvent(e))
		})

		this._canvasContainerElm.addEventListener('mousemove', (e) => {
			this.onMouseMoved(this._getPosFromEvent(e))
		})

		this._canvasContainerElm.addEventListener('mouseup', (e) => {
			this.onMouseUp(this._getPosFromEvent(e))
		})
	}

	registerTool(name: string, tool: PaintTool): void {
		this._tools.set(name, tool)
	}

	selectTool(name: string): void {
		console.log(name)
		this._tools.forEach((x) => {
			x.disable()
		})

		this._selectedTool = this._tools.get(name)
		this._selectedTool?.enable()
		console.log(this._selectedTool)
	}

	onMouseMoved(pos: Position): void {
		this._selectedTool?.onMouseMoved(pos)
	}

	onMouseDown(pos: Position): void {
		this._selectedTool?.onMouseDown(pos)
	}

	onMouseUp(pos: Position): void {
		this._selectedTool?.onMouseUp(pos)
	}

	private _getPosFromEvent(e: MouseEvent): Position {
		const rect = this._canvasContainerElm.getBoundingClientRect()

		// 中央を0とした座標に変換
		let x = e.clientX - rect.left - rect.width / 2
		let y = e.clientY - rect.top - rect.height / 2

		// 拡大率に合わせて座標変換
		x /= this._app.canvasScale
		y /= this._app.canvasScale

		// 角度に応じて座標変換
		const rot = -this._app.canvasRotation
		if (rot !== 0) {
			const nx = x * Math.cos(rot) - y * Math.sin(rot)
			const ny = x * Math.sin(rot) + y * Math.cos(rot)
			x = nx
			y = ny
		}

		// キャンバスの左上を0とした座標に変換
		const canvasSize = this._app.imageCanvas.model.size
		x += canvasSize.width / 2
		y += canvasSize.height / 2

		// はみ出し防止
		x = Math.max(0, Math.min(x, Math.floor(canvasSize.width)))
		y = Math.max(0, Math.min(y, Math.floor(canvasSize.height)))

		return { x, y }
	}
}
