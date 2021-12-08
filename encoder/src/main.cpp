#include <napi.h>

#include <fmt/core.h>

#include <cstdint>

#include "encoder.hpp"

namespace {
	Napi::Value error(const Napi::Env& env, const char* msg) {
		Napi::Error::New(env, msg).ThrowAsJavaScriptException();
		return env.Undefined();
	}

	Napi::Value error(const Napi::Env& env, const std::string& msg) {
		return error(env, msg.c_str());
	}

	void create_frame_rgb(std::uint8_t* buf, int width, int height, int nr_frame) {
		auto draw_point = [&](int x, int y, std::uint8_t r, std::uint8_t g, std::uint8_t b) {
			if (0 <= x && x < width && 0 <= y && y < height) {
				int p = (y * width + x) * 3;
				buf[p] = r;
				buf[p + 1] = g;
				buf[p + 2] = b;
			}
		};

		auto draw_horizontal_line = [&](int y, int start_x, int end_x, std::uint8_t r, std::uint8_t g, std::uint8_t b) {
			for (int x = start_x; x < end_x; ++x) {
				draw_point(x, y, r, g, b);
			}
		};

		auto draw_filled_rectangle =
			[&](int start_x, int start_y, int width, int height, std::uint8_t r, std::uint8_t g, std::uint8_t b) {
				for (int y = start_y; y < start_y + height; ++y) {
					draw_horizontal_line(y, start_x, start_x + width, r, g, b);
				}
			};

		for (int y = 0; y < height; ++y) {
			for (int x = 0; x < width; ++x) {
				draw_point(x, y, 0xff, 0, 0);
			}
		}

		draw_filled_rectangle(100, 100, 100 + (nr_frame % 100) * 5, 100 + (nr_frame % 100) * 5, 0, 0xff, 0);
	}
}

static Napi::Value Method(const Napi::CallbackInfo& info) {
	Napi::Env env = info.Env();

	const int width = 2000;
	const int height = 2000;
	const int framerate = 60;
	std::uint8_t* rgb_buf = static_cast<std::uint8_t*>(av_malloc(width * height * 3));

	try {
		Encoder encoder("test.mp4", width, height, framerate);
		encoder.init();

		for (int i = 0; i < framerate * 60 * 1; ++i) {
			create_frame_rgb(rgb_buf, width, height, i);
			encoder.add_frame(rgb_buf);
		}
		encoder.finish();
	} catch (std::exception& e) {
		return error(env, e.what());
	}

	av_free(rgb_buf);
	return Napi::String::New(env, "Hello, world from encoder");
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set(Napi::String::New(env, "hello"), Napi::Function::New(env, Method));
	return exports;
}

NODE_API_MODULE(hello, Init)
