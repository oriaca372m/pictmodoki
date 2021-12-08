#pragma once

#include <cstdint>
#include <string>
#include <string_view>

extern "C" {
#include <libavcodec/avcodec.h>
#include <libavformat/avformat.h>
#include <libswscale/swscale.h>
}

struct Size final {
	unsigned int width;
	unsigned int height;
};

class Encoder final {
public:
	Encoder(std::string_view path, Size in_size, Size out_size, int framerate);
	~Encoder();

	void init();
	void add_frame(std::uint8_t* rgb_buf);
	void finish();

	std::size_t required_rgb_buf_size() const;

private:
	std::string path;
	Size in_size;
	Size out_size;
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
