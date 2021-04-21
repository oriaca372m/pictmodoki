import { defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'

export default defineComponent({
	data: () => ({
		serverAddr: 'ws://127.0.0.1:25567',
		userName: '名無しのなっしー',
	}),

	setup() {
		const userName = ref('名無しのなっしー')
		const serverAddr = ref(`ws://${window.location.hostname}:25567/`)

		const router = useRouter()

		const joinRoom = () => {
			void router.push({
				name: 'room',
				params: {
					serverAddr: serverAddr.value,
					userName: userName.value,
				},
			})
		}

		return { userName, serverAddr, joinRoom }
	},
})
