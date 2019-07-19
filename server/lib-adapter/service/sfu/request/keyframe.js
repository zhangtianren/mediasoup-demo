const {
    getStreamId
} = require('../common');

const logger = require('../../../utils/logger').logger;
const log = logger.getLogger('SfuService::keyframe');


function keyframe(controller, params, accept, reject) {
    let sid = params._sid;
    let cid = params._cid;

    let streamId = getStreamId(sid, cid);

    let publisher = controller.publishers[streamId];

    if (publisher) {
        log.debug(`${streamId} request keyframe!`);
        publisher.requestVideoKeyFrame();
    } else {
        log.debug(`${streamId} does not exist`);
    }

    accept();
}


module.exports = keyframe;