import { defineComponent, reactive, ref, onMounted } from 'vue'
import ColorPicker from '../components/color-picker/index.vue'
import ColorPreview from '../components/color-picker/color-preview.vue'
import { HsvColor, toHsvColor } from '../components/color-picker/color'
import Draggable from 'vuedraggable'

import { LayerId } from 'common'
import { App, AppState } from '../app'

interface ChatMessage {
	msgId: number
	id: string
	name: string
	msg: string
}

interface LayerInfo {
	id: LayerId
	name: string
	isVisible: boolean
}

interface State {
	layers: LayerInfo[]
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
	},

	setup(props) {
		let app: App | undefined
		const appState = new AppState()

		const state = reactive<State>({
			layers: [],
			selectedLayerId: undefined,
			messageToSend: '',
			chatMessages: [],
			colorHistory: [],
		})

		const canvasContainer = ref<HTMLDivElement>()
		const canvasScrollContainer = ref<HTMLDivElement>()

		onMounted(() => {
			const vapp = new App(
				appState,
				canvasScrollContainer.value!,
				canvasContainer.value!,
				props.serverAddr,
				props.userName
			)
			app = vapp

			vapp.ready.once(() => {
				vapp.chatManager!.addMessageRecievedHandler((id, name, msg) => {
					state.chatMessages.push({ msgId: state.chatMessages.length, id, name, msg })
				})

				const paintApp = vapp.paintApp!

				const layerUpdated = () => {
					state.layers = paintApp.drawer.model.order.map((x) => {
						const layer = paintApp.drawer.findLayerModelById(x)
						return {
							id: layer!.id,
							name: layer!.name,
							isVisible: paintApp.drawer.getLayerVisibility(layer!.id),
						}
					})
					state.selectedLayerId = paintApp.layerManager.selectedLayerId
				}

				paintApp.layerManager.updated.on(layerUpdated)
				layerUpdated()

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
			saveCanvas,
			rotation: appState.rotation.toComputed(),
			scale: appState.scale.toComputed(),
			color: appState.color.toComputed(),
			penSize: appState.penSize.toComputed(),
			eraserSize: appState.eraserSize.toComputed(),
			shouldSaveCanvas: appState.shouldSaveCanvas.toComputed(),
		}
	},
})
