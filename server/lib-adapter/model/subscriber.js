/*global require, exports*/
'use strict';

const NodeClass = require('./node').Node;
var SemanticSdp = require('../rtc/licode/semantic_sdp');

// Logger
const logger = require('./../utils/logger').logger;
const log = logger.getLogger('Subscriber');


class Subscriber extends NodeClass {
    constructor(clientId, streamId, connection, publisher, options) {
        super(clientId, streamId, options);

        this.connection = connection;
        this.connection.mediaConfiguration = options.mediaConfiguration;
        this.connection.addMediaStream(this.erizoStreamId, options, false);

        this._connectionListener = this._emitConnectionEvent.bind(this);
        this._mediaStreamListener = this._onMediaStreamEvent.bind(this);
        connection.on('connection_event', this._connectionListener);
        connection.on('media_stream_event', this._mediaStreamListener);

        this.mediaStream = connection.getMediaStream(this.erizoStreamId);
        this.publisher = publisher;
        this.ready = false;
        this.connectionReady = connection.ready;
    }

    _emitConnectionEvent(evt, streamId) {

        const isGlobalStatus = streamId === undefined || streamId === '';
        const isNotMe = !isGlobalStatus && (streamId + '') !== (this.erizoStreamId + '');

        if (isNotMe) {
            log.debug('onStatusEvent dropped in publisher', streamId, this.erizoStreamId);
            return;
        }

        if (evt.type === 'ready') {
            if (this.connectionReady) {
                return;
            }
            this.connectionReady = true;

            if (!(this.ready && this.connectionReady)) {
                log.debug('ready event dropped in publisher', this.ready, this.connectionReady);
                return;
            }
        }

        if (evt.type === 'answer' || evt.type === 'offer') {
            if (!this.ready && this.connectionReady) {
                const readyEvent = {
                    type: 'ready'
                };
                this._onConnectionEvent(readyEvent);
                this.emit('connection_event', readyEvent);
            }
            this.ready = true;
        }

        this._onConnectionEvent(evt);
        this.emit('connection_event', evt);
    }

    _onConnectionEvent(connectionEvent) {
        if (connectionEvent.type === 'ready') {
            if (this.clientId && this.options.browser === 'bowser') {
                this.publisher.requestVideoKeyFrame();
            }
            if (this.options.slideShowMode === true ||
                Number.isSafeInteger(this.options.slideShowMode)) {
                this.publisher.setSlideShow(this.options.slideShowMode, this.clientId);
            }
        }
    }

    _onMediaStreamEvent(mediaStreamEvent) {
        if (mediaStreamEvent.type === 'slideshow_fallback_update') {
            this.publisher.setSlideShow(mediaStreamEvent.message ===
                'false' ? false : true, this.clientId, true);
        }
    }

    disableDefaultHandlers() {
        // const disabledHandlers = global.config.erizo.disabledHandlers;
        // for (const index in disabledHandlers) {
        //   this.mediaStream.disableHandler(disabledHandlers[index]);
        // }
    }

    onSignalingMessage(msg, publisher) {
        let connection = this.connection;

        if (msg.type === 'sdp') {

            const sdp = SemanticSdp.SDPInfo.processString(msg.sdp);
            connection.setRemoteDescription(sdp, this.erizoStreamId);

            if (msg.config && msg.config.maxVideoBW) {
                this.mediaStream.setMaxVideoBW(msg.config.maxVideoBW);
            }

        } else if (msg.type === 'candidate') {

            connection.addRemoteCandidate(msg.candidate);

        } else if (msg.type === 'updatestream') {

            if (msg.sdp) {
                const sdp = SemanticSdp.SDPInfo.processString(msg.sdp);
                connection.setRemoteDescription(sdp, this.erizoStreamId);
            }

            if (msg.config) {
                if (msg.config.slideShowMode !== undefined) {
                    this.publisher.setSlideShow(msg.config.slideShowMode, this.clientId);
                }
                if (msg.config.muteStream !== undefined) {
                    this.publisher.muteStream(msg.config.muteStream, this.clientId);
                }
                if (msg.config.qualityLayer !== undefined) {
                    this.publisher.setQualityLayer(msg.config.qualityLayer, this.clientId);
                }
                if (msg.config.minLayer !== undefined) {
                    this.publisher.setMinSpatialLayer(msg.config.minLayer, this.clientId);
                }
                if (msg.config.video !== undefined) {
                    this.publisher.setVideoConstraints(msg.config.video, this.clientId);
                }
                if (msg.config.maxVideoBW) {
                    log.debug(`Subscriber set max bandwidth ${msg.config.maxVideoBW}`);
                    this.mediaStream.setMaxVideoBW(msg.config.maxVideoBW);
                }
                if (msg.config.disableHandlers) {
                    this.disableSelfHandlers(msg.config.disableHandlers);
                }
            }
        } else if (msg.type === 'control') {
            publisher.processControlMessage(this.clientId, msg.action);
        }
    }

    close() {
        log.debug(`msg: Closing subscriber, streamId:${this.streamId}`);
        this.publisher = undefined;
        if (this.connection) {
            this.connection.removeMediaStream(this.mediaStream.id);
            this.connection.removeListener('connection_event', this._connectionListener);
            this.connection.removeListener('media_stream_event', this._mediaStreamListener);

        }
        if (this.mediaStream && this.mediaStream.monitorInterval) {
            clearInterval(this.mediaStream.monitorInterval);
        }
    }

    disableSelfHandlers(disabledHandlers) {
        if (!this.mediaStream) {
            return;
        }
        for (const index in disabledHandlers) {
            this.mediaStream.disableHandler(disabledHandlers[index]);
        }
    }
}

exports.Subscriber = Subscriber;