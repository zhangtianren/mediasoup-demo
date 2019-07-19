const getClientId = require('../../common').getClientId;

const logger = require('../../../../utils/logger').logger;
const log = logger.getLogger('SfuService::beforeSend');


module.exports = function beforeSend(translator, message) {

    // an error
    if (message.error) {
        log.debug('error message:', message.error);

        // todo@zsf: handle error
        return null;
    }

    // a response or notify
    let method = message.method;
    let receivedMsg = null;
    if (!method) { // a response
        const id = message.id;
        receivedMsg = translator.id2Message.get(id);
        translator.id2Message.delete(id);
        method = receivedMsg.method;
    }

    let newMessage = {
        type: method
    };

    switch (method) {
        case 'info': { // notify
            newMessage.version = message.params.version;
            newMessage.startTime = message.params.startTime;

            break;
        }
        case 'ready': { // notify
            if (message.params.args.feed) {
                newMessage.id = getClientId(message.params._sid, message.params.args.feed.client);
                newMessage.type = 'sub-ready';
                newMessage.sid = message.params._cid;
            } else {
                newMessage.id = getClientId(message.params._sid, message.params._cid);
            }

            break;
        }
        case 'monitor': { // response
            newMessage.type = 'bandwidth-monitor';
            newMessage.in = message.result.in;
            newMessage.out = message.result.out;

            break;
        }
        case 'publish': { // response
            newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params._cid);
            newMessage.sdp = message.result.sdp;

            break;
        }
        case 'subscribe': { // response
            newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params.args.feed.client);
            newMessage.sid = receivedMsg.params._cid;

            newMessage.sdp = message.result.sdp;

            break;
        }
        case 'unsub': { // response
            newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params.args.feed.client);
            newMessage.sid = receivedMsg.params._cid;

            break;
        }
        case 'unpub': { // response
            newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params._cid);

            break;
        }
        case 'router-sub': { // response
            newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params.args.feed.client);
            newMessage.sid = receivedMsg.params._cid;

            newMessage.sdp = message.result.sdp;

            break;
        }
        case 'mute': { // response
            if (message.params.args.feed) {
                newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params.args.feed.client);
                newMessage.sid = receivedMsg.params._cid;
            } else {
                newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params._cid);
            }

            break;
        }
        case 'keyframe': { // response
            newMessage.id = getClientId(receivedMsg.params._sid, receivedMsg.params._cid);

            break;
        }
        default:
            // filter unsupported messages.
            newMessage = null;
    }

    log.debug(newMessage);

    return newMessage;
}