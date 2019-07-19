function noop() {}

// It seems like ws will close the socket after 20s timeout.
function makeTimeCallback(beat, cb) {
    if (cb && typeof cb === 'function') {
        cb((beat.dieTime - beat.pingTime) / 1000);
    }
}

function addHeartbeat(ws, timeoute = 30000, timeCallback = null) {

    if (ws.readyState !== ws.OPEN) {
        return;
    }

    let beat = {};

    ws.ping(noop);
    beat.pingTime = (new Date()).getTime();
    beat.waitPong = true;

    ws.on('pong', _ => {
        beat.waitPong = false;
    });

    let interval = setInterval(function ping() {

        if (beat.waitPong === true) {
            beat.dieTime = (new Date()).getTime();
            ws.terminate();
            clearInterval(interval);
            interval = null;
            return
        }

        ws.ping(noop);
        beat.pingTime = (new Date()).getTime();
        beat.waitPong = true;

    }, timeoute);

    ws.on('close', (code) => {
        if (interval) {
            clearInterval(interval);
            interval = null;
        }

        // https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent
        if (code === 1000 || !beat.waitPong) { // Normal Closure.
            return;
        }

        if (!beat.dieTime) {
            beat.dieTime = (new Date()).getTime();
        }

        makeTimeCallback(beat, timeCallback);
    });
}

module.exports.addHeartbeat = addHeartbeat