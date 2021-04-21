import { defineComponent, reactive, computed, ref, watch } from 'vue'
import ColorBar from './color-bar.vue'
import ColorCodeBox from './color-code-box.vue'
import { HsvColor, hsvToRgb, rgbToHsv, toRgbCode } from './color'
import l from 'lodash'

interface ColorValue {
	raw: HsvColor
	rgbCode: string
}

export default defineComponent({
	components: { ColorBar, ColorCodeBox },

	props: {
		modelValue: { required: true },
	},

	setup(props, { emit }) {
		const svBox = ref<HTMLDivElement>()

		const state = reactive({
			x: 0,
			y: 0,
		})

		const rawColor = reactive({
			hue: 0,
			opacity: 0,
			saturation: 0,
			value: 0,
		})

		let lastEmittedValue: ColorValue | undefined

		const updateModelValue = (value: HsvColor, shouldUpdateSelf = false) => {
			lastEmittedValue = {
				raw: value,
				rgbCode: toRgbCode(value),
			}

			if (shouldUpdateSelf) {
				rawColor.hue = value.hue
				rawColor.saturation = value.saturation
				rawColor.value = value.value
				rawColor.opacity = value.opacity
			}

			emit('update:modelValue', lastEmittedValue)
		}

		watch(
			() => props.modelValue,
			(mv) => {
				if (l.isEqual(mv, lastEmittedValue)) {
					return
				}

				if (typeof mv === 'string') {
					if (!mv.startsWith('#')) {
						return
					}

					const [r, g, b, a] = l
						.chunk([...mv.substring(1)], 2)
						.map((x) => parseInt(x.join(''), 16))

					if (r === undefined || g === undefined || b === undefined) {
						return
					}

					const [h, s, v] = rgbToHsv(r, g, b)
					updateModelValue({ hue: h, saturation: s, value: v, opacity: a ?? 0 }, true)
					return
				}

				if (typeof mv === 'object') {
					if (mv === null) {
						return
					}

					if ('raw' in mv) {
						const mv2 = mv as { raw: HsvColor }
						updateModelValue(mv2.raw, true)
						return
					}
				}
			},
			{ deep: true, immediate: true, flush: 'post' }
		)

		watch(rawColor, (v) => updateModelValue(v), { deep: true, immediate: true })

		function svMouseMove(ev: MouseEvent) {
			const clicked = (ev.buttons & 1) !== 0
			if (clicked) {
				const rect = svBox.value!.getBoundingClientRect()

				const x = Math.max(0, Math.min(rect.width, ev.clientX - rect.left))
				const y = Math.max(0, Math.min(rect.height, ev.clientY - rect.top))

				rawColor.saturation = x / rect.width
				rawColor.value = y / rect.height
				ev.preventDefault()
			}
		}

		const cursorX = computed(() => Math.floor(rawColor.saturation * 200))
		const cursorY = computed(() => Math.floor(rawColor.value * 150))

		function svMouseDown(ev: MouseEvent) {
			window.addEventListener('mousemove', svMouseMove)
			window.addEventListener('mouseup', svMouseUp)
			svMouseMove(ev)
		}

		function svMouseUp() {
			window.removeEventListener('mousemove', svMouseMove)
			window.removeEventListener('mouseup', svMouseUp)
		}

		const hue = computed(() => rawColor.hue * 360)

		const previewColor = computed(() => {
			const { hue, saturation, value } = rawColor
			return `rgb(${hsvToRgb(hue, saturation, value).join(',')})`
		})

		return { state, previewColor, hue, rawColor, svMouseDown, svBox, cursorX, cursorY }
	},
})
