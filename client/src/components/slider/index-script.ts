import { defineComponent, ref, computed, nextTick, PropType } from 'vue'
import { SliderScaler, PassThroughScaler } from './slider-scaler'

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
		quickValues: { type: Array as PropType<number[]> },
		scaler: { type: Object as PropType<SliderScaler>, default: () => new PassThroughScaler() },
	},

	setup(props, { emit }) {
		const numSlider = ref<HTMLDivElement>()
		const numSliderBody = ref<HTMLDivElement>()
		const rawInput = ref<HTMLInputElement>()

		const min = props.min
		const max = props.max
		const range = max - min
		const value = computed({
			get: () => props.modelValue,
			set: (v) => emit('update:modelValue', minMax(min, v, max)),
		})
		const quickValues = props.quickValues ?? [1]
		const scaler = props.scaler

		const getSliderMaxWidth = () => {
			if (numSliderBody.value! === undefined) {
				return 100
			}
			return numSliderBody.value.clientWidth
		}

		const filledWidth = computed({
			get: () => getSliderMaxWidth() * scaler.scale((value.value - min) / range),
			set: (v) => {
				value.value = Math.floor(scaler.rscale(v / getSliderMaxWidth()) * range + min)
			},
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
					rawInput.value!.select()
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
			value.value += Math.sign(e.deltaY)
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
