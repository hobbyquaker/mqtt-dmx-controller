const electron = require('electron');

const ipc = electron.ipcMain;
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const dialog = electron.dialog;
const Menu = electron.Menu;

const windowStateKeeper = require('electron-window-state');
const isDev = require('electron-is-dev');

const fs = require('fs');
const url = require('url');
const path = require('path');
const ppath = require('persist-path')('mqtt-dmx-controller');
const mkdirp = require('mkdirp');

const Mqtt = require('mqtt');
const Artnet = require('artnet');

const config = {
    address: '172.16.23.15',
    url: 'mqtt://127.0.0.1',
    name: 'dmx'
};

let mainWindow;
let settingsWindow;
let menu;

let mqttConnected;

const runningSequences = {};
let scenes;
let sequences;
let sequenceSettings;

const debug = console.log;

mkdirp(ppath);

function saveScenes() {
    fs.writeFileSync(path.join(ppath, 'scenes.json'), JSON.stringify(scenes, null, '  '));
}

function saveSequences() {
    fs.writeFileSync(path.join(ppath, 'sequences.json'), JSON.stringify(sequences, null, '  '));
}

function saveSequenceSettings() {
    fs.writeFileSync(path.join(ppath, 'sequence-settings.json'), JSON.stringify(sequenceSettings, null, '  '));
}

try {
    scenes = require(path.join(ppath, 'scenes.json'));
} catch (err) {
    scenes = {};
    saveScenes();
}

try {
    sequences = require(path.join(ppath, 'sequences.json'));
    sequenceSettings = require(path.join(ppath, 'sequence-settings.json'));
} catch (err) {
    sequences = {};
    sequenceSettings = {};
    saveSequences();
    saveSequenceSettings();
}

const artnet = new Artnet({
    host: config.address
});

artnet.data[0] = [];
const sequencer = require('scene-sequencer')({
    setter(data) {
        if (mainWindow) {
            mainWindow.webContents.send('data', JSON.stringify(data));
        }
        artnet.set(data);
    },

    data: artnet.data[0],
    scenes,
    sequences
});

let menuTemplate = [
    {
        label: 'Settings',
        submenu: [
            {
                role: 'channel',
                label: 'Channels'
            },
            {
                role: 'shortcuts',
                label: 'Shortcuts'
            },
            {
                role: 'artnet',
                label: 'Art-Net'
            },
            {
                role: 'mqtt',
                label: 'MQTT'
            }
        ]
    },
    {
        label: 'Export',
        submenu: [
            {
                role: 'exportScenes',
                label: 'Scenes'
            },
            {
                role: 'exportSequences',
                label: 'Sequences'
            }
        ]
    }
];

if (process.platform === 'darwin') {
    menuTemplate.unshift({
        label: 'Arcticfox Monitor',
        submenu: [
            {
                role: 'about',
                label: 'About MQTT DMX Controller'
            },
            {
                type: 'separator'
            },
            {
                role: 'services',
                submenu: []
            },
            {
                type: 'separator'
            },
            {
                role: 'hide',
                label: 'Hide Arcticfox Config'
            },
            {
                role: 'hideothers'
            },
            {
                role: 'unhide'
            },
            {
                type: 'separator'
            },
            {
                role: 'quit',
                label: 'Quit Arcticfox Config'
            }
        ]
    });
}

function createWindow() {
    let mainWindowState = windowStateKeeper({
        defaultWidth: 1280,
        defaultHeight: 800
    });

    let devWindowState = {
        width: 1280,
        height: 800
    };

    let windowState = isDev ? devWindowState : mainWindowState;

    mainWindow = new BrowserWindow(windowState);

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    if (isDev) mainWindow.webContents.openDevTools();

    menu = Menu.buildFromTemplate(menuTemplate);

    Menu.setApplicationMenu(menu);

    //if (!isDev) mainWindowState.manage(mainWindow);

    mainWindow.on('closed', () => {
        mainWindow = null;
        app.quit();
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

ipc.on('getsequenceSettings', event => {
    event.sender.send('sequenceSettings', JSON.stringify(sequenceSettings));
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

ipc.on('saveSequenceSettings', (event, data) => {
    sequenceSettings = JSON.parse(data);
    saveSequenceSettings();
});

ipc.on('saveSequences', (event, data) => {
    let tmp = JSON.parse(data);
    let seqs = Object.keys(tmp);
    Object.keys(sequences).forEach(s => {
        if (seqs.indexOf(s) === -1) {
            delete sequences[s];
        }
    });
    seqs.forEach(s => {
         sequences[s] = tmp[s];
    });
    saveSequences();
});

ipc.on('saveScenes', (event, data) => {
    let tmp = JSON.parse(data);
    let scs = Object.keys(tmp);
    Object.keys(scenes).forEach(s => {
        if (scs.indexOf(s) === -1) {
            delete scenes[s];
        }
    });
    scs.forEach(s => {
        scenes[s] = tmp[s];
    });
    saveScenes();
});

sequencer.on('transition-conflict', ch => {
    debug('transition conflict channel', ch);
});

sequencer.on('step', step => {
    if (mainWindow) {
        mainWindow.webContents.send('seqstep', step);
    }
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
