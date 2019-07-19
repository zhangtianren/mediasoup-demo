const {
    getClientId,
    getStreamId
} = require('../common');

const SemanticSdp = require('../../../rtc/licode/semantic_sdp');
const ERROR = require('../../../error');

const logger = require('../../../utils/logger').logger;
const log = logger.getLogger('SfuService::publish');


const DEFAULT_BANDWIDTH = 1000; // 1Mb , unit 1kb
const MAX_BANDWIDTH = DEFAULT_BANDWIDTH * 30; // 30Mb

function publish(controller, jsonRPC, params, accept, reject) {
    let cid = params._cid;
    let sid = params._sid;

    let sdp = params.args.sdp;

    let trickle = params.args.options.trickle;
    let bandwidth = params.args.options.bandwidth;
    let disableRR = params.args.options.disableRR;
    let codec = params.args.options.codec;
    let isRouter = params.args.options.router;
    let internal = params.args.options.internal;
    let firPeriod = params.args.options.firPeriod;

    switch (codec) {
        case 'vp8':
            codec = 'VP8_AND_OPUS';
            break;
        case 'h264':
            codec = 'H264_AND_OPUS';
            break;
        case 'vp9':
            codec = 'VP9_AND_OPUS';
            break;
        case 'h264-base':
            codec = 'H264_BASE_AND_OPUS';
            break;
        case 'h264-main':
            codec = 'H264_MAIN_AND_OPUS';
            break;
        case 'h264-high':
            codec = 'H264_HIGH_AND_OPUS';
            break;
        default:
            codec = 'VP8_AND_OPUS';
            break;
    }

    if (sid && cid && sdp && typeof sdp === 'string') {
        let clientId = getClientId(sid, cid);
        let streamId = getStreamId(sid, cid);

        const sdpObject = SemanticSdp.SDPInfo.processString(sdp);

        let label;
        //todo(cc): check label
        for (var key of sdpObject.streams.keys()) {
            label = key;
            break;
        }

        if (!(bandwidth && typeof bandwidth === 'number' && bandwidth < MAX_BANDWIDTH)) {
            bandwidth = DEFAULT_BANDWIDTH;
        }

        let options = {
            mediaConfiguration: codec,
            // minVideoBW:1000000,
            label: label,
            trickleIce: trickle,
            disableRR: disableRR,
            encrypt: !isRouter,
            isServer: isRouter,
            interface: global.config.interface,
            internal: internal,
            firPeriod: firPeriod
            // scheme:''
        };

        controller.addPublisher(clientId, streamId, options, (info) => {
            log.debug(`${sid}@${cid} callback: `, info);

            //todo(cc): handle failed message
            if (info.type === "init") {

                controller.processSignaling(clientId, streamId, {
                    type: 'sdp',
                    sdp: sdp,
                    config: {
                        maxVideoBW: bandwidth
                    }
                });

            } else if (info.type === 'answer') {
                if (isRouter) {
                    controller.processSignaling(clientId, streamId, {
                        type: 'updatestream',
                        config: {
                            disableHandlers: global.config.pubDisableHandler
                        }
                    });
                }

                accept({
                    sdp: info.sdp
                });

            } else if (info.type === 'ready') {

                log.debug(`${sid}@${cid} ready`);

                jsonRPC.notify('ready', {
                    _sid: sid,
                    _cid: cid
                });

            } else if (info.type === 'failed') {
                log.warn(`${sid}@${cid} failed , ${logger.objectToLog(info)}`);
                controller.removePublisher(clientId, streamId);
            }
        });

    } else {
        log.warn(`invalid message : ${JSON.stringify(params)}`);

        reject(ERROR.INVALID_REQUEST());
    }
}


module.exports = publish;