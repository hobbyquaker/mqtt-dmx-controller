const electron = require('electron');

const ipc = electron.ipcMain;
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;

const path = require('path');
const url = require('url');

const Mqtt = require('mqtt');
const Artnet = require('artnet');

const config = {
    address: '172.16.23.15',
    url: 'mqtt://127.0.0.1',
    name: 'dmx'
};

let mainWindow;
let mqttConnected;

const runningSequences = {};

const debug = console.log;

const scenes = require('./example-scenes.json');
const sequences = require('./example-sequences.json');

const artnet = new Artnet({
    host: config.address
});

artnet.data[0] = [];
const sequencer = require('scene-sequencer')({
    setter(data) {
        mainWindow.webContents.send('data', JSON.stringify(data));
        artnet.set(data);
    },

    data: artnet.data[0],
    scenes,
    sequences
});

function createWindow() {
    mainWindow = new BrowserWindow({width: 1280, height: 720});

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    mainWindow.webContents.openDevTools();

    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}

app.on('ready', createWindow);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindow();
    }
});

ipc.on('getscenes', event => {
    event.sender.send('scenes', JSON.stringify(scenes));
});

ipc.on('getsequences', event => {
    event.sender.send('sequences', JSON.stringify(sequences));
});

ipc.on('data', (event, data) => {
    artnet.set(data, err => {
        if (err) {
            console.log(err);
        }
    });
});

ipc.on('seqstart', (event, data) => {
    debug('seqstart', data);
    updateSequence(data.name, data.speed, data.shuffle, data.repeat);
});

ipc.on('seqstop', (event, data) => {
    debug('seqstop', data);
    if (runningSequences[data]) {
        runningSequences[data].stop();
    }
});

sequencer.on('transition-conflict', ch => {
    debug('transition conflict channel', ch);
});

sequencer.on('step', step => {
    mainWindow.webContents.send('seqstep', step);
});

debug('mqtt trying to connect', config.url);
const mqtt = Mqtt.connect(config.url, {will: {topic: config.name + '/connected', payload: '0'}});

mqtt.on('connect', () => {
    mqttConnected = true;
    debug('mqtt connected ' + config.url);
    mqtt.publish(config.name + '/connected', '2');
    debug('mqtt subscribe', config.name + '/set/#');
    mqtt.subscribe(config.name + '/set/#');
});

mqtt.on('close', () => {
    if (mqttConnected) {
        mqttConnected = false;
        debug('mqtt closed ' + config.url);
    }
});

mqtt.on('error', () => {
    debug('mqtt error ' + config.url);
});

mqtt.on('message', (topic, payload) => {
    payload = payload.toString();
    debug('mqtt <', topic, payload);
    const tpArr = topic.split('/');
    let channel;
    let scene;
    let sequence;
    let transition;
    switch (tpArr[2]) {
        case 'channel':
            channel = parseInt(tpArr[3], 10);
            if (channel < 1 || channel > 512) {
                debug('invalid channel', tpArr[3]);
            } else {
                artnet.set(channel, parseInt(payload, 10));
            }
            break;
        case 'scene':
            scene = tpArr[3];
            if (scenes[scene]) {
                debug('setScene', scene);
                transition = parseFloat(payload) || 0;
                sequencer.setScene([scene, transition]);
            } else {
                debug('unknown scene', scene);
            }
            break;
        case 'sequence':
            sequence = tpArr[3];
            if (tpArr[4] === 'stop' && runningSequences[sequence]) {
                runningSequences[sequence].stop();
            } else if (tpArr[4] === 'stop' && sequence === 'all') {
                Object.keys(runningSequences).forEach(s => {
                    runningSequences[s].stop();
                });
            } else if (sequences[sequence]) {
                debug('newSequence', sequence);
                newSequence(sequence, payload);
            } else {
                debug('unknown sequence', sequence);
            }
            break;
        default:
            debug('unknown cmd', tpArr[2]);
    }

    function newSequence(sequence, payload) {
        let repeat = false;
        let shuffle = false;
        let speed = 1;

        if (payload.indexOf('{') !== -1) {
            try {
                const tmp = JSON.parse(payload);
                repeat = tmp.repeat;
                shuffle = tmp.shuffle;
                speed = tmp.speed;
            } catch (err) {
                debug(err);
            }
        }

        updateSequence(sequence, repeat, shuffle, speed);
    }
});

function updateSequence(sequence, speed, shuffle, repeat) {
    if (runningSequences[sequence]) {
        runningSequences[sequence].speed(speed);
        runningSequences[sequence].shuffle(shuffle);
        runningSequences[sequence].repeat(repeat);
        return;
    }

    debug('newSequence', repeat, shuffle, speed);
    debug('mqtt >', config.name + '/status/sequence/' + sequence, '1');
    mqtt.publish(config.name + '/status/sequence/' + sequence, '1');
    mainWindow.webContents.send('seqstart', sequence);
    runningSequences[sequence] = sequencer.newSequence(sequence, repeat, shuffle, speed, () => {
        debug('sequence end', sequence);
        debug('mqtt >', config.name + '/status/sequence/' + sequence, '0');
        mqtt.publish(config.name + '/status/sequence/' + sequence, '0');
        mainWindow.webContents.send('seqstop', sequence);
        delete runningSequences[sequence];
    });
}
