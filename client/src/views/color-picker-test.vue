<template>
	<div id="color-picker-test">
		<button @click="colorCode = '#ff0000'">r</button>
		<button @click="colorCode = '#00ff00'">g</button>
		<button @click="colorCode = '#0000ff'">b</button>
		<color-picker v-model="colorCode"/>
		<p>{{ colorCode }}</p>
	</div>
</template>

<style>
#color-picker-test {
	padding: 30px;
}
</style>

<script>
import { defineComponent, ref } from 'vue'
import ColorPicker from '../components/color-picker'

export default defineComponent({
	components: {
		ColorPicker,
	},

	setup() {
		const colorCode =  ref({raw: { hue: 0.5, opacity: 1, saturation: 0.5, value: 0.5 }})
		return { colorCode }
	}
})
</script>
