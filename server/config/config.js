/**
 * IMPORTANT (PLEASE READ THIS):
 *
 * This is not the "configuration file" of mediasoup. This is the configuration
 * file of the mediasoup-demo app. mediasoup itself is a server-side library, it
 * does not read any "configuration file". Instead it exposes an API. This demo
 * application just reads settings from this file (once copied to config.js) and
 * calls the mediasoup API with those settings when appropriate.
 */

const os = require('os');

module.exports =
{
	// protocol service version
	version :  '0.1.37',
	// Listening hostname (just for `gulp live` task).
	domain : 'localhost',
	// Signaling settings (protoo WebSocket server and HTTP API server).
	https  :
	{
		listenIp   : '127.0.0.1',
		// NOTE: Don't change listenPort (client app assumes 4443).
		listenPort : 4000,
		// enablessl
		enableSsl  : false,
		// NOTE: Set your own valid certificate files.
		tls        :
		{
			cert : `${__dirname}/certs/mediasoup-demo.localhost.cert.pem`,
			key  : `${__dirname}/certs/mediasoup-demo.localhost.key.pem`
		}
	},
	// mediasoup settings.
	mediasoup :
	{
		// Number of mediasoup workers to launch.
		numWorkers     : Object.keys(os.cpus()).length,
		// mediasoup WorkerSettings.
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#WorkerSettings
		workerSettings :
		{
			logLevel : 'warn',
			logTags  :
			[
				'info',
				'ice',
				'dtls',
				'rtp',
				'srtp',
				'rtcp',
				'rtx',
				'bwe',
				'score',
				'simulcast',
				'svc',
				'sctp'
			],
			rtcMinPort : 40000,
			rtcMaxPort : 49999
		},
		// mediasoup Router options.
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#RouterOptions
		routerOptions :
		{
			mediaCodecs :
			[
				{
					kind      : 'audio',
					mimeType  : 'audio/opus',
					clockRate : 48000,
					channels  : 2
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP8',
					clockRate  : 90000,
					parameters :
					{
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/VP9',
					clockRate  : 90000,
					parameters :
					{
						'profile-id'             : 2,
						'x-google-start-bitrate' : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '4d0032',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				},
				{
					kind       : 'video',
					mimeType   : 'video/h264',
					clockRate  : 90000,
					parameters :
					{
						'packetization-mode'      : 1,
						'profile-level-id'        : '42e01f',
						'level-asymmetry-allowed' : 1,
						'x-google-start-bitrate'  : 1000
					}
				}
			]
		},
		// mediasoup WebRtcTransport options for WebRTC endpoints (mediasoup-client,
		// libmediasoupclient).
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#WebRtcTransportOptions
		webRtcTransportOptions :
		{
			listenIps :
			[
				{ ip: '172.28.100.38', announcedIp: null }
			],
			initialAvailableOutgoingBitrate : 1000000,
			minimumAvailableOutgoingBitrate : 600000,
			enableSctp                      : true,
			maxSctpMessageSize              : 262144,
			// Additional options that are not part of WebRtcTransportOptions.
			maxIncomingBitrate              : 1500000
		},
		// mediasoup PlainRtpTransport options for legacy RTP endpoints (FFmpeg,
		// GStreamer).
		// See https://mediasoup.org/documentation/v3/mediasoup/api/#PlainRtpTransportOptions
		plainRtpTransportOptions :
		{
			listenIp           : { ip: '192.168.1.123', announcedIp: null },
			enableSctp         : true,
			maxSctpMessageSize : 262144
		}
	}
};
