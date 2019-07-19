'use strict';
const schemeHelpers = require('./scheme_helpers.js').schemeHelpers;
exports.MonitorSubscriber = function (log) {

  var that = {},
    INTERVAL_STATS = 1000,
    MIN_RECOVER_BW = 50000,
    TICS_PER_TRANSITON = 10;


  /* BW Status
   * 0 - Stable
   * 1 - Insufficient Bandwidth
   * 2 - Trying recovery
   * 3 - Won't recover
   */
  var BW_STABLE = 0,
    BW_INSUFFICIENT = 1,
    BW_RECOVERING = 2,
    BW_WONTRECOVER = 3;

  var calculateAverage = function (values) {

    if (values === undefined)
      return 0;
    var cnt = values.length;
    var tot = parseInt(0);
    for (var i = 0; i < values.length; i++) {
      tot += parseInt(values[i]);
    }
    return Math.ceil(tot / cnt);
  };


  that.monitorMinVideoBw = function (mediaStream, callback) {
    mediaStream.bwValues = [];
    var tics = 0;
    var retries = 0;
    var ticsToTry = 0;
    var lastAverage, average, lastBWValue, toRecover;
    var nextRetry = 0;
    mediaStream.bwStatus = BW_STABLE;
    log.debug('message: Start mediaStream adapt scheme, ' +
      'id: ' + mediaStream.id + ', ' +
      'scheme: notify-break-recover, minVideoBW: ' + mediaStream.minVideoBW);

    mediaStream.minVideoBW = mediaStream.minVideoBW * 1000; // We need it in bps
    mediaStream.lowerThres = Math.floor(mediaStream.minVideoBW * (0.8));
    mediaStream.upperThres = Math.ceil(mediaStream.minVideoBW);
    mediaStream.monitorInterval = setInterval(() => {

      schemeHelpers.getBandwidthStat(mediaStream).then((bandwidth) => {
        if (mediaStream.slideShowMode) {
          return;
        }
        if (bandwidth) {
          lastBWValue = bandwidth;
          mediaStream.bwValues.push(lastBWValue);
          if (mediaStream.bwValues.length > 5) {
            mediaStream.bwValues.shift();
          }
          average = calculateAverage(mediaStream.bwValues);
        }
        toRecover = (average / 4) < MIN_RECOVER_BW ? (average / 4) : MIN_RECOVER_BW;
        switch (mediaStream.bwStatus) {
          case BW_STABLE:
            if (average <= lastAverage && (average < mediaStream.lowerThres)) {
              if (++tics > TICS_PER_TRANSITON) {
                log.debug('message: scheme state change, ' +
                  'id: ' + mediaStream.id + ', ' +
                  'previousState: BW_STABLE, ' +
                  'newState: BW_INSUFFICIENT, ' +
                  'averageBandwidth: ' + average + ', ' +
                  'lowerThreshold: ' + mediaStream.lowerThres);
                mediaStream.bwStatus = BW_INSUFFICIENT;
                mediaStream.setFeedbackReports(false, toRecover);
                tics = 0;
                callback({
                  type: 'bandwidthAlert',
                  message: 'insufficient',
                  bandwidth: average
                });
              }
            }
            break;
          case BW_INSUFFICIENT:
            if (average > mediaStream.upperThres) {
              log.info('message: scheme state change, ' +
                'id: ' + mediaStream.id + ', ' +
                'previousState: BW_INSUFFICIENT, ' +
                'newState: BW_STABLE, ' +
                'averageBandwidth: ' + average + ', ' +
                'lowerThreshold: ' + mediaStream.lowerThres);
              tics = 0;
              nextRetry = 0;
              retries = 0;
              mediaStream.bwStatus = BW_STABLE;
              mediaStream.setFeedbackReports(true, 0);
              callback({
                type: 'bandwidthAlert',
                message: 'recovered',
                bandwidth: average
              });
            } else if (retries >= 3) {
              log.info('message: scheme state change, ' +
                'id: ' + mediaStream.id + ', ' +
                'previousState: BW_INSUFFICIENT, ' +
                'newState: WONT_RECOVER, ' +
                'averageBandwidth: ' + average + ', ' +
                'lowerThreshold: ' + mediaStream.lowerThres);
              mediaStream.bwStatus = BW_WONTRECOVER;
            } else if (nextRetry === 0) { //schedule next retry
              nextRetry = tics + 20;
            } else if (++tics === nextRetry) { // next retry is in order
              mediaStream.bwStatus = BW_RECOVERING;
              ticsToTry = tics + 10;
              mediaStream.setFeedbackReports(false, average);
            }
            break;
          case BW_RECOVERING:
            log.info('message: trying to recover, ' +
              'id: ' + mediaStream.id + ', ' +
              'state: BW_RECOVERING, ' +
              'lastBandwidthValue: ' + lastBWValue + ', ' +
              'lastAverageBandwidth: ' + lastAverage + ', ' +
              'lowerThreshold: ' + mediaStream.lowerThres);
            if (average > mediaStream.upperThres) {
              log.info('message: recovered, ' +
                'id: ' + mediaStream.id + ', ' +
                'state: BW_RECOVERING, ' +
                'newState: BW_STABLE, ' +
                'averageBandwidth: ' + average + ', ' +
                'lowerThreshold: ' + mediaStream.lowerThres);
              tics = 0;
              nextRetry = 0;
              retries = 0;
              mediaStream.bwStatus = BW_STABLE;
              mediaStream.setFeedbackReports(true, 0);
              callback({
                type: 'bandwidthAlert',
                message: 'recovered',
                bandwidth: average
              });
            } else if (average > lastAverage) { //we are recovering
              log.info('message: bw improvement, ' +
                'id: ' + mediaStream.id + ', ' +
                'state: BW_RECOVERING, ' +
                'averageBandwidth: ' + average + ', ' +
                'lowerThreshold: ' + mediaStream.lowerThres);
              mediaStream.setFeedbackReports(false, average * (1 + 0.3));
              ticsToTry = tics + 10;

            } else if (++tics >= ticsToTry) { //finish this retry
              log.info('message: recovery tic passed, ' +
                'id: ' + mediaStream.id + ', ' +
                'state: BW_RECOVERING, ' +
                'numberOfRetries: ' + retries + ', ' +
                'averageBandwidth: ' + average + ', ' +
                'lowerThreshold: ' + mediaStream.lowerThres);
              ticsToTry = 0;
              nextRetry = 0;
              retries++;
              mediaStream.bwStatus = BW_INSUFFICIENT;
              mediaStream.setFeedbackReports(false, toRecover);
            }
            break;
          case BW_WONTRECOVER:
            log.info('message: Stop trying to recover, ' +
              'id: ' + mediaStream.id + ', ' +
              'state: BW_WONT_RECOVER, ' +
              'averageBandwidth: ' + average + ', ' +
              'lowerThreshold: ' + mediaStream.lowerThres);
            tics = 0;
            nextRetry = 0;
            retries = 0;
            average = 0;
            lastAverage = 0;
            mediaStream.bwStatus = BW_STABLE;
            mediaStream.minVideoBW = false;
            mediaStream.setFeedbackReports(false, 1);
            callback({
              type: 'bandwidthAlert',
              message: 'audio-only',
              bandwidth: average
            });
            break;
          default:
            log.error('message: Unknown BW status, id: ' + mediaStream.id);
        }
        lastAverage = average;
      }).catch((reason) => {
        clearInterval(mediaStream.monitorInterval);
        log.error('error getting stats: ' + reason);
      });
    }, INTERVAL_STATS);
  };

  return that.monitorMinVideoBw;
};