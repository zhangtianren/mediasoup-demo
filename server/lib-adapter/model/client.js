'use strict';

var Connection = require('../rtc/licode/connection').Connection;

var logger = require('./../utils/logger').logger;
var log = logger.getLogger('Client');


class Client {

    constructor(id) {
        log.debug(`Constructor Client ${id}`);

        this.id = id;
        this.connections = new Map();
        this.connectionClientId = 0;
        this.singlePc = false;
    }

    _getNewConnectionClientId() {
        this.connectionClientId += 1;
        let id = `${this.id}_${this.connectionClientId}`;
        while (this.connections.get(id)) {
            id = `${this.id}_${this.connectionClientId}`;
            this.connectionClientId += 1;
        }
        return id;
    }

    getOrCreateConnection(options) {
        log.debug(`message: getOrCreateConnection, clientId: ${this.id}`);

        let connection = this.connections.values().next().value;

        if (!this.singlePc || !connection) {
            let id = this._getNewConnectionClientId();
            connection = new Connection(id, options);
            this.addConnection(connection);
        }
        return connection;
    }

    getConnection(id) {
        return this.connections.get(id);
    }

    addConnection(connection) {
        log.debug(`message: Adding connection to Client, clientId: ${this.id}, ` +
            `connectionId: ${connection.id}`);

        this.connections.set(connection.id, connection);

        log.debug(`Client connections list size after add : ${this.connections.size}`);
    }

    maybeCloseConnection(id) {
        let connection = this.connections.get(id);

        log.debug(`message: maybeCloseConnection, connectionId: ${id}`);

        if (connection !== undefined) {
            if (connection.getNumMediaStreams() === 0) {
                log.debug(`message: closing empty connection, clientId: ${this.id}` +
                    ` connectionId: ${connection.id}`);
                connection.close();
                this.connections.delete(id);
            }
        } else {
            log.error(`message: trying to close unregistered connection, id: ${id}` +
                `, clientId: ${this.id}, remaining connections:${this.connections.size}`);
        }
        return this.connections.size;
    }
}

exports.Client = Client;