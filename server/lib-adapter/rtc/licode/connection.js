/*global require, exports*/
'use strict';

const events = require('events');
const addon = require(process.env.LICODE_NODE_PATH);
const logger = require('../../utils/logger').logger;
const SessionDescription = require('./session_description');
const log = logger.getLogger('Connection');

const CONNECTION_INITIAL = 101,
  CONNECTION_STARTED = 102,
  CONNECTION_GATHERED = 103,
  CONNECTION_READY = 104,
  CONNECTION_CLOSED = 105,
  CONNECTION_CANDIDATE = 201,
  CONNECTION_SDP_PROCESSED = 202,
  CONNECTION_FAILED = 500;


class Connection extends events.EventEmitter {

  constructor(id, options = {}) {
    super();

    log.debug(`message: constructor, id: ${id}`);

    this.id = id;
    this.mediaConfiguration = 'default';
    this.mediaStreams = new Map(); // {id: stream}
    this.options = options;
    this.internal = options.internal;
    this.interface = options.interface;
    this.encrypt = options.encrypt;
    this.controlling = options.controlling || false;
    this.wrtc = this._createWrtc();
    this.initialized = false;
    this.metadata = this.options.metadata || {};
    this.isProcessingRemoteSdp = false;
    this.ready = false;
  }

  _getMediaConfiguration(mediaConfiguration = 'default') {
    if (global.mediaConfig && global.mediaConfig.codecConfigurations) {
      if (global.mediaConfig.codecConfigurations[mediaConfiguration]) {
        return JSON.stringify(global.mediaConfig.codecConfigurations[mediaConfiguration]);
      } else if (global.mediaConfig.codecConfigurations.default) {
        return JSON.stringify(global.mediaConfig.codecConfigurations.default);
      } else {
        log.warn(
          'message: Bad media config file. You need to specify a default codecConfiguration.'
        );
        return JSON.stringify({});
      }
    } else {
      log.warn(
        'message: Bad media config file. You need to specify a default codecConfiguration.'
      );
      return JSON.stringify({});
    }
  }

  _createWrtc() {
    var wrtc = new addon.WebRtcConnection(this.id,
      this._getMediaConfiguration(this.mediaConfiguration),
      global.config.minport,
      global.config.maxport,
      this.controlling,
      this.interface,
      this.encrypt);

    if (this.metadata) {
      wrtc.setMetadata(JSON.stringify(this.metadata));
    }
    return wrtc;
  }

  _createMediaStream(id, options = {}, isPublisher = true) {
    log.debug(`message: _createMediaStream, connectionId: ${this.id}, ` +
      `mediaStreamId: ${id}, isPublisher: ${isPublisher}`);

    const mediaStream = new addon.MediaStream(id,
      this.wrtc,
      options.label,
      isPublisher);

    mediaStream.id = id;
    mediaStream.label = options.label;

    if (options.metadata) {
      mediaStream.metadata = options.metadata;
      mediaStream.setMetadata(JSON.stringify(options.metadata));
    }

    mediaStream.onMediaStreamEvent((type, message) => {
      this._onMediaStreamEvent(type, message, mediaStream.id);
    });
    return mediaStream;
  }

  _onMediaStreamEvent(type, message, mediaStreamId) {
    let streamEvent = {
      type: type,
      mediaStreamId: mediaStreamId,
      message: message,
    };
    this.emit('media_stream_event', streamEvent);
  }

  _maybeSendAnswer(streamId) {

    this.wrtc.localDescription = new SessionDescription(this.wrtc.getLocalDescription());
    const sdp = this.wrtc.localDescription.getSdp(this.sessionVersion++);
    let message = sdp.toString();

    let privateRegexp, publicIp;

    if (this.options.privateRegexp) {
      privateRegexp = this.options.privateRegexp;
      publicIp = this.options.publicIp;
    } else if (global.config.privateRegexp) {
      privateRegexp = global.config.privateRegexp;
      publicIp = global.config.publicIp;
    }

    if (privateRegexp && !this.internal) {
      message = message.replace(privateRegexp, publicIp);
    }

    const info = {
      type: this.options.createOffer ? 'offer' : 'answer',
      sdp: message
    };

    log.debug(`message: _maybeSendAnswer sending event, type: ${info.type}, streamId: ${streamId}`);

    this.emit('connection_event', info, streamId);
  }

