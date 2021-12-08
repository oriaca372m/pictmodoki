#include <napi.h>

#include <fmt/core.h>

#include <boost/scope_exit.hpp>

#include <cstdint>
#include <fstream>
#include <ostream>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libavutil/imgutils.h>
#include <libswscale/swscale.h>
}

namespace {
	Napi::Value error(const Napi::Env& env, const char* msg) {
		Napi::Error::New(env, msg).ThrowAsJavaScriptException();
		return env.Undefined();
	}

	Napi::Value error(const Napi::Env& env, const std::string& msg) {
		return error(env, msg.c_str());
	}

	std::string averr_to_string(int errnum) {
		char buf[AV_ERROR_MAX_STRING_SIZE];
		return av_make_error_string(buf, AV_ERROR_MAX_STRING_SIZE, errnum);
	}

	bool encode(AVCodecContext* enc_ctx, AVFormatContext* fmt_ctx, AVStream* stream, AVFrame* frame, AVPacket* pkt) {
		if (frame != nullptr) {
			fmt::print("Send frame {}" PRId64 "\n", frame->pts);
		}

		auto ret = avcodec_send_frame(enc_ctx, frame);
		if (ret < 0) {
			fmt::print(stderr, "Error sending a frame for encoding\n");
			return false;
		}

		while (ret >= 0) {
			ret = avcodec_receive_packet(enc_ctx, pkt);
			if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
				return true;
			} else if (ret < 0) {
				fmt::print(stderr, "Error during encoding\n");
				return false;
			}

			pkt->stream_index = 0;
			av_packet_rescale_ts(pkt, enc_ctx->time_base, stream->time_base);
			if (av_interleaved_write_frame(fmt_ctx, pkt) != 0) {
				fmt::print(stderr, "Error during writing frame\n");
				return false;
			}
			fmt::print("Write packet {}" PRId64 " (size={})\n", pkt->pts, pkt->size);
			av_packet_unref(pkt);
		}
		return true;
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

	const int width = 1024;
	const int height = 1024;

	AVIOContext* av_io_context = nullptr;
	if (avio_open(&av_io_context, "test.mp4", AVIO_FLAG_WRITE) < 0) {
		return error(env, "Could not open AVIOContext");
	}
	BOOST_SCOPE_EXIT_ALL(&av_io_context) {
		avio_closep(&av_io_context);
	};

	AVFormatContext* fmt_ctx = nullptr;
	if (avformat_alloc_output_context2(&fmt_ctx, nullptr, "mp4", nullptr) < 0) {
		return error(env, "Could not create output context");
	}
	BOOST_SCOPE_EXIT_ALL(&fmt_ctx) {
		avformat_free_context(fmt_ctx);
	};
	fmt_ctx->pb = av_io_context;

	auto encoder = avcodec_find_encoder(AV_CODEC_ID_H264);
	if (encoder == nullptr) {
		return error(env, "Necessary encoder not found");
	}

	auto enc_ctx = avcodec_alloc_context3(encoder);
	if (enc_ctx == nullptr) {
		return error(env, "Could not allocate the encoder context");
	}
	BOOST_SCOPE_EXIT_ALL(&enc_ctx) {
		avcodec_free_context(&enc_ctx);
	};

	enc_ctx->bit_rate = 400000;
	enc_ctx->width = width;
	enc_ctx->height = height;
	enc_ctx->time_base = (AVRational){1, 25};
	enc_ctx->framerate = (AVRational){25, 1};
	enc_ctx->gop_size = 10;
	enc_ctx->max_b_frames = 1;
	enc_ctx->pix_fmt = AV_PIX_FMT_YUV420P;

	if (fmt_ctx->oformat->flags & AVFMT_GLOBALHEADER) {
		enc_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
	}

	auto ret = avcodec_open2(enc_ctx, encoder, nullptr);
	if (ret < 0) {
		return error(env, fmt::format("Could not open codec: {}", averr_to_string(ret)));
	}

	auto stream = avformat_new_stream(fmt_ctx, encoder);
	if (stream == nullptr) {
		return error(env, "avformat_new_stream failed");
	}
	stream->sample_aspect_ratio = enc_ctx->sample_aspect_ratio;
	stream->time_base = enc_ctx->time_base;
	if (avcodec_parameters_from_context(stream->codecpar, enc_ctx) < 0) {
		return error(env, "avcodec_parameters_from_context failed");
	}

	if (avformat_write_header(fmt_ctx, nullptr) < 0) {
		return error(env, "avformat_write_header failed");
	}

	// rgb用のフレーム
	std::uint8_t* rgb_buf = static_cast<std::uint8_t*>(av_malloc(width * height * 3));
	BOOST_SCOPE_EXIT_ALL(&rgb_buf) {
		av_free(rgb_buf);
	};

	// エンコード用のフレーム
	auto frame_enc = av_frame_alloc();
	if (frame_enc == nullptr) {
		return error(env, "Could not allocate video frame");
	}
	BOOST_SCOPE_EXIT_ALL(&frame_enc) {
		av_frame_free(&frame_enc);
	};

	frame_enc->format = enc_ctx->pix_fmt;
	frame_enc->width = enc_ctx->width;
	frame_enc->height = enc_ctx->height;

	ret = av_frame_get_buffer(frame_enc, 0);
	if (ret < 0) {
		return error(env, "Could not allocate the video frame data");
	}

	auto pkt = av_packet_alloc();
	if (pkt == nullptr) {
		return error(env, "Could not allocate a packet");
	}
	BOOST_SCOPE_EXIT_ALL(&pkt) {
		av_packet_free(&pkt);
	};

	auto sws_ctx = sws_getContext(
		width,
		height,
		AV_PIX_FMT_RGB24,
		enc_ctx->width,
		enc_ctx->height,
		enc_ctx->pix_fmt,
		SWS_BICUBIC,
		nullptr,
		nullptr,
		nullptr);

	int rgb_stride[8] = {width * 3, 0, 0, 0, 0, 0, 0, 0};

	for (int i = 0; i < 25 * 60 * 5; ++i) {
		create_frame_rgb(rgb_buf, width, height, i);

		ret = av_frame_make_writable(frame_enc);
		if (ret < 0) {
			return error(env, "Could not make a encode frame writable");
		}

		sws_scale(sws_ctx, &rgb_buf, rgb_stride, 0, height, frame_enc->data, frame_enc->linesize);

		frame_enc->pts = i;
		if (!encode(enc_ctx, fmt_ctx, stream, frame_enc, pkt)) {
			return error(env, "failed to encode a frame");
		}
	}
	if (!encode(enc_ctx, fmt_ctx, stream, nullptr, pkt)) {
		return error(env, "failed to encode a frame");
	}

	if (av_write_trailer(fmt_ctx) != 0) {
		return error(env, "av_write_trailer failed");
	}

	return Napi::String::New(env, "Hello, world from encoder");
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
	exports.Set(Napi::String::New(env, "hello"), Napi::Function::New(env, Method));
	return exports;
}

NODE_API_MODULE(hello, Init)
