<template>
	<div id="color-picker-test">
		<button @click="setColor('#ff0000')">r</button>
		<button @click="setColor('#00ff00')">g</button>
		<button @click="setColor('#0000ff')">b</button>
		<color-picker v-model="color" />
		<p>{{ color }}</p>
		<slider
			v-model="penSize"
			name="ペン"
			unit="px"
			:min="0"
			:max="400"
			:quick-values="[1, 2]"
		/>
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
import Slider from '../components/slider'
import { toHsvColor } from '../components/color-picker/color'

export default defineComponent({
	components: {
		ColorPicker,
		Slider,
	},

	setup() {
		const color = ref({ hue: 0.5, opacity: 1, saturation: 0.5, value: 0.5 })
		function setColor(code) {
			color.value = toHsvColor(code)
		}
		const penSize = ref(10)
		return { color, setColor, penSize }
	},
})
</script>
