const {
    getClientId,
    getStreamId
} = require('../common');

const logger = require('../../../utils/logger').logger;
const log = logger.getLogger('SfuService::subscribe');


function subscribe(controller, jsonRPC, params, accept, reject) {
    let sid = params._sid;
    let cid = params._cid;

    let feed = params.args.feed;

    let sdp = params.args.sdp;

    let bandwidth = params.args.options.bandwidth;

    let clientId = getClientId(sid, cid);
    let streamId = getStreamId(sid, feed.client);

    let options = {
        encrypt: true,
        interface: global.config.interface
        // privateRegexp:/udp/g,
        // publicIp:'abc'
        // scheme:''
    };

    controller.addSubscriber(clientId, streamId, options, (info) => {
        log.debug(`${sid}@${cid}@${feed.client} callback`, info);

        if (info.type === "init") {

            controller.processSignaling(clientId, streamId, {
                type: 'sdp',
                sdp: sdp,
                config: {
                    maxVideoBW: bandwidth
                }
            });

        } else if (info.type === 'answer') {

            accept({
                sdp: info.sdp
            });

        } else if (info.type === 'ready') {

            log.debug(`${sid}@${cid}@${feed.client} ready`);

            jsonRPC.notify('ready', {
                _sid: sid,
                _cid: cid,

                args: {
                    feed
                }
            });

        } else if (info.type === 'failed') {
            log.warn(`${sid}@${cid}@${feed.client} failed , ${logger.objectToLog(info)}`);
            controller.removeSubscriber(clientId, streamId);
        }
    });
}

module.exports = subscribe;