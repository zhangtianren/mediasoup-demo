const Koa = require('koa');
const Router = require('koa-router');
const serve = require('koa-static');

const logger = require('../../utils/logger').logger;
const log = logger.getLogger('Monitor');


class MonitorService {

  constructor({
    port,
    serverName,
    currentVersion,
    startTime,
    erizoController
  }) {
    this.port = port;
    this.serverName = serverName;
    this.startTime = startTime;
    this.currentVersion = currentVersion;
    this.controller = erizoController;
  }

  updateController(controller) {
    this.controller = controller;
  }

  toTree() {
    let tree = {
      server: `${this.serverName} - ${this.currentVersion}`,
      startTime: this.startTime,
      children: []
    };
    Object.keys(this.controller.publishers).forEach(key => {
      let pub = {
        label: key,
        children: []
      };
      Object.keys(this.controller.publishers[key].subscribers).forEach(subkey => {
        let sub = {
          label: subkey
        };
        pub.children.push(sub);
      });
      tree.children.push(pub);
    });

    return tree;
  }

  serve() {

    const app = new Koa();
    const router = new Router();

    app.use(serve('./web'));

    router.get('/tree', async (ctx, next) => {

      ctx.response.type = 'json';
      ctx.response.body = this.toTree();
    });

    app
      .use(router.routes())
      .use(router.allowedMethods());


    log.info(`monitor start at ${this.port}`);
    app.listen(this.port);
  }
}


module.exports = MonitorService;