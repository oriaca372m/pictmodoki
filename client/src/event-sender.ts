import {
	Command,
	Event,
	ImageCanvasCommand,
	ImageCanvasEventType,
	ImageCanvasEventManager,
	ImageCanvasModel,
	SerializedImageCanvasModel,
	LayerCanvasModel,
	SerializedLayerCanvasModel,
} from 'common'

import { OffscreenCanvasProxyFactory, App } from './main'
import { encode, decodeAsync } from '@msgpack/msgpack'

async function deserializeLayerCanvasModel(
	data: SerializedLayerCanvasModel,
	factory: OffscreenCanvasProxyFactory
): Promise<LayerCanvasModel> {
	return new LayerCanvasModel(
		data.id,
		await factory.createCanvasProxyFromBitmap(data.image),
		data.name
	)
}

async function deserializeImageCanvasModel(
	data: SerializedImageCanvasModel,
	factory: OffscreenCanvasProxyFactory
): Promise<ImageCanvasModel> {
	const model = new ImageCanvasModel(data.size)
	const layers = await Promise.all(
		data.layers.map((x) => deserializeLayerCanvasModel(x, factory))
	)
	model.layers = layers
	return model
}

export interface CommandSender {
	command(cmd: ImageCanvasCommand): void
}

export class SocketCommandSender implements CommandSender {
	constructor(
		private _app: App,
		private _manager: ImageCanvasEventManager,
		private _socket: WebSocket
	) {}

	start(): void {
		this._socket.onmessage = (msg) => {
			void (async () => {
				const blob = msg.data as Blob
				console.log(blob)

				const event = (await decodeAsync(blob.stream())) as Event
				console.log(event)
				if (event.kind === 'imageCanvasEvent') {
					this._manager.event(event.value)
				} else if (event.kind === 'dataSent') {
					this._app.undoManager.setLastRenderedImageModel(
						await deserializeImageCanvasModel(event.value, this._app.factory)
					)
					this._app.eventManager.setHistory(event.log)
				}
			})()
		}
	}

	command(cmd: ImageCanvasCommand): void {
		this._pushToSocket({ kind: 'imageCanvasCommand', value: cmd })
		this._pushVirtualEvent(cmd)
	}

	private _pushToSocket(cmd: Command) {
		this._socket.send(encode(cmd))
	}

	private _pushVirtualEvent(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(eventType: ImageCanvasEventType) {
		this._manager.event({
			id: 'virtual',
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: true,
			eventType,
		})
	}
}

export class DebugCommandSender implements CommandSender {
	private _eventId = 0
	private _layerId = 0
	constructor(private _manager: ImageCanvasEventManager, private _socket: WebSocket) {}

	command(cmd: ImageCanvasCommand): void {
		if (cmd.kind === 'drawLayer') {
			this._pushEvent({
				kind: 'layerDrawn',
				layerId: cmd.layer,
				drawCommand: cmd.drawCommand,
			})
		} else if (cmd.kind === 'createLayer') {
			this._pushEvent({ kind: 'layerCreated', layerId: this._layerId.toString() }, false)
			this._layerId++
		} else if (cmd.kind === 'revokeEvent') {
			this._pushEvent({ kind: 'eventRevoked', eventId: cmd.eventId })
		}
	}

	private _pushEvent(eventType: ImageCanvasEventType, sendVirtualEvent = true) {
		if (sendVirtualEvent) {
			this._manager.event({
				id: 'virtual',
				userId: 'debugUser',
				isRevoked: false,
				isVirtual: true,
				eventType,
			})
		}

		const event = {
			id: this._eventId.toString(),
			userId: 'debugUser',
			isRevoked: false,
			isVirtual: false,
			eventType,
		}
		this._eventId++

		setTimeout(() => {
			this._manager.event(event)
		}, 1000)
	}
}
