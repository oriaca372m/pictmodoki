import { defineComponent, ref, computed, nextTick } from 'vue'

function minMax(min: number, n: number, max: number): number {
	return Math.max(min, Math.min(n, max))
}

export default defineComponent({
	props: {
		modelValue: { required: true, type: Number },
		min: { required: true, type: Number },
		max: { required: true, type: Number },
		name: { required: true, type: String },
		unit: { type: String, default: '' },
		quickValues: { type: Array },
	},

	setup(props, { emit }) {
		const numSlider = ref<HTMLDivElement>()
		const numSliderBody = ref<HTMLDivElement>()
		const rawInput = ref<HTMLDivElement>()

		const min = props.min
		const max = props.max
		const value = computed({
			get: () => props.modelValue,
			set: (v) => emit('update:modelValue', minMax(min, v, max)),
		})
		const quickValues = props.quickValues ?? [1]

		const getSliderMaxWidth = () => {
			if (numSliderBody.value! === undefined) {
				return 100
			}
			return numSliderBody.value.clientWidth
		}

		// min~maxのうち精密に調整したい割合
		const k = 0.05
		// 精密調整にバーの全体の何割を使うか
		const a = 0.4

		const scale = (x: number) => {
			if (x < k) {
				return (x / k) * a
			} else {
				return ((x - k) / (1 - k)) * (1 - a) + a
			}
		}

		const rscale = (x: number) => {
			if (x < a) {
				return (x * k) / a
			} else {
				return ((x - a) / (1 - a)) * (1 - k) + k
			}
		}

		const filledWidth = computed({
			get: () => getSliderMaxWidth() * scale(value.value / max),
			set: (v) => (value.value = Math.floor(rscale(v / getSliderMaxWidth()) * max)),
		})
		const filledWidthStyle = computed(() => `${minMax(0, filledWidth.value, 200)}px`)
		const isRawEditMode = ref(false)
		const isPopupShown = ref(false)

		const mousemoveHandler = (e: MouseEvent) => {
			const rect = numSlider.value!.getBoundingClientRect()
			filledWidth.value = e.pageX - rect.left
			e.preventDefault()
		}
		const mouseupHandler = (e: MouseEvent) => {
			if (e.button !== 0) {
				return
			}
			window.removeEventListener('mousemove', mousemoveHandler)
			window.removeEventListener('mouseup', mouseupHandler)
		}

		const mousedown = (e: MouseEvent) => {
			if (isRawEditMode.value) {
				return
			}

			if (e.button == 2) {
				isRawEditMode.value = true
				nextTick(() => {
					rawInput.value!.focus()
				}).catch((e) => console.error(e))
				e.preventDefault()
				return
			}

			if (e.button !== 0) {
				return
			}

			filledWidth.value = e.offsetX
			window.addEventListener('mousemove', mousemoveHandler)
			window.addEventListener('mouseup', mouseupHandler)
		}

		const wheel = (e: WheelEvent) => {
			filledWidth.value = Math.floor(filledWidth.value + Math.sign(e.deltaY))
			e.preventDefault()
		}

		return {
			numSlider,
			numSliderBody,
			rawInput,
			value,
			min,
			max,
			name: props.name,
			unit: props.unit,
			quickValues,
			mousedown,
			filledWidthStyle,
			isRawEditMode,
			filledWidth,
			wheel,
			isPopupShown,
		}
	},
})
