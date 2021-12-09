import { PaintApp } from './paint-app'
import { PaintTool } from './paint-tool'

export class ToolManager {
	private _selectedTool: PaintTool | undefined
	private _tools = new Map<string, PaintTool>()
	private _toolHistory: string[] = []

	constructor(readonly paintApp: PaintApp) {}

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
}
