/*global require, exports*/
'use strict';

const EventEmitter = require('events').EventEmitter;
const Helpers = require('../rtc/licode/helpers');
const logger = require('../utils/logger').logger;

const log = logger.getLogger('Node');

const WARN_PRECOND_FAILED = 412;


class Node extends EventEmitter {
  constructor(clientId, streamId, options = {}) {
    super();
    this.clientId = clientId;
    this.streamId = streamId;
    this.label = options.label;
    this.erizoStreamId = Helpers.getErizoStreamId(clientId, streamId);
    this.options = options;
  }

  getStats(label, stats) {
    const promise = new Promise((resolve) => {
      if (!this.mediaStream || !this.connection) {
        resolve();
        return;
      }
      this.mediaStream.getStats((statsString) => {
        const unfilteredStats = JSON.parse(statsString);
        unfilteredStats.metadata = this.connection.metadata;
        stats[label] = unfilteredStats;
        resolve();
      });
    });
    return promise;
  }

  _onMonitorMinVideoBWCallback(message) {
    this.emit(message.type, message);
  }

  initMediaStream() {
    if (!this.mediaStream) {
      return;
    }
    const mediaStream = this.mediaStream;
    if (mediaStream.minVideoBW) {
      var monitorMinVideoBw = {};
      if (mediaStream.scheme) {
        try {
          monitorMinVideoBw = require('../adapt_schemes/' + mediaStream.scheme)
            .MonitorSubscriber(log);
        } catch (e) {

          log.warn('message: could not find custom adapt scheme, ' +
            'code: ' + WARN_PRECOND_FAILED + ', ' +
            'id:' + this.clientId + ', ' +
            'scheme: ' + mediaStream.scheme + ', ' +
            logger.objectToLog(this.options.metadata));

        }
      } else {
        monitorMinVideoBw = require('../rtc/licode/adapt_schemes/notify').MonitorSubscriber(log);
      }
      monitorMinVideoBw(mediaStream, this._onMonitorMinVideoBWCallback.bind(this));
    }

    //todo(cc): add a flag
    if (false) { // jshint ignore:line

      log.debug('message: RTCP Stat collection is active');

      mediaStream.getPeriodicStats((newStats) => {
        this.emit('periodic_stats', newStats);
      });
    }
  }
}

exports.Node = Node;