function getClientId(session, id) {
    return `${session}@${id}`;
}

function getStreamId(session, id) {
    return `${session}@${id}-stream`;
}


module.exports.getClientId = getClientId;
module.exports.getStreamId = getStreamId;