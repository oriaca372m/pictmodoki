import { UserId } from 'common'
import {
	ImageCanvasModel,
	SerializedImageCanvasModel,
	LayerCanvasModel,
	SerializedLayerCanvasModel,
} from 'common/dist/image-canvas'
import { OffscreenCanvasProxyFactory } from './canvas-proxy'

import { WebSocketApi } from './web-socket-api'
import { TypedEvent } from './typed-event'
import { PaintApp } from './paint-app'
import { Bindable } from './bindable'
import { AudioPlayer } from './audio-player'
import { UserManager } from './user-manager'
import { HsvColor } from './components/color-picker/color'

export class AppState {
	readonly rotation = new Bindable(0)
	readonly scale = new Bindable(100)
	readonly color = new Bindable<HsvColor>({
		hue: 0,
		saturation: 1,
		value: 0,
		opacity: 0,
	})
	readonly penSize = new Bindable(10)
	readonly eraserSize = new Bindable(20)
	readonly shouldSaveCanvas = new Bindable(false)
}

export class App {
	private _api: WebSocketApi
	private _paintApp: PaintApp | undefined
	private _userId: UserId | undefined
	private _chatManager: ChatManager | undefined
	readonly audioPlayer = new AudioPlayer()
	readonly userManager = new UserManager()

	readonly ready = new TypedEvent<void>()

	get paintApp(): PaintApp | undefined {
		return this._paintApp
	}

	get userId(): UserId | undefined {
		return this._userId
	}

	get chatManager(): ChatManager | undefined {
		return this._chatManager
	}

	constructor(
		public state: AppState,
		readonly canvasScrollContainerElm: HTMLDivElement,
		readonly canvasContainerElm: HTMLDivElement,
		serverAddr: string,
		userName: string
	) {
		this._api = new WebSocketApi(serverAddr)

		this._api.opened.on(() => {
			const reconnectionToken = localStorage.getItem('reconnectionToken') ?? null

			this._api.sendCommand({
				kind: 'login',
				name: userName,
				reconnectionToken: reconnectionToken,
			})

			const app = new PaintApp(this, this._api)
			this._paintApp = app
			app.render()

			this._api.sendCommand({ kind: 'requestData' })
			this._chatManager = new ChatManager(this._api)
			this.ready.emit()
		})

		this._api.eventHappened.on((event) => {
			if (event.kind === 'loginAccepted') {
				this._userId = event.userId
				localStorage.setItem('reconnectionToken', event.reconnectionToken)
				return
			}

			if (event.kind === 'userLoggedIn') {
				this._chatManager!.sendSystemMessage(
					`${event.name} さん(id: ${event.userId})がログインしました`
				)
				return
			}

			if (event.kind === 'gameStateChanged') {
				const s = event.value

				this.userManager.update(
					s.userData.map((x) => ({
						id: x.userId,
						name: x.name,
						score: x.point ?? 0,
					}))
				)

				if (s.state.kind === 'painting') {
					const answer = s.state.value.answer
					this.audioPlayer.playAudio('/assets/audio/start_painting.wav')
					if (answer === null) {
						const name = this.userManager.getUserById(s.state.value.painter)!.name
						this._chatManager!.sendSystemMessage(`${name}さんが描く絵を当ててください!`)
					} else {
						this._chatManager!.sendSystemMessage(
							`あなたの番です! 「${answer}」を描いてください!`
						)
					}
				} else if (s.state.kind === 'waitingNext') {
					const answer = s.state.value.currentPainting.answer!

					if (s.state.value.respondent !== null) {
						this.audioPlayer.playAudio('/assets/audio/correct.wav')
						const name = this.userManager.getUserById(s.state.value.respondent)!.name
						this._chatManager!.sendSystemMessage(
							`正解は「${answer}」でした! ${name}さんが正解しました!`
						)
					} else {
						this.audioPlayer.playAudio('/assets/audio/timeup.wav')
						this._chatManager!.sendSystemMessage(
							`時間切れです… 正解は「${answer}」でした`
						)
					}

					const nextAnswer = s.state.value.nextPainting.answer
					if (nextAnswer) {
						this._chatManager!.sendSystemMessage(
							`次はあなたの番です! 「${nextAnswer}」を描く準備をしてください!`
						)
					}
				}
				return
			}

			if (event.kind === 'canvasStateSet') {
				void (async () => {
					if (this._paintApp === undefined) {
						console.error('タイミングだめ')
						return
					}
					this._api.blockEvent()
					this._paintApp.setCanvasState(
						await deserializeImageCanvasModel(event.value, this._paintApp.factory),
						event.log
					)
					this._api.resumeEvent()
				})()
				return
			}
		})

		this._api.start()
	}
}

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
	model.setLayers(layers, data.order)
	return model
}

type ChatMessageRecievedHandler = (userId: UserId, userName: string, message: string) => void
class ChatManager {
	private readonly _messageRecievedHandlers: ChatMessageRecievedHandler[] = []

	constructor(private readonly _api: WebSocketApi) {
		this._api.eventHappened.on((event) => {
			if (event.kind === 'chatSent') {
				this._messageRecievedHandlers.forEach((x) =>
					x(event.userId, event.name, event.message)
				)
				return
			}
		})
	}

	sendSystemMessage(msg: string) {
		this._messageRecievedHandlers.forEach((x) => {
			x('system', 'system', msg)
		})
	}

	addMessageRecievedHandler(handler: ChatMessageRecievedHandler) {
		this._messageRecievedHandlers.push(handler)
	}

	sendMessage(message: string) {
		this._api.sendCommand({ kind: 'sendChat', message })
	}
}
