/* global window */

const electron = require('electron');

const ipc = electron.ipcRenderer;
const remote = electron.remote;
const $ = require('jquery');

window.$ = $;
window.jQuery = $;

require('./node_modules/bootstrap/dist/js/npm.js'); // eslint-disable-line import/no-unassigned-import

$('#close').click(() => {
    const window = remote.getCurrentWindow();
    window.close();
});

$('#save').click(() => {
    ipc.send('saveConfig', {
        url: $('#settings-mqtt-url').val(),
        name: $('#settings-mqtt-prefix').val(),
        mqtt_username: $('#settings-mqtt-username').val(),
        mqtt_password: $('#settings-mqtt-password').val(),
        address: $('#settings-artnet-host').val(),
        port: $('#settings-artnet-port').val(),
        channels: $('#settings-channels').val()
    });
    const window = remote.getCurrentWindow();
    window.close();
});

ipc.on('config', (event, conf) => {
    $('#settings-mqtt-url').val(conf.url);
    $('#settings-mqtt-prefix').val(conf.name);
    $('#settings-mqtt-username').val(conf.mqtt_username);
    $('#settings-mqtt-password').val(conf.mqtt_password);
    $('#settings-artnet-host').val(conf.address);
    $('#settings-artnet-port').val(conf.port);
    $('#settings-channels').val(conf.channels);
});
