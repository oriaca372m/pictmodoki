<template>
	<div>
		<div>
			<label>サーバーアドレス</label><input v-model="serverAddr">
		</div>
		<div>
			<label>ユーザー名</label><input v-model="userName">
		</div>
		<button @click="joinRoom">入室</button>
	</div>
</template>

<style>
</style>

<script>
import ColorPicker from '../components/color-picker'

export default {
	data: () => ({
		serverAddr: 'ws://127.0.0.1:25567',
		userName: '名無しのなっしー',
		colorCode: {raw: { hue: 0.5, opacity: 1, saturation: 0.5, value: 0.5 }},
	}),

	components: {
		ColorPicker,
	},

	created: function () {
		this.serverAddr = `ws://${window.location.hostname}:25567/`
	},

	methods: {
		joinRoom: function () {
			this.$router.push({ name: 'room', params: {
				serverAddr: this.serverAddr,
				userName: this.userName,
			} })
		}
	}
}
</script>
