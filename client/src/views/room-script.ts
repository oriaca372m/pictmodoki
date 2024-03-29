import { defineComponent, reactive, ref, onMounted } from 'vue'
import ColorPicker from '../components/color-picker/index.vue'
import Slider from '../components/slider/index.vue'
import { PenScaler } from '../components/slider/slider-scaler'
import ColorPreview from '../components/color-picker/color-preview.vue'
import { HsvColor, toHsvColor } from '../components/color-picker/color'
import Draggable from 'vuedraggable'

import { LayerId } from 'common/dist/image-canvas'
import { App, AppState } from '../app'
import { Bindable } from '../bindable'
import { UserInfo } from '../user-manager'

type ChatAttachment = {
	kind: 'rec'
	id: string
}

interface ChatMessage {
	msgId: number
	id: string
	name: string
	msg: string
	attachments: ChatAttachment[]
}

interface LayerInfo {
	id: LayerId
	name: string
	isVisible: boolean
}

interface State {
	layers: LayerInfo[]
	users: readonly UserInfo[]
	selectedLayerId: string | undefined
	messageToSend: string
	chatMessages: ChatMessage[]
	colorHistory: readonly HsvColor[]
}

export default defineComponent({
	props: {
		serverAddr: { required: true, type: String },
		userName: { required: true, type: String },
	},

	components: {
		ColorPicker,
		Draggable,
		ColorPreview,
		Slider,
	},

	setup(props) {
		let app: App | undefined
		const appState = new AppState()

		const state = reactive<State>({
			layers: [],
			users: [],
			selectedLayerId: undefined,
			messageToSend: '',
			chatMessages: [],
			colorHistory: [],
		})

		const canvasContainer = ref<HTMLDivElement>()
		const canvasScrollContainer = ref<HTMLDivElement>()

		const volume = new Bindable(10)

		onMounted(() => {
			const vapp = new App(
				appState,
				canvasScrollContainer.value!,
				canvasContainer.value!,
				props.serverAddr,
				props.userName
			)
			app = vapp
			volume.bindTo(vapp.audioPlayer.volume, true)

			vapp.ready.once(() => {
				vapp.chatManager!.addMessageRecievedHandler((id, name, msg) => {
					const attachments: ChatAttachment[] = []

					const recIdPattern =
						/\brec#([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})\b/g
					for (const match of msg.matchAll(recIdPattern)) {
						console.log(match)
						console.log(match[1])
						attachments.push({ kind: 'rec', id: match[1] })
					}

					state.chatMessages.unshift({
						msgId: state.chatMessages.length,
						id,
						name,
						msg,
						attachments,
					})
				})

				const paintApp = vapp.paintApp!

				paintApp.layerManager.updated.on(() => {
					state.layers = paintApp.drawer.model.order.map((x) => {
						const layer = paintApp.drawer.findLayerModelById(x)
						return {
							id: layer!.id,
							name: layer!.name,
							isVisible: paintApp.drawer.getLayerVisibility(layer!.id),
						}
					})
					state.selectedLayerId = paintApp.layerManager.selectedLayerId
				}, true)

				vapp.userManager.updated.on(() => {
					state.users = vapp.userManager.users
				}, true)

				paintApp.colorHistory.updated.on(() => {
					state.colorHistory = paintApp.colorHistory.history
				})
			})
		})

		const setLayerOrder = () => {
			app!.paintApp!.layerManager.setLayerOrder(state.layers.map((x) => x.id))
		}

		const selectLayerId = (id: LayerId) => {
			const succeeded = app!.paintApp!.layerManager.selectLayerId(id)
			if (succeeded) {
				state.selectedLayerId = id
			}
		}

		const removeLayerId = (id: LayerId) => {
			app!.paintApp!.layerManager.removeLayer(id)
		}

		const createLayer = () => {
			app!.paintApp!.layerManager.createLayer()
		}

		const selectTool = (name: string) => {
			app!.paintApp!.toolManager.selectTool(name)
		}

		const selectColor = (color: HsvColor | string) => {
			appState.color.value = toHsvColor(color)
			selectTool('pen')
		}

		const undo = () => {
			app!.paintApp!.undo()
		}

		const setLayerVisibility = (id: LayerId, isVisible: boolean) => {
			app!.paintApp!.layerManager.setLayerVisibility(id, isVisible)
		}

		const sendChat = () => {
			if (state.messageToSend === '') {
				return
			}
			app!.chatManager!.sendMessage(state.messageToSend)
			state.messageToSend = ''
		}

		function setCanvasViewEntire() {
			app?.paintApp?.setCanvasViewEntire()
		}

		function setCanvasViewOriginal() {
			appState.scale.value = 100
			appState.rotation.value = 0
		}

		function saveCanvas() {
			app?.paintApp?.saveCanvas()
		}

		return {
			state,
			canvasContainer,
			canvasScrollContainer,
			setLayerOrder,
			selectLayerId,
			removeLayerId,
			createLayer,
			selectTool,
			selectColor,
			undo,
			setLayerVisibility,
			sendChat,
			setCanvasViewEntire,
			setCanvasViewOriginal,
			saveCanvas,
			rotation: appState.rotation.toComputed(),
			scale: appState.scale.toComputed(),
			color: appState.color.toComputed(),
			penSize: appState.penSize.toComputed(),
			eraserSize: appState.eraserSize.toComputed(),
			shouldSaveCanvas: appState.shouldSaveCanvas.toComputed(),
			volume: volume.toComputed(),
			activeTab: ref(1),
			penScaler: new PenScaler(),
		}
	},
})
