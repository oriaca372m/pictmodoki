import { defineComponent, computed, ref, watch } from 'vue'

export default defineComponent({
	props: {
		modelValue: { required: true, type: Number },
		type: { required: true, type: String },
	},

	setup(props, { emit }) {
		const bar = ref<HTMLDivElement>()

		const value = computed({
			get: () => props.modelValue,
			set: (v) => {
				let targetV = v
				if (v < 0) {
					targetV = 0
				} else if (1 < v) {
					targetV = 1
				}

				if (targetV !== value.value) {
					emit('update:modelValue', targetV)
				}
			},
		})

		function mousemove(ev: MouseEvent) {
			ev.preventDefault()
			const rect = bar.value!.getBoundingClientRect()
			const y = ev.clientY - rect.top

			value.value = y / rect.height
		}

		function mousedown(ev: MouseEvent) {
			window.addEventListener('mousemove', mousemove)
			window.addEventListener('mouseup', mouseup)
			mousemove(ev)
		}

		function mouseup() {
			window.removeEventListener('mousemove', mousemove)
			window.removeEventListener('mouseup', mouseup)
		}

		function keydown(ev: KeyboardEvent) {
			if (ev.key === 'ArrowDown') {
				value.value += 0.005
			} else if (ev.key === 'ArrowUp') {
				value.value -= 0.005
			}
		}

		function mouseenter() {
			window.addEventListener('keydown', keydown)
		}

		function mouseleave() {
			window.removeEventListener('keydown', keydown)
		}

		const cursory = computed(() => Math.floor(props.modelValue * 200))

		return {
			bar,
			mousedown,
			cursory,
			mouseenter,
			mouseleave,
		}
	},
})
