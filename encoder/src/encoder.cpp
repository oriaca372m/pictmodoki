#include "encoder.hpp"

#include <fmt/core.h>

#include <stdexcept>

namespace {
	std::string averr_to_string(int errnum) {
		char buf[AV_ERROR_MAX_STRING_SIZE];
		return av_make_error_string(buf, AV_ERROR_MAX_STRING_SIZE, errnum);
	}

	void encode(AVCodecContext* enc_ctx, AVFormatContext* fmt_ctx, AVStream* stream, AVFrame* frame, AVPacket* pkt) {
		if (frame != nullptr) {
			fmt::print("Send frame {}\n", frame->pts);
		}

		auto ret = avcodec_send_frame(enc_ctx, frame);
		if (ret < 0) {
			throw std::runtime_error("Error sending a frame for encoding");
		}

		while (ret >= 0) {
			ret = avcodec_receive_packet(enc_ctx, pkt);
			if (ret == AVERROR(EAGAIN) || ret == AVERROR_EOF) {
				return;
			} else if (ret < 0) {
				throw std::runtime_error("Error during encoding");
			}

			pkt->stream_index = 0;
			av_packet_rescale_ts(pkt, enc_ctx->time_base, stream->time_base);
			if (av_interleaved_write_frame(fmt_ctx, pkt) != 0) {
				throw std::runtime_error("Error during writing frame");
			}
			fmt::print("Write packet {} (size={})\n", pkt->pts, pkt->size);
			av_packet_unref(pkt);
		}
	}
}

Encoder::Encoder(const char* path, int width, int height, int framerate) :
	path(path), width(width), height(height), framerate(framerate) {
	rgb_stride[0] = width * 3;
};

Encoder::~Encoder() {
	cleanup();
}

void Encoder::cleanup() {
	avio_closep(&av_io_context);
	if (fmt_ctx != nullptr) {
		avformat_free_context(fmt_ctx);
		fmt_ctx = nullptr;
	}

	if (enc_ctx != nullptr) {
		avcodec_free_context(&enc_ctx);
	}

	if (frame_enc != nullptr) {
		av_frame_free(&frame_enc);
	}

	if (pkt != nullptr) {
		av_packet_free(&pkt);
	}

	sws_freeContext(sws_ctx);
	sws_ctx = nullptr;
}

void Encoder::init() {
	if (avio_open(&av_io_context, path, AVIO_FLAG_WRITE) < 0) {
		cleanup();
		throw std::runtime_error("Could not open AVIOContext");
	}

	if (avformat_alloc_output_context2(&fmt_ctx, nullptr, nullptr, path) < 0) {
		cleanup();
		throw std::runtime_error("Could not create output context");
	}
	fmt_ctx->pb = av_io_context;

	auto encoder = avcodec_find_encoder(AV_CODEC_ID_H264);
	if (encoder == nullptr) {
		cleanup();
		throw std::runtime_error("Necessary encoder not found");
	}

	enc_ctx = avcodec_alloc_context3(encoder);
	if (enc_ctx == nullptr) {
		cleanup();
		throw std::runtime_error("Could not allocate the encoder context");
	}

	enc_ctx->bit_rate = 400000;
	enc_ctx->width = width;
	enc_ctx->height = height;
	enc_ctx->time_base = AVRational{1, framerate};
	enc_ctx->framerate = AVRational{framerate, 1};
	enc_ctx->gop_size = 10;
	enc_ctx->max_b_frames = 1;
	enc_ctx->pix_fmt = AV_PIX_FMT_YUV420P;

	if (fmt_ctx->oformat->flags & AVFMT_GLOBALHEADER) {
		enc_ctx->flags |= AV_CODEC_FLAG_GLOBAL_HEADER;
	}

	AVDictionary* codec_options = nullptr;
	av_dict_set(&codec_options, "preset", "veryfast", 0);
	av_dict_set(&codec_options, "tune", "animation", 0);

	auto ret = avcodec_open2(enc_ctx, encoder, &codec_options);
	if (ret < 0) {
		cleanup();
		throw std::runtime_error(fmt::format("Could not open codec: {}", averr_to_string(ret)));
	}

	stream = avformat_new_stream(fmt_ctx, encoder);
	if (stream == nullptr) {
		cleanup();
		throw std::runtime_error("avformat_new_stream failed");
	}
	stream->sample_aspect_ratio = enc_ctx->sample_aspect_ratio;
	stream->time_base = enc_ctx->time_base;
	if (avcodec_parameters_from_context(stream->codecpar, enc_ctx) < 0) {
		cleanup();
		throw std::runtime_error("avcodec_parameters_from_context failed");
	}

	if (avformat_write_header(fmt_ctx, nullptr) < 0) {
		cleanup();
		throw std::runtime_error("avformat_write_header failed");
	}

	// エンコード用のフレーム
	frame_enc = av_frame_alloc();
	if (frame_enc == nullptr) {
		cleanup();
		throw std::runtime_error("Could not allocate video frame");
	}

	frame_enc->format = enc_ctx->pix_fmt;
	frame_enc->width = enc_ctx->width;
	frame_enc->height = enc_ctx->height;

	ret = av_frame_get_buffer(frame_enc, 0);
	if (ret < 0) {
		cleanup();
		throw std::runtime_error("Could not allocate the video frame data");
	}

	pkt = av_packet_alloc();
	if (pkt == nullptr) {
		cleanup();
		throw std::runtime_error("Could not allocate a packet");
	}

	sws_ctx = sws_getContext(
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
	if (sws_ctx == nullptr) {
		cleanup();
		throw std::runtime_error("Could not get SwsContext");
	}
}

void Encoder::add_frame(std::uint8_t* rgb_buf) {
	auto ret = av_frame_make_writable(frame_enc);
	if (ret < 0) {
		throw std::runtime_error("Could not make a encode frame writable");
	}

	sws_scale(sws_ctx, &rgb_buf, rgb_stride, 0, height, frame_enc->data, frame_enc->linesize);

	frame_enc->pts = current_frame;
	encode(enc_ctx, fmt_ctx, stream, frame_enc, pkt);
	++current_frame;
}

void Encoder::finish() {
	try {
		encode(enc_ctx, fmt_ctx, stream, nullptr, pkt);
	} catch (...) {
		cleanup();
		throw;
	}

	if (av_write_trailer(fmt_ctx) != 0) {
		cleanup();
		throw std::runtime_error("av_write_trailer failed");
	}

	cleanup();
}
