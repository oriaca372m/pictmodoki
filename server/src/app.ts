import { NodeCanvasProxy, NodeCanvasProxyFactory } from './canvas-proxy'
import { CommandInterpreter } from './command-interpreter'

import { Size, ImageCanvasModel, ImageCanvasDrawer } from 'common'

import {
	ImageCanvasEventManager,
	ImageCanvasEventExecutor,
} from 'common/dist/image-canvas/event-manager'

export class App {
	size: Size
	factory: NodeCanvasProxyFactory
	drawer: ImageCanvasDrawer
	eventMgr: ImageCanvasEventManager
	eventExecutor: ImageCanvasEventExecutor
	targetCanvas: NodeCanvasProxy
	cmdInterpreter: CommandInterpreter

	constructor() {
		this.size = { width: 2000, height: 2000 }
		this.factory = new NodeCanvasProxyFactory()
		this.targetCanvas = this.factory.createCanvasProxy(this.size)

		// 特に使用されないので小さめのサイズで作る
		const model = new ImageCanvasModel({ width: 256, height: 256 })
		this.drawer = new ImageCanvasDrawer(model, this.factory)

		this.eventMgr = new ImageCanvasEventManager()
		this.eventExecutor = new ImageCanvasEventExecutor(this.eventMgr, this.drawer, this.factory)
		this.eventMgr.setExecutor(this.eventExecutor)

		this.cmdInterpreter = new CommandInterpreter(this.eventMgr)
		this.resetCanvas()
	}

	resetCanvas(): void {
		this.drawer.setModel(new ImageCanvasModel({ width: 2000, height: 2000 }))
		this.eventMgr.setHistory([])
		this.eventExecutor = new ImageCanvasEventExecutor(this.eventMgr, this.drawer, this.factory)
		this.eventMgr.setExecutor(this.eventExecutor)

		this.cmdInterpreter.command('system', { kind: 'createLayer' })
		this.cmdInterpreter.command('system', { kind: 'createLayer' })
	}
}
