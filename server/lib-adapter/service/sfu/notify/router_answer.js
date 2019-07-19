const {
    getClientId,
    getStreamId
} = require('../common');

const logger = require('../../../utils/logger').logger;
const log = logger.getLogger('SfuService::routerAnswer');


function routerAnswer(controller, params) {
    log.debug(params);

    let sid = params._sid;
    let cid = params._cid;

    let feed = params.args.feed;
    let sdp = params.args.sdp;

    let clientId = getClientId(sid, cid);
    let streamId = getStreamId(sid, feed.client);

    controller.processSignaling(clientId, streamId, {
        type: 'sdp',
        sdp: sdp,
        config: {
            maxVideoBW: 10000 //10M
        }
    });
}

module.exports = routerAnswer;