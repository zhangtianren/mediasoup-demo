const logger = require('../../../../utils/logger').logger;
const log = logger.getLogger('SfuService::beforeHandle');


module.exports = function beforeHandle(translator, message) {

    message = JSON.parse(message);

    if (!message || (typeof message !== 'object')) {
        return message;
    }

    const newMessage = {
        jsonrpc: "2.0",
        id: translator.id++,
        method: message.type,
        params: {}
    };

    switch (message.type) {
        case 'bandwidth-monitor': {
            newMessage.method = 'monitor';

            newMessage.params.interface = message.interface;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'publish': {
            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.id;
            const args = {
                sdp: message.sdp,
                options: message.options
            };
            newMessage.params.args = args;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'subscribe': {
            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.sid;
            const args = {
                feed: {
                    client: message.id,
                },
                sdp: message.sdp,
                options: message.options
            };
            newMessage.params.args = args;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'unpub': {
            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.id;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'unsub': {
            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.sid;
            const args = {
                feed: {
                    client: message.id,
                }
            };
            newMessage.params.args = args;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'router-sub': {
            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.sid;
            const args = {
                feed: {
                    client: message.id,
                },
                options: message.options
            };
            newMessage.params.args = args;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'router-sub-answer': { // a notify
            delete newMessage.id;

            newMessage.method = 'router-answer';

            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.sid;
            const args = {
                feed: {
                    client: message.id,
                },
                sdp: message.sdp
            };
            newMessage.params.args = args;

            break;
        }
        case 'mute': {
            newMessage.params._sid = message.sessionId;

            const args = {
                media: message.media
            };

            if (message.role === 'pub') {
                newMessage.params._cid = message.id;
            } else if (message.role === 'sub') {
                newMessage.params._cid = message.sid;
                newMessage.params.args.feed = {
                    client: message.id
                };
            }

            newMessage.params.args = args;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
        case 'keyframe': {
            newMessage.params._sid = message.sessionId;
            newMessage.params._cid = message.id;

            translator.id2Message.set(newMessage.id, newMessage);

            break;
        }
    }

    log.debug(newMessage);

    return newMessage;
}