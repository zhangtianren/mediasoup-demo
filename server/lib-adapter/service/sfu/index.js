const URL = require('url');
const semver = require('semver')
const JsonRPC = require('@present/json-rpc');

const time = require('../../utils/time');
const Heartbeat = require('../../utils/heartbeat');
// const Controller = require('./controller');
const MediasoupAdapter = require('./mediasoupadapter')
const RegisterServer = require('../../server/register');
const MonitorService = require('../monitor');

const onPublishReq = require('./request/publish');
const onUnpublishReq = require('./request/unpublish');
const onSubscribeReq = require('./request/subscribe');
const onUnsubscribeReq = require('./request/unsubscribe');
const onRouterSubscribeReq = require('./request/router_subscribe');
const onRouterAnswerNotify = require('./notify/router_answer');
const onKeyframeReq = require('./request/keyframe');
const onMonitorReq = require('./request/monitor');
const onMuteReq = require('./request/mute');

const logger = require('../../utils/logger').logger;
const log = logger.getLogger('SfuService');


function getClientIp(req) {

  var ipAddress;
  // The request may be forwarded from local web server.
  var forwardedIpsStr = req.headers['x-forwarded-for'];
  if (forwardedIpsStr) {
    // 'x-forwarded-for' header may return multiple IP addresses in
    // the format: "client IP, proxy 1 IP, proxy 2 IP" so take the
    // the first one
    var forwardedIps = forwardedIpsStr.split(',');
    ipAddress = forwardedIps[0];
  }
  if (!ipAddress) {
    // If request was not forwarded
    ipAddress = req.connection.remoteAddress;
    //strip ipv6
    ipAddress = ipAddress.replace(/^.*:/, '')
  }
  return ipAddress;
}


class SfuService {

  constructor(port, version) {
    this.version = version;
    this.port = port;

    this.hotRegisterTimer = null;
    this.hotRegisterRetry = 0;

    this._startId = Math.round(Math.random() * 100000000); // 1/100 000 000 collision probability
  }

  verify(info, cb) {

    let urlObj = URL.parse(info.req.url, true);

    let secret = urlObj.query['secret'];

    if (global.config.secret == secret) {
      cb(true, 200, 'success');
    } else {
      log.warn(`invalid secret -> ${secret} `);
      cb(false, 400, 'invalid secret key');
    }
  }

  run() {

    this.startTime = time.now();

    log.info(`version ${this.version}, sfu up at ${this.startTime}, on port ${this.port}`);

    //let controller = Controller.Controller();
    let adapter = MediasoupAdapter.MediasoupAdapter();

    // let monitor = new MonitorService({
    //   port: this.port + 1,
    //   serverName: global.config.serverName,
    //   currentVersion: this.version,
    //   startTime: this.startTime,
    //   erizoController: controller
    // });

    // monitor.serve();

    this.jsonRPCServer = new JsonRPC.Server({
      port: this.port,
      verifyClient: (info, cb) => {
        this.verify(info, cb);
      }
    });

    this.jsonRPCServer.on('connection', (jsonRPC, request) => {

      // stop hot register

      if (this.hotRegisterTimer) {
        clearInterval(this.hotRegisterTimer);
        this.hotRegisterTimer = null;
      }

      jsonRPC.ip = getClientIp(request);

      let urlObj = URL.parse(request.url, true);

      let sdkVersion = urlObj.query['version'];
      if (!sdkVersion) {
        sdkVersion = '0.0.0';
      }

      // add heart beat

      Heartbeat.addHeartbeat(jsonRPC.socket, 1000 * 60 * 60, (time) => {
        log.warn(`${jsonRPC.ip} socket timeout: ${time}`);
      });

      log.info(`signal server connect, ip : ${jsonRPC.ip}, sdk version: ${sdkVersion}`);

      // add version translator

      if (semver.lt(sdkVersion, '1.0.0')) {
        const translator = {
          id: 1,
          id2Message: new Map()
        }
        jsonRPC.beforeHandle = require('./before_handler/v0.x.x/before_handle').bind(null, translator);
        jsonRPC.beforeSend = require('./before_handler/v0.x.x/before_send').bind(null, translator);
      }

      // handle req and notify

      jsonRPC.onRequest('info', (params, accept, reject) => {
        accept({
          version: this.version,
          startTime: this.startTime,
          startId: this._startId
        });
      });

      jsonRPC.onRequest('publish', (params, accept, reject) => {
        onPublishReq(adapter, jsonRPC, params, accept, reject);
      });

      jsonRPC.onRequest('subscribe', (params, accept, reject) => {
        onSubscribeReq(adapter, jsonRPC, params, accept, reject);
      });

      jsonRPC.onRequest('unpub', (params, accept, reject) => {
        onUnpublishReq(adapter, params, accept, reject);
      });

      jsonRPC.onRequest('unsub', (params, accept, reject) => {
        onUnsubscribeReq(adapter, params, accept, reject);
      });

      jsonRPC.onRequest('router-sub', (params, accept, reject) => {
        onRouterSubscribeReq(adapter, jsonRPC, params, accept, reject);
      });

      jsonRPC.onNotify('router-answer', (params, accept, reject) => {
        onRouterAnswerNotify(adapter, params, accept, reject);
      });

      jsonRPC.onRequest('mute', (params, accept, reject) => {
        onMuteReq(adapter, params, accept, reject);
      });

      jsonRPC.onRequest('keyframe', (params, accept, reject) => {
        onKeyframeReq(adapter, params, accept, reject);
      });

      jsonRPC.onRequest('monitor', (params, accept, reject) => {
        onMonitorReq(params, accept, reject);
      });

      // on error and close

      jsonRPC.on('error', error => {
        log.error(error);
      });

      jsonRPC.on('close', _ => {
        log.warn(`signal server ${jsonRPC.ip} disconnect`);
      });

    });

    // hot register

    if (global.config.enableHotRegister) {

      const registerServer = new RegisterServer(global.config.hotRegisterUrl);

      const sfuInfo = {
        serverName: global.config.serverName,
        publicIp: global.config.publicIp,
        localIp: global.config.localIp,
        area: global.config.area,
        port: global.config.port,
        interfaceName: global.config.interfaceName,
        interfaceBandwith: global.config.interfaceBandwith,
        secret: global.config.secret
      }

      this.hotRegisterTimer = setInterval(async _ => {

        if (this.hotRegisterRetry < 10) {
          this.hotRegisterRetry++;

          let result = await registerServer.register(sfuInfo);

          log.info(`try ${this.hotRegisterRetry} register to ${global.config.hotRegisterUrl} -> result ${result}`);

        } else {

          log.warn(`stop trying to register`);

          if (this.hotRegisterTimer) {
            clearInterval(this.hotRegisterTimer);
            this.hotRegisterTimer = null;
          }

        }

      }, 1000);

    }

  }

}

module.exports = SfuService;