const {
    getClientId,
    getStreamId
} = require('../common');


function mute(controller, params, accept, reject) {
    let sid = params._sid;
    let cid = params._cid;

    const args = params.args;

    let media = args.media;

    let clientId = getClientId(sid, cid);

    let streamId;
    if (args.feed) {
        streamId = getStreamId(sid, args.feed.client);
    } else {
        streamId = getStreamId(sid, cid);
    }

    controller.processSignaling(clientId, streamId, {
        type: 'updatestream',
        config: {
            muteStream: media
        }
    });

    accept();
}


module.exports = mute;