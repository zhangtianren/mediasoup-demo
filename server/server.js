#!/usr/bin/env node

process.title = 'mediasoup-demo-server';
process.env.DEBUG = process.env.DEBUG || '*INFO* *WARN* *ERROR*';

const config = require('./config/config');

/* eslint-disable no-console */
console.log('- config.mediasoup.numWorkers:', config.mediasoup.numWorkers);
console.log('- process.env.DEBUG:', process.env.DEBUG);
console.log(
	'- config.mediasoup.workerSettings.logLevel:',
	config.mediasoup.workerSettings.logLevel);
console.log(
	'- config.mediasoup.workerSettings.logTags:',
	config.mediasoup.workerSettings.logTags);
/* eslint-enable no-console */

const mediasoup = require('mediasoup_nodemodule');
const Logger = require('./lib/Logger');
const Room = require('./lib/Room');
const interactiveServer = require('./lib/interactiveServer');
const interactiveClient = require('./lib/interactiveClient');
const SfuService = require('./lib-adapter/service/sfu');

const logger = new Logger();

// Map of Room instances indexed by roomId.
// @type {Map<Number, Room>}
const rooms = new Map();

// Sfu WebSocket server.
// @type {libadapter/service/sfu/SfuService}
let sfuServer;

// mediasoup Workers.
// @type {Array<mediasoup.Worker>}
const mediasoupWorkers = [];

// Index of next mediasoup Worker to use.
// @type {Number}
let nextMediasoupWorkerIdx = 0;

run();

async function run()
{
	// Open the interactive server.
	await interactiveServer();

	// Open the interactive client.
	if (process.env.INTERACTIVE === 'true' || process.env.INTERACTIVE === '1')
		await interactiveClient();

	// Run a mediasoup Worker.
	await runMediasoupWorkers();

	// Run a Sfu WebsocketServer.
	await runSfuWebSocketServer();

	// Log rooms status every 30 seconds.
	setInterval(() =>
	{
		for (const room of rooms.values())
		{
			room.logStatus();
		}
	}, 120000);
}

/**
 * Launch as many mediasoup Workers as given in the configuration file.
 */
async function runMediasoupWorkers()
{
	const { numWorkers } = config.mediasoup;

	logger.info('running %d mediasoup Workers...', numWorkers);

	for (let i = 0; i < numWorkers; ++i)
	{
		const worker = await mediasoup.createWorker(
			{
				logLevel   : config.mediasoup.workerSettings.logLevel,
				logTags    : config.mediasoup.workerSettings.logTags,
				rtcMinPort : config.mediasoup.workerSettings.rtcMinPort,
				rtcMaxPort : config.mediasoup.workerSettings.rtcMaxPort
			});

		worker.on('died', () =>
		{
			logger.error(
				'mediasoup Worker died, exiting  in 2 seconds... [pid:%d]', worker.pid);

			setTimeout(() => process.exit(1), 2000);
		});

		mediasoupWorkers.push(worker);
	}
}

/**
 * Create a WebSocketServer to allow WebSocket connections from hub.
 */
async function runSfuWebSocketServer()
{
	logger.info('running sfu WebSocketServer...');

	let port = config.https.listenPort;
	sfuServer = new SfuService(port, config.version);
  	sfuServer.run();
}

/**
 * Get next mediasoup Worker.
 */
function getMediasoupWorker()
{
	const worker = mediasoupWorkers[nextMediasoupWorkerIdx];

	if (++nextMediasoupWorkerIdx === mediasoupWorkers.length)
		nextMediasoupWorkerIdx = 0;

	return worker;
}

/**
 * Get a Room instance (or create one if it does not exist).
 */
async function getOrCreateRoom({ roomId, forceH264 = false, forceVP9 = false })
{
	let room = rooms.get(roomId);

	// If the Room does not exist create a new one.
	if (!room)
	{
		logger.info('creating a new Room [roomId:%s]', roomId);

		const mediasoupWorker = getMediasoupWorker();

		room = await Room.create({ mediasoupWorker, roomId, forceH264, forceVP9 });

		rooms.set(roomId, room);
		room.on('close', () => rooms.delete(roomId));
	}

	return room;
}
