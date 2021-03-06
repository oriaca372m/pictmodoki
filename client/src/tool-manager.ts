import { Position } from 'common'

import { PaintApp } from './paint-app'
import { PaintTool } from './paint-tool'

export class ToolManager {
	private _selectedTool: PaintTool | undefined
	private _tools = new Map<string, PaintTool>()
	private _toolHistory: string[] = []
	private _isMouseDown = false

	constructor(
		private readonly _app: PaintApp,
		private readonly _canvasContainerElm: HTMLDivElement
	) {
		this._canvasContainerElm.addEventListener('pointerdown', (e) => {
			if (this._isMouseDown) {
				return
			}

			this._isMouseDown = true
			this.onMouseDown(this._getPosFromEvent(e))
		})

		this._canvasContainerElm.addEventListener('pointermove', (e) => {
			if (!this._isMouseDown) {
				return
			}

			if (e.buttons === 0) {
				this._isMouseDown = false
				this.onMouseUp(this._getPosFromEvent(e))
				return
			}

			const es = e.getCoalescedEvents()
			for (const coalesced of es) {
				this.onMouseMoved(this._getPosFromEvent(coalesced))
			}
		})

		this._canvasContainerElm.addEventListener('pointerup', (e) => {
			if (!this._isMouseDown) {
				return
			}

			this._isMouseDown = false
			this.onMouseUp(this._getPosFromEvent(e))
		})
	}

	registerTool(name: string, tool: PaintTool): void {
		this._tools.set(name, tool)
	}

	// 成功したら true
	private _selectTool(name: string): boolean {
		const tool = this._tools.get(name)
		if (tool === undefined) {
			return false
		}

		this._tools.forEach((x) => {
			x.disable()
		})

		this._selectedTool = tool
		this._selectedTool.enable()
		return true
	}

	selectTool(name: string): void {
		if (this._selectTool(name)) {
			this._toolHistory = [name]
		}
	}

	pushTool(name: string): void {
		if (this._selectTool(name)) {
			this._toolHistory.push(name)
		}
	}

	popTool(): void {
		if (this._toolHistory.length <= 1) {
			return
		}
		this._toolHistory.pop()
		const name = this._toolHistory[this._toolHistory.length - 1]
		if (name) {
			this._selectTool(name)
		}
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

		const scale = this._app.app.state.scale.value / 100

		// 拡大率に合わせて座標変換
		x /= scale
		y /= scale

		// 角度に応じて座標変換
		const rot = -this._app.app.state.rotation.value * (Math.PI / 180)
		if (rot !== 0) {
			const nx = x * Math.cos(rot) - y * Math.sin(rot)
			const ny = x * Math.sin(rot) + y * Math.cos(rot)
			x = nx
			y = ny
		}

		// キャンバスの左上を0とした座標に変換
		const canvasSize = this._app.drawer.model.size
		x += canvasSize.width / 2
		y += canvasSize.height / 2

		// はみ出し防止
		x = Math.max(0, Math.min(x, canvasSize.width))
		y = Math.max(0, Math.min(y, canvasSize.height))

		return { x, y }
	}
}
