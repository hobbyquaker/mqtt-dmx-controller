const electron = require('electron');

const ipc = electron.ipcMain;
const app = electron.app;
const BrowserWindow = electron.BrowserWindow;
const dialog = electron.dialog; // eslint-disable-line no-unused-vars
const Menu = electron.Menu;

const fs = require('fs');
const url = require('url');
const path = require('path');

const windowStateKeeper = require('electron-window-state');
const isDev = require('electron-is-dev');

const ppath = require('persist-path')('mqtt-dmx-controller');
const mkdirp = require('mkdirp');

const Mqtt = require('mqtt');
const Artnet = require('artnet');

let mainWindow;
let settingsWindow;
let menu;

let mqttConnected;

const runningSequences = {};
let scenes;
let sequences;
let sequenceSettings;
let shortcuts;
let config;

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

function saveShortcuts() {
    fs.writeFileSync(path.join(ppath, 'shortcuts.json'), JSON.stringify(shortcuts, null, '  '));
}

function saveConfig() {
    fs.writeFileSync(path.join(ppath, 'config.json'), JSON.stringify(config, null, '  '));
}

try {
    config = require(path.join(ppath, 'config.json'));
} catch (err) {
    config = {
        address: '255.255.255.255',
        port: 6454,
        url: 'mqtt://127.0.0.1',
        name: 'dmx',
        channels: 24
    };
    saveConfig();
}

try {
    shortcuts = require(path.join(ppath, 'shortcuts.json'));
} catch (err) {
    shortcuts = [];
    saveShortcuts();
}

try {
    scenes = require(path.join(ppath, 'scenes.json'));
} catch (err) {
    scenes = {};
    saveScenes();
}

try {
    sequences = require(path.join(ppath, 'sequences.json'));
} catch (err) {
    sequences = {};
    saveSequences();
}

try {
    sequenceSettings = require(path.join(ppath, 'sequence-settings.json'));
} catch (err) {
    sequenceSettings = {};
    saveSequenceSettings();
}

const artnet = new Artnet({
    host: config.address,
    sendAll: true
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

const menuTemplate = [
    {
        label: 'Settings',
        submenu: [
            {
                label: 'Configuration',
                click() {
                    createSettingsWindow();
                }
            },
            {
                label: 'Edit Shortcuts',
                type: 'checkbox',
                click(item) {
                    mainWindow.webContents.send('shortcutedit', item.checked);
                }
            }
        ]
    },
    {
        label: 'Export',
        submenu: [
            {
                label: 'Scenes',
                click() {
                    electron.dialog.showSaveDialog({
                        title: 'Export Scenes'
                    }, filename => {
                        if (filename) {
                            fs.writeFileSync(filename, JSON.stringify(scenes, null, '  '));
                        }
                    });
                }
            },
            {
                label: 'Sequences',
                click() {
                    electron.dialog.showSaveDialog({
                        title: 'Export Sequences'
                    }, filename => {
                        if (filename) {
                            fs.writeFileSync(filename, JSON.stringify(sequences, null, '  '));
                        }
                    });
                }
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
                label: 'Hide MQTT DMX Controller'
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
                label: 'Quit MQTT DMX Controller'
            }
        ]
    });
}

function createWindows() {
    const mainWindowState = windowStateKeeper({
        defaultWidth: 1280,
        defaultHeight: 800
    });

    const devWindowState = {
        width: 1280,
        height: 800
    };

    const windowState = isDev ? devWindowState : mainWindowState;

    mainWindow = new BrowserWindow(windowState);

    mainWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'index.html'),
        protocol: 'file:',
        slashes: true
    }));

    if (isDev) {
        mainWindow.webContents.openDevTools();
    }

    menu = Menu.buildFromTemplate(menuTemplate);

    Menu.setApplicationMenu(menu);

    // If (!isDev) mainWindowState.manage(mainWindow);

    mainWindow.on('closed', () => {
        mainWindow = null;
        app.quit();
    });
}

function createSettingsWindow() {
    settingsWindow = new BrowserWindow({
        width: 768,
        height: 480,
        modal: true,
        parent: mainWindow,
        show: false
    });

    settingsWindow.loadURL(url.format({
        pathname: path.join(__dirname, 'settings.html'),
        protocol: 'file:',
        slashes: true
    }));

    settingsWindow.once('ready-to-show', () => {
        settingsWindow.webContents.send('config', config);
        settingsWindow.setMenu(null);
        settingsWindow.show();
    });



    // SettingsWindow.webContents.openDevTools();
}

app.on('ready', createWindows);

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
});

app.on('activate', () => {
    if (mainWindow === null) {
        createWindows();
    }
});

ipc.on('getshortcuts', event => {
    event.sender.send('shortcuts', JSON.stringify(shortcuts));
});

ipc.on('getchannels', event => {
    event.sender.send('channels', config.channels);
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
    const tmp = JSON.parse(data);
    const seqs = Object.keys(tmp);
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
    const tmp = JSON.parse(data);
    const scs = Object.keys(tmp);
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

ipc.on('saveShortcuts', (event, data) => {
    shortcuts = JSON.parse(data);
    saveShortcuts();
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

ipc.on('saveConfig', (event, c) => {
    console.log('saveConfig');
    config = c;
    saveConfig();
    app.relaunch();
    mainWindow.destroy();
    app.quit();
});
