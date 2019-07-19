const {
    getClientId,
    getStreamId
} = require('../common');

const logger = require('../../../utils/logger').logger;
const log = logger.getLogger('SfuService::routerSubscribe');


function routerSubscribe(controller, jsonRPC, params, accept, reject) {
    let sid = params._sid;
    let cid = params._cid;

    let feed = params.args.feed;

    let video = params.args.options.video;
    let audio = params.args.options.audio;
    let bundle = params.args.options.bundle;
    let internal = params.args.options.internal;

    let clientId = getClientId(sid, cid);
    let streamId = getStreamId(sid, feed.client);

    let options = {
        // trickleIce:true,
        createOffer: {
            video: video,
            audio: audio,
            bundle: bundle,
            internal: internal
        },
        interface: global.config.interface,
        encrypt: false,
        controlling: true
        // scheme:''
    };

    controller.addSubscriber(clientId, streamId, options, (info) => {
        log.debug(`${sid}@${cid}@${feed.client} callback`, info);

        // todo(cc): handle failed message
        if (info.type === "init") {
            log.debug(`${sid}@${cid}@${feed.client} init!`);

            controller.processSignaling(clientId, streamId, {
                type: 'updatestream',
                config: {
                    maxVideoBW: 10000 //10M
                }
            });

        } else if (info.type === 'offer') {

            accept({
                sdp: info.sdp
            });

        } else if (info.type === 'ready') {

            log.debug(`${sid}@${cid}@${feed.client} ready!`);

            controller.processSignaling(clientId, streamId, {
                type: 'updatestream',
                config: {
                    disableHandlers: global.config.subDiableHandler
                }
            });
        }
    });

}


module.exports = routerSubscribe;