const {
    getClientId,
    getStreamId
} = require('../common');


function unpublish(controller, params, accept, reject) {
    let sid = params._sid;
    let cid = params._cid;

    let clientId = getClientId(sid, cid);
    let streamId = getStreamId(sid, cid);


    controller.removePublisher(clientId, streamId);

    accept();
}

module.exports = unpublish;