import { NodeCanvasProxyFactory } from './canvas-proxy'
import { CommandInterpreter } from './command-interpreter'

import { Size } from 'common'
import {
	ImageCanvasModel,
	ImageCanvasDrawer,
	ImageCanvasEventManager,
	ImageCanvasEventExecutor,
} from 'common/dist/image-canvas'

export class App {
	private readonly _size: Size = { width: 2000, height: 2000 }
	private readonly _factory: NodeCanvasProxyFactory
	eventMgr: ImageCanvasEventManager
	private _drawer!: ImageCanvasDrawer
	eventExecutor!: ImageCanvasEventExecutor
	cmdInterpreter: CommandInterpreter

	constructor() {
		this._factory = new NodeCanvasProxyFactory()

		this.eventMgr = new ImageCanvasEventManager()
		this.cmdInterpreter = new CommandInterpreter(this.eventMgr)
		this.resetCanvas()
	}

	resetCanvas(): void {
		this.eventMgr.breakHistory()
		this._drawer = new ImageCanvasDrawer(new ImageCanvasModel(this._size), this._factory)
		this.eventExecutor = new ImageCanvasEventExecutor(
			this.eventMgr,
			this._drawer,
			this._factory
		)
		this.eventMgr.setExecutor(this.eventExecutor)

		this.cmdInterpreter.command('system', { kind: 'createLayer' })
	}
}
