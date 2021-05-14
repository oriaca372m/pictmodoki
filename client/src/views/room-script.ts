import { defineComponent, reactive, ref, watch, onMounted } from 'vue'
import ColorPicker from '../components/color-picker/index.vue'
import { HsvColor, toHsvColor, toRgbCode } from '../components/color-picker/color'
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
}

interface State {
	layers: LayerInfo[]
	size: number
	eraserSize: number
	color: HsvColor
	selectedLayerId: string | undefined
	messageToSend: string
	chatMessages: ChatMessage[]
}

export default defineComponent({
	props: {
		serverAddr: { required: true, type: String },
		userName: { required: true, type: String },
	},

	components: {
		ColorPicker,
		Draggable,
	},

	setup(props) {
		let app: App | undefined
		const appState = new AppState()

		const state = reactive<State>({
			layers: [],
			size: 10,
			eraserSize: 20,
			color: toHsvColor('#000000'),
			selectedLayerId: undefined,
			messageToSend: '',
			chatMessages: [],
		})

		const canvasContainer = ref<HTMLDivElement>()
		const canvasScrollContainer = ref<HTMLDivElement>()

		onMounted(() => {
			console.log('test')
			canvasScrollContainer.value!.scrollTop = 5000
			canvasScrollContainer.value!.scrollLeft = 5000

			app = new App(
				appState,
				canvasScrollContainer.value!,
				canvasContainer.value!,
				props.serverAddr,
				props.userName
			)
			console.log(app)

			app.ready.once(() => {
				app!.chatManager!.addMessageRecievedHandler((id, name, msg) => {
					state.chatMessages.push({ msgId: state.chatMessages.length, id, name, msg })
				})

				const layerUpdated = () => {
					state.layers = app!.paintApp!.drawer.model.order.map((x) => {
						const layer = app!.paintApp!.drawer.findLayerModelById(x)
						return { id: layer!.id, name: layer!.name }
					})
					state.selectedLayerId = app!.paintApp!.layerManager.selectedLayerId
				}

				app!.paintApp!.layerManager.updated.on(layerUpdated)
				layerUpdated()
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

		const selectColor = (color: string) => {
			state.color = toHsvColor(color)
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

		watch(
			state,
			() => {
				if (app === undefined) {
					return
				}

				const paintApp = app.paintApp
				if (paintApp === undefined) {
					return
				}

				app.paintApp!.penTool.color = toRgbCode(state.color)

				paintApp.penTool.width = state.size
				paintApp.eraserTool.width = state.eraserSize
			},
			{ deep: true }
		)

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
			rotation: appState.rotation.toComputed(),
			scale: appState.scale.toComputed(),
		}
	},
})
