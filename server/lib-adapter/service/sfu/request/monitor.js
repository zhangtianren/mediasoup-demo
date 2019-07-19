const BandwidthMonitor = require('bandwidth-monitor');
const ERROR = require('../../../error');

const logger = require('../../../utils/logger').logger;
const log = logger.getLogger('SfuService::monitor');


const bm = new BandwidthMonitor();

function monitor(params, accept, reject) {
    let net_infterface = params.interface;

    if (bm.monitors[net_infterface]) {

        if (!bm.monitors[net_infterface].isCapturing) {
            bm.monitors[net_infterface].capture();
        }

        accept({
            in: bm.monitors[net_infterface].rxPerSec * 8, // kb
            out: bm.monitors[net_infterface].txPerSec * 8 // kb
        });

    } else {
        log.warn(`bandwidth unknown interface`);

        reject(ERROR.INVALID_REQUEST('bandwidth unknown interface'));
    }
}


module.exports = monitor;