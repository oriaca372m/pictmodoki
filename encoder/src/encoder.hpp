#pragma once

#include <cstdint>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>
}

class Encoder final {
public:
	Encoder(const char* path, int width, int height, int framerate);
	~Encoder();

	void init();
	void add_frame(std::uint8_t* rgb_buf);
	void finish();

private:
	const char* const path;
	const int width;
	const int height;
	const int framerate;

	AVIOContext* av_io_context = nullptr;
	AVFormatContext* fmt_ctx = nullptr;
	AVCodecContext* enc_ctx = nullptr;
	AVStream* stream = nullptr;
	AVFrame* frame_enc = nullptr;
	AVPacket* pkt = nullptr;
	SwsContext* sws_ctx = nullptr;

	int rgb_stride[8] = {};
	int current_frame = 0;

	void cleanup();
};
