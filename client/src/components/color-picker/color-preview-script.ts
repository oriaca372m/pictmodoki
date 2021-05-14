import { defineComponent, computed } from 'vue'
import { HsvColor, toRgbCode } from './color'

export default defineComponent({
	props: {
		value: { required: true, type: Object },
	},

	setup(props) {
		const rgbCode = computed(() => toRgbCode(props.value as HsvColor))

		return { rgbCode }
	},
})