  init(streamId) {
    if (this.initialized) {
      return false;
    }

    const firstStreamId = streamId;
    this.initialized = true;

    log.debug(`message: Init Connection, connectionId: ${this.id} ` +
      `${logger.objectToLog(this.options)}`);

    this.sessionVersion = 0;

    this.wrtc.init((status, mess, streamId) => {

      log.debug('message: WebRtcConnection status update, ' +
        'id: ' + this.id + ', status: ' + status +
        ', ' + logger.objectToLog(this.metadata));

      switch (status) {
        case CONNECTION_INITIAL:
          this.emit('connection_event', {
            type: 'init'
          });
          break;

        case CONNECTION_STARTED:
          this.emit('connection_event', {
            type: 'started'
          });
          break;

        case CONNECTION_SDP_PROCESSED:
          this._maybeSendAnswer(streamId);
          break;

        case CONNECTION_GATHERED:
          this.alreadyGathered = true;
          this._maybeSendAnswer(firstStreamId);
          break;

        case CONNECTION_CANDIDATE:

          let privateRegexp, publicIp;

          if (this.options.privateRegexp) {
            privateRegexp = this.options.privateRegexp;
            publicIp = this.options.privateRegexp;
          } else if (global.config.privateRegexp) {
            privateRegexp = global.config.privateRegexp;
            publicIp = global.config.publicIp;
          }

          if (privateRegexp && !this.internal) {
            this.emit('connection_event', {
              type: 'candidate',
              candidate: mess
            });
            mess = mess.replace(/2013266431/g, '2013266430');
            mess = mess.replace(privateRegexp, publicIp);
          }

          this.emit('connection_event', {
            type: 'candidate',
            candidate: mess
          });
          break;

        case CONNECTION_READY:
          log.debug('message: connection ready, ' + 'id: ' + this.id +
            ', ' + 'status: ' + status);
          this.ready = true;
          this.emit('connection_event', {
            type: 'ready'
          });
          break;

        case CONNECTION_FAILED:
          log.warn('message: failed the ICE process, ' + 'code: ' + CONNECTION_FAILED +
            ', id: ' + this.id);
          this.emit('connection_event', {
            type: 'failed',
            sdp: mess
          });
          break;
      }
    });

    if (this.options.createOffer) {
      log.debug('message: create offer requested, id:', this.id);

      const audioEnabled = this.options.createOffer.audio;
      const videoEnabled = this.options.createOffer.video;
      const bundle = this.options.createOffer.bundle;

      this.wrtc.createOffer(videoEnabled, audioEnabled, bundle);
    }

    return true;
  }

  addMediaStream(id, options, isPublisher) {
    log.debug(`message: addMediaStream, connectionId: ${this.id}, mediaStreamId: ${id}`);

    if (this.mediaStreams.get(id) === undefined) {
      const mediaStream = this._createMediaStream(id, options, isPublisher);
      this.wrtc.addMediaStream(mediaStream);
      this.mediaStreams.set(id, mediaStream);
    }
  }

  removeMediaStream(id) {
    if (this.mediaStreams && (this.mediaStreams.get(id) !== undefined)) {

      this.wrtc.removeMediaStream(id);
      this.mediaStreams.get(id).close();
      this.mediaStreams.delete(id);

      log.debug(`removed mediaStreamId ${id}, remaining size ${this.getNumMediaStreams()}`);

    } else {
      log.warn(`message: Trying to remove mediaStream not found, id: ${id}`);
    }
  }

  setRemoteDescription(sdp, streamId) {
    this.isProcessingRemoteSdp = true;
    this.remoteDescription = new SessionDescription(sdp, this.mediaConfiguration);
    this.wrtc.setRemoteDescription(this.remoteDescription.connectionDescription, streamId);
  }

  addRemoteCandidate(candidate) {
    this.wrtc.addRemoteCandidate(candidate.sdpMid, candidate.sdpMLineIndex, candidate.candidate);
  }

  getMediaStream(id) {
    return this.mediaStreams.get(id);
  }

  getNumMediaStreams() {
    return this.mediaStreams.size;
  }

  close() {
    log.debug(`message: Closing connection ${this.id}`);

    log.debug(`message: WebRtcConnection status update, id: ${this.id}, status: ${CONNECTION_CLOSED}, ` +
      `${logger.objectToLog(this.metadata)}`);

    this.mediaStreams.forEach((mediaStream, id) => {

      log.debug(`message: Closing mediaStream, connectionId : ${this.id}, ` +
        `mediaStreamId: ${id}`);

      mediaStream.close();
    });

    this.wrtc.close();

    delete this.mediaStreams;
    delete this.wrtc;
  }

}

exports.Connection = Connection;