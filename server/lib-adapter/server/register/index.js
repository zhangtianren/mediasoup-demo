const request = require('request-promise-native');

const log = require('../../utils/logger').logger.getLogger('RegisterServer');


class RegisterServer {

    constructor(url) {
        this._url = url;
    }

    /**
     * 
     * @param {*} sfuInfo 
     * {
     *  serverName,
     *  publicIp,
     *  localIp,
     *  area,
     *  port,
     *  interfaceName,
     *  interfaceBandwith,
     *  secret
     * }
     */
    async register(sfuInfo) {
        try {
            await request.post(this._url, {
                timeout: 5000,
                json: true,
                form: {
                    serverName: sfuInfo.serverName,
                    publicIp: sfuInfo.publicIp,
                    localIp: sfuInfo.localIp,
                    area: sfuInfo.area,
                    port: sfuInfo.port,
                    interfaceName: sfuInfo.interfaceName,
                    interfaceBandwith: sfuInfo.interfaceBandwith,
                    secret: sfuInfo.secret
                }
            });
            log.info(`hot register success to ${this._url}`);
            return true;
        } catch (e) {
            log.error(`hot register fail, error(${e.error}), resp(${e.response})`);
            return false;
        }
    }
}

module.exports = RegisterServer;