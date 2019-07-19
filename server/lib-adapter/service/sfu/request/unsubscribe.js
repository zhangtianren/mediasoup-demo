const {
    getClientId,
    getStreamId
} = require('../common');


function unsubscribe(controller, params, accept, reject) {
    let sid = params._sid;
    let cid = params._cid;

    let feed = params.args.feed;

    let clientId = getClientId(sid, cid);
    let streamId = getStreamId(sid, feed.client);

    controller.removeSubscriber(clientId, streamId);

    accept();
}

module.exports = unsubscribe;