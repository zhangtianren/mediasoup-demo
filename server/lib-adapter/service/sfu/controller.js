'use strict';

var Client = require('../../model/client').Client;
var Publisher = require('../../model/publisher').Publisher;

// Logger
var logger = require('../../utils/logger').logger;
var log = logger.getLogger('Controller');


exports.Controller = function () {

  let that = {},
    // {streamId1: Publisher, streamId2: Publisher}
    publishers = {},
    // {clientId: Client}
    clients = new Map(),
    onAdaptSchemeNotify,
    onPeriodicStats,
    onConnectionEvent,
    closeNode,
    getOrCreateClient,

    WARN_NOT_FOUND = 404,
    WARN_CONFLICT = 409;

  that.publishers = publishers;

  getOrCreateClient = (clientId) => {
    log.debug(`getOrCreateClient with id ${clientId}`);

    let client = clients.get(clientId);
    if (client === undefined) {
      client = new Client(clientId);
      clients.set(clientId, client);
    }
    return client;
  };

  onAdaptSchemeNotify = (callbackRpc, message) => {
    callbackRpc(message);
  };

  onPeriodicStats = (clientId, streamId, newStats) => {
    var timeStamp = new Date();
    log.debug({
      pub: streamId,
      subs: clientId,
      stats: JSON.parse(newStats),
      timestamp: timeStamp.getTime()
    });
  };

  onConnectionEvent = (callbackRpc, connectionEvent) => {
    callbackRpc(connectionEvent);
  };

  closeNode = (node) => {
    const clientId = node.clientId;
    const connection = node.connection;
    log.debug(`closeNode, clientId: ${node.clientId}, streamId: ${node.streamId}`);

    node.close();

    let client = clients.get(clientId);
    if (client === undefined) {
      log.warn(`trying to close node with no associated client,` +
        `clientId: ${clientId}, streamId: ${node.streamId}`);

      return;
    }

    let remainingConnections = client.maybeCloseConnection(connection.id);
    if (remainingConnections === 0) {
      log.debug(`Removing empty client from list, clientId: ${client.id}`);

      clients.delete(client.id);
    }
  };

  that.processSignaling = function (clientId, streamId, msg) {
    log.debug('Process Signaling message, ' +
      'streamId: ' + streamId + ', clientId: ' + clientId);

    if (publishers[streamId] !== undefined) {
      let publisher = publishers[streamId];
      if (publisher.hasSubscriber(clientId)) {
        let subscriber = publisher.getSubscriber(clientId);
        subscriber.onSignalingMessage(msg);
      } else {
        publisher.onSignalingMessage(msg);
      }
    }
  };

  /*
   * Adds a publisher to the room. This creates a new OneToManyProcessor
   * and a new WebRtcConnection. This WebRtcConnection will be the publisher
   * of the OneToManyProcessor.
   */
  that.addPublisher = function (clientId, streamId, options, callbackRpc) {
    log.info(`+++++++++++ addPublisher, clientId, ${clientId}, streamId, ${streamId} +++++++++++`);

    let publisher = publishers[streamId];
    if (publisher) {
      if (publisher.numSubscribers === 0) {
        log.warn('publisher already set, has no subscribers, ' +
          'code: ' + WARN_CONFLICT + ', streamId: ' + streamId + ', will republish');
      } else {
        log.warn('publisher already set, has subscribers,  ' +
          'code: ' + WARN_CONFLICT + ', streamId: ' + streamId + ', will republish');
      }

      that.removePublisher(clientId, streamId);
    }

    // options.publicIp = that.publicIp;
    // options.privateRegexp = that.privateRegexp;
    let client = getOrCreateClient(clientId);
    let connection = client.getOrCreateConnection(options);

    log.debug('Adding publisher, ' +
      'clientId: ' + clientId + ', ' +
      'streamId: ' + streamId + ', ' +
      logger.objectToLog(options) + ', ' +
      logger.objectToLog(options.metadata));

    publisher = new Publisher(clientId, streamId, connection, options);
    publishers[streamId] = publisher;
    publisher.initMediaStream();

    publisher.on('bandwidthAlert', onAdaptSchemeNotify.bind(this, callbackRpc));
    publisher.on('scheme-slideshow-change', onAdaptSchemeNotify.bind(this, callbackRpc));
    publisher.on('periodic_stats', onPeriodicStats.bind(this, streamId, undefined));
    publisher.on('connection_event', onConnectionEvent.bind(this, callbackRpc));

    connection.init(streamId);
  };

  /*
   * Adds a subscriber to the room. This creates a new WebRtcConnection.
   * This WebRtcConnection will be added to the subscribers list of the
   * OneToManyProcessor.
   */
  that.addSubscriber = function (clientId, streamId, options, callbackRpc) {
    const publisher = publishers[streamId];
    if (publisher === undefined || publisher.isClosing) {
      log.warn('addSubscriber to unknown publisher, ' +
        'code: ' + WARN_NOT_FOUND + ', streamId: ' + streamId +
        ', clientId: ' + clientId +
        ', ' + logger.objectToLog(options.metadata));

      //We may need to notify the clients
      return;
    }

    let subscriber = publisher.getSubscriber(clientId);
    const client = getOrCreateClient(clientId);
    if (subscriber !== undefined) {
      log.warn('duplicated subscription will resubscribe, ' +
        'code: ' + WARN_CONFLICT + ', streamId: ' + streamId +
        ', clientId: ' + clientId +
        ', ' + logger.objectToLog(options.metadata));

      that.removeSubscriber(clientId, streamId);
    }

    // options.publicIp = that.publicIp;
    // options.privateRegexp = that.privateRegexp;
    let connection = client.getOrCreateConnection(options);
    options.label = publisher.label;

    subscriber = publisher.addSubscriber(clientId, connection, options);
    subscriber.initMediaStream();

    subscriber.on('bandwidthAlert', onAdaptSchemeNotify.bind(this, callbackRpc));
    subscriber.on('scheme-slideshow-change', onAdaptSchemeNotify.bind(this, callbackRpc));
    subscriber.on('periodic_stats', onPeriodicStats.bind(this, clientId, streamId));
    subscriber.on('connection_event', onConnectionEvent.bind(this, callbackRpc));

    connection.init(subscriber.erizoStreamId);
  };

  /*
   * Removes a publisher from the room. This also deletes the associated OneToManyProcessor.
   */
  that.removePublisher = function (clientId, streamId) {
    var publisher = publishers[streamId];

    if (publisher !== undefined) {
      log.info(`============= Removing publisher, id: ${clientId}, streamId: ${streamId} =============`);

      publisher.isClosing = true;
      for (let subscriberKey in publisher.subscribers) {
        log.debug('Removing subscriber, id: ' + subscriberKey);

        let subscriber = publisher.getSubscriber(subscriberKey);
        closeNode(subscriber);
        publisher.removeSubscriber(subscriberKey);
      }

      closeNode(publisher);
      delete publishers[streamId];

      publisher.muxer.close(function (message) {
        log.debug('muxer closed succesfully, ' +
          'id: ' + streamId + ', ' +
          logger.objectToLog(message));

        var count = 0;
        for (var k in publishers) {
          if (publishers.hasOwnProperty(k)) {
            ++count;
          }
        }
        log.debug('remaining publishers, publisherCount: ' + count);
      });

    } else {
      log.warn('removePublisher that does not exist, ' +
        'code: ' + WARN_NOT_FOUND + ', id: ' + streamId);
    }
  }

  /*
   * Removes a subscriber from the room.
   * This also removes it from the associated OneToManyProcessor.
   */
  that.removeSubscriber = function (clientId, streamId) {
    const publisher = publishers[streamId];

    if (publisher && !publisher.isClosing && publisher.hasSubscriber(clientId)) {
      let subscriber = publisher.getSubscriber(clientId);

      log.info(`removing subscriber, id: ${clientId}`);

      closeNode(subscriber);
      publisher.removeSubscriber(clientId);
    }
  };

  /*
   * Removes all the subscribers related with a client.
   */
  that.removeSubscriptions = function (clientId) {
    log.info('removing subscriptions, clientId:', clientId);
    // we go through all the connections in the client and we close them
    for (var to in publishers) {
      if (publishers.hasOwnProperty(to)) {
        var publisher = publishers[to];
        var subscriber = publisher.getSubscriber(clientId);
        if (subscriber) {
          log.debug('removing subscription, ' +
            'id:', subscriber.clientId);

          closeNode(subscriber);
          publisher.removeSubscriber(clientId);
        }
      }
    }
  };

  that.getStreamStats = function (streamId, callbackRpc) {
    log.debug('Requested stream stats, streamID: ' + streamId);

    var stats = {};
    var publisher;
    var promises = [];
    if (streamId && publishers[streamId]) {
      publisher = publishers[streamId];
      promises.push(publisher.getStats('publisher', stats));
      for (var sub in publisher.subscribers) {
        promises.push(publisher.subscribers[sub].getStats(sub, stats));
      }
      Promise.all(promises).then(() => {
        callbackRpc(stats);
      });
    }
  };

  that.subscribeToStats = function (streamId, timeout, interval, callbackRpc) {
    log.debug('Requested subscription to stream stats, streamId: ' + streamId);

    var publisher;
    //todo(cc): ignore stats
    // if (streamId && publishers[streamId]) {
    //   publisher = publishers[streamId];
    //
    //   if (global.config.erizoController.reportSubscriptions &&
    //     global.config.erizoController.reportSubscriptions.maxSubscriptions > 0) {
    //
    //     if (timeout > global.config.erizoController.reportSubscriptions.maxTimeout)
    //       timeout = global.config.erizoController.reportSubscriptions.maxTimeout;
    //     if (interval < global.config.erizoController.reportSubscriptions.minInterval)
    //       interval = global.config.erizoController.reportSubscriptions.minInterval;
    //
    //     if (statsSubscriptions[streamId]) {
    //       log.debug('Renewing subscription to stream: ' + streamId);
    //       clearTimeout(statsSubscriptions[streamId].timeout);
    //       clearInterval(statsSubscriptions[streamId].interval);
    //     } else if (Object.keys(statsSubscriptions).length <
    //       global.config.erizoController.reportSubscriptions.maxSubscriptions) {
    //       statsSubscriptions[streamId] = {};
    //     }
    //
    //     if (!statsSubscriptions[streamId]) {
    //       log.debug('Max Subscriptions limit reached, ignoring message');
    //       return;
    //     }
    //
    //     statsSubscriptions[streamId].interval = setInterval(function () {
    //       let promises = [];
    //       let stats = {};
    //
    //       stats.streamId = streamId;
    //       promises.push(publisher.getStats('publisher', stats));
    //
    //       for (var sub in publisher.subscribers) {
    //         promises.push(publisher.subscribers[sub].getStats(sub, stats));
    //       }
    //
    //       Promise.all(promises).then(() => {
    //         log.debug('stats_subscriptions', stats)
    //         //todo(cc): do something
    //         // amqper.broadcast('stats_subscriptions', stats);
    //       });
    //
    //     }, interval * 1000);
    //
    //     statsSubscriptions[streamId].timeout = setTimeout(function () {
    //       clearInterval(statsSubscriptions[streamId].interval);
    //       delete statsSubscriptions[streamId];
    //     }, timeout * 1000);
    //
    //     callbackRpc('success');
    //
    //   } else {
    //     log.debug('Report subscriptions disabled by config, ignoring message');
    //   }
    // } else {
    //   log.debug('stream not found - ignoring message, streamId: ' + streamId);
    // }
  };

  return that;
};