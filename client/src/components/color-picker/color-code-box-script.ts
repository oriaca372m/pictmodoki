import { defineComponent, computed } from 'vue'
import { HsvColor, toRgbCode } from './color'

export default defineComponent({
	props: {
		modelValue: { required: true, type: Object },
	},

	setup(props, { emit }) {
		const value = computed<HsvColor>({
			get: () => props.modelValue as HsvColor,
			set: (v) => {
				if (v !== value.value) {
					emit('update:modelValue', v)
				}
			},
		})

		const rgbCode = computed(() => toRgbCode(value.value))

		return {
			value,
			rgbCode,
		}
	},
})
