import { defineComponent, reactive, computed, ref, watch } from 'vue'
import ColorBar from './color-bar.vue'
import ColorCodeBox from './color-code-box.vue'
import ColorPreview from './color-preview.vue'
import { HsvColor, hsvToRgb } from './color'
import lodash from 'lodash'

export default defineComponent({
	components: { ColorBar, ColorCodeBox, ColorPreview },

	props: {
		modelValue: { required: true, type: Object },
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

		watch(
			() => props.modelValue as HsvColor,
			(mv) => {
				if (lodash.isEqual(mv, rawColor)) {
					return
				}

				rawColor.hue = mv.hue
				rawColor.saturation = mv.saturation
				rawColor.value = mv.value
				rawColor.opacity = mv.opacity
			},
			{ deep: true, immediate: true, flush: 'post' }
		)

		watch(
			rawColor,
			(v) => {
				emit('update:modelValue', v)
			},
			{ deep: true, immediate: true }
		)

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
