/* global window, document */
/* eslint-disable import/no-unassigned-import */

const electron = require('electron');

const ipc = electron.ipcRenderer;
const remote = electron.remote;
const $ = require('jquery');

window.$ = $;
window.jQuery = $;

require('./node_modules/bootstrap/dist/js/npm.js');
require('./node_modules/bootstrap-slider/dist/bootstrap-slider.min');

require('./node_modules/jquery-ui/ui/widget.js');
require('./node_modules/jquery-ui/ui/data.js');
require('./node_modules/jquery-ui/ui/scroll-parent.js');

require('./node_modules/jquery-ui/ui/widgets/mouse.js');
require('./node_modules/jquery-ui/ui/widgets/sortable.js');

require('./node_modules/free-jqgrid/dist/jquery.jqgrid.min')(window, $);

const data = new Array(512).fill(null);

let channelCount;

let scenes = {};
let sceneNames = {};
let sequences = {};
let sequenceSettings = {};
let sequenceNames = {};
let shortcuts = [];
let selectedSeq;
let selectedScene;
let selectedStep;
const runningSequences = {};

function appendChannel(channel) {
    $('#mixer').append(`
      <div id="channel-${channel}" class="channel">
        <div class="channel-title">${channel}</div>
        <div class="slider-container">
          <div class="channel-slider" data-channel="${channel}"></div>
        </div>
        <div class="value-container">
          <input type="number" min="0" max="255" class="channel-value" data-channel="${channel}">
        </div>
        <label class="checkbox-container">
          <input type="checkbox" class="channel-active" data-channel="${channel}" checked>
        </label>
      </div>
    `);

    $('#channel-' + channel + ' div.channel-slider').slider({
        min: 0,
        max: 255,
        step: 1,
        tooltip: 'hide',
        orientation: 'vertical',
        reversed: true,
        focus: true
    }).on('slide', function (event) {
        const idx = parseInt($(this).data('channel'), 10) - 1;
        const $container = $(this).parent().parent();
        $container.find('input.channel-value').val(event.value);
        // If ($container.find('input.channel-active').is(':checked')) {
        data[idx] = event.value;
        // } else {
        //    data[idx] = null;
        // }
        update(true);
    });

    $('#channel-' + channel + ' input.channel-value').on('change input', function () {
        const idx = parseInt($(this).data('channel'), 10) - 1;
        const $container = $(this).parent().parent();
        $container.find('div.channel-slider').slider('setValue', $(this).val());
        if ($container.find('input.channel-active').is(':checked')) {
            data[idx] = parseInt($(this).val(), 10);
        } else {
            data[idx] = null;
        }
        update();
    });

    $('#channel-' + channel + ' input.channel-active').on('change', function () {
        const idx = parseInt($(this).data('channel'), 10) - 1;
        if ($(this).is(':checked')) {
            data[idx] = parseInt($(this).parent().parent().find('input.channel-value').val(), 10);
        } else {
            data[idx] = null;
        }
        update();
    });
}

function update(all) {
    let last = 0;
    $('input.channel-active').each(function () {
        if (all || $(this).is(':checked')) {
            const ch = $(this).data('channel');
            if (ch > last) {
                last = ch;
            }
        }
    });
    ipc.send('data', data.slice(0, last));
}

function load(d) {
    d.forEach((val, idx) => {
        data[idx] = val;
        const channel = idx + 1;
        if (val === null) {
            $('input.channel-active[data-channel=' + channel + ']').prop('checked', false);
        } else {
            $('input.channel-active[data-channel=' + channel + ']').prop('checked', true);
            $('input.channel-value[data-channel=' + channel + ']').val(val);
            $('div.channel-slider[data-channel=' + channel + ']').slider('setValue', val);
        }
    });
    update();
}

function saveScene() {
    const values = [];
    for (let i = 1; i <= channelCount; i++) {
        if ($('input.channel-active[data-channel="' + i + '"]').is(':checked')) {
            values[i - 1] = parseInt($('input.channel-value[data-channel="' + i + '"]').val(), 10);
        } else {
            values[i - 1] = null;
        }
    }
    return values;
}

function updateData(d) {
    d.forEach((val, idx) => {
        // eslint-disable-next-line eqeqeq, no-eq-null
        if (val == null) {
            return;
        }
        data[idx] = val;
        const channel = idx + 1;
        $('input.channel-value[data-channel=' + channel + ']').val(val);
        $('div.channel-slider[data-channel=' + channel + ']').slider('setValue', val);
    });
}

ipc.on('data', (event, d) => {
    updateData(JSON.parse(d));
});

ipc.on('seqstep', (event, step) => {
    if (step.sequence === selectedSeq) {
        const $row = $('table#steps tr[id=' + step.index + ']');
        if (step.action === 'finish') {
            $row.removeClass('trans');
            $row.removeClass('hold');
        } else if (step.action === 'hold') {
            $row.addClass('hold');
            $row.removeClass('trans');
        } else {
            $row.addClass('trans');
            $row.removeClass('hold');
        }
    }
});

$(document).ready(() => {
    ipc.send('getchannels');
    ipc.on('channels', (event, c) => {
        channelCount = c;
        for (let i = 1; i <= channelCount; i++) {
            appendChannel(i);
        }
        load(new Array(512).fill(0));
        initGrids();
    });
});

function initGrids() {
    const defaultOptions = {
        cmTemplate: {autoResizable: true, editable: true},
        autowidth: true,
        width: '100%',
        caption: 'Scenes',
        height: 200,
        guiStyle: 'bootstrap',
        inlineEditing: {keys: true},
        hidegrid: false,
        iconSet: 'fontAwesome'
    };

    $('#scenes').jqGrid($.extend({}, defaultOptions, {
        colModel: [
            {
                name: 'name',
                editrules: {required: true}
            }
        ],
        data: [],
        beforeSelectRow(rowid, e) {
            if ($(this).getGridParam('selrow') === rowid) {
                load(scenes[e.target.innerText]);
                return false;
            }
            return true;
        },
        onSelectRow(rowid, status, e) {
            if (e.target) {
                selectedScene = e.target.innerText;
                load(scenes[e.target.innerText]);
            }
            $('#scene-del').prop('disabled', false);
            $('button.shortcut-scene').prop('disabled', false);
            $('#scene-save').prop('disabled', false);
            if (!$('#sequence-del').prop('disabled')) {
                $('#step-new').prop('disabled', false);
            }
        },
        ondblClickRow(rowid) {
            const $this = $(this);
            const savedRow = $this.jqGrid('getGridParam', 'savedRow');

            if (savedRow.length > 0 && savedRow[0].id !== rowid) {
                $this.jqGrid('restoreRow', savedRow[0].id);
            }

            $this.jqGrid('editRow', rowid, {
                focusField: 'name',
                aftersavefunc(id, j, row) {
                    if (sceneNames[row.name] !== parseInt(id, 10)) {
                        row.name = nextName(Object.keys(sceneNames), row.name);
                        scenes[row.name] = scenes[selectedScene];
                        delete scenes[selectedScene];
                        ipc.send('saveScenes', JSON.stringify(scenes));
                        selectedScene = row.name;
                        loadScenes();
                        $('#scenes').jqGrid('setSelection', sceneNames[selectedScene], true);
                        $('#scenes #' + $('#scenes').jqGrid('getGridParam', 'selrow')).focus();
                    }
                }
            });
        }
    })).jqGrid('filterToolbar').jqGrid('gridResize');

    $('#sequences').jqGrid($.extend({}, defaultOptions, {
        actionsNavOptions: {
            editbutton: false,
            delbutton: false,
            custom: [
                {
                    action: 'play',
                    position: 'first',
                    onClick(options) {
                        const row = $('#sequences').jqGrid('getRowData', options.rowid);
                        const settings = {
                            name: row.name,
                            repeat: row.repeat !== 'false',
                            shuffle: row.shuffle !== 'false',
                            speed: $('#speed-slider-' + options.rowid).slider('getValue')
                        };
                        ipc.send('seqstart', settings);
                        checkShortcuts(settings);
                    }
                },
                /* {
                    action: 'next',
                    position: 'first',
                    onClick: function (options) {
                        alert('next, rowid=' + options.rowid);
                    }
                }, */
                {
                    action: 'stop',
                    position: 'first',
                    onClick(options) {
                        const row = $('#sequences').jqGrid('getRowData', options.rowid);
                        ipc.send('seqstop', row.name);
                        checkShortcuts({name: row.name});
                    }
                }
            ],
            /* Nexticon: 'fa-step-forward',
            nexttitle: 'Next Step', */
            playicon: 'fa-play',
            playtitle: 'Start',
            stopicon: 'fa-stop',
            stoptitle: 'Stop'
        },
        colModel: [
            {
                name: 'name',
                editable: true
            },
            {
                name: 'speed',
                search: false,
                width: 160,
                sortable: false,
                align: 'center',
                editable: false,
                formatter(cellvalue, options) {
                    return `<input value="${cellvalue}" type="number" class="speed-slider" id="speed-slider-${options.rowId}">`;
                }
            },
            {
                name: 'repeat',
                search: false,
                align: 'center',
                width: 40,
                sortable: false,
                editable: true,
                edittype: 'checkbox',
                editoptions: {value: 'true:false'},
                formatter: 'checkbox',
                formatoptions: {disabled: false}
            },
            {
                name: 'shuffle',
                label: 'shuffle',
                align: 'center',
                search: false,
                width: 40,
                sortable: false,
                editable: true,
                edittype: 'checkbox',
                editoptions: {value: 'true:false'},
                formatter: 'checkbox',
                formatoptions: {disabled: false}
            },

            {
                name: 'act',
                width: 80,
                label: '',
                search: false,
                editable: false,
                sortable: false,
                template: 'actions'
            }
        ],
        data: [],
        beforeSelectRow(rowid) {
            if ($(this).getGridParam('selrow') === rowid) {
                return false;
            }
            return true;
        },
        caption: 'Sequences',
        onSelectRow(rowid) {
            loadSteps($('#sequences').jqGrid('getCell', rowid, 'name'));
            $('#sequence-del').prop('disabled', false);
            $('#sequence-dup').prop('disabled', false);
            $('button.shortcut-seq').prop('disabled', false);

            if (!$('#scene-save').prop('disabled')) {
                $('#step-new').prop('disabled', false);
            }
        },
        ondblClickRow(rowid) {
            const $this = $(this);
            const savedRow = $this.jqGrid('getGridParam', 'savedRow');

            if (savedRow.length > 0 && savedRow[0].id !== rowid) {
                $this.jqGrid('restoreRow', savedRow[0].id);
            }

            $this.jqGrid('editRow', rowid, {
                focusField: 'name',
                aftersavefunc(id, j, row) {
                    if (sequenceNames[row.name] !== parseInt(id, 10)) {
                        row.name = nextName(Object.keys(sequenceNames), row.name);
                        sequences[row.name] = sequences[selectedSeq];
                        ipc.send('seqstop', selectedSeq);
                        checkShortcuts({name: selectedSeq});
                        delete sequences[selectedSeq];
                        ipc.send('saveSequences', JSON.stringify(sequences));
                        selectedSeq = row.name;
                        loadSequences();
                        $('#sequences').jqGrid('setSelection', sequenceNames[selectedSeq], true);
                        $('#sequences #' + $('#sequences').jqGrid('getGridParam', 'selrow')).focus();
                    }
                }
            });
        },
        onEditRow() {

        },
        gridComplete() {
            $('[aria-describedby="sequences_repeat"] input[type="checkbox"]').change(function () {
                const id = $(this).parents('tr').prop('id');
                const row = $('#sequences').jqGrid('getRowData', id);
                const settings = {
                    id,
                    name: row.name,
                    repeat: row.repeat !== 'false',
                    shuffle: row.shuffle !== 'false',
                    speed: $('#speed-slider-' + id).slider('getValue')
                };
                if (runningSequences[row.name] === 'play') {
                    ipc.send('seqstart', settings);
                    checkShortcuts(settings);
                }
                sequenceSettings[row.name] = settings;
                ipc.send('saveSequenceSettings', JSON.stringify(sequenceSettings));
            });
            $('[aria-describedby="sequences_shuffle"] input[type="checkbox"]').change(function () {
                const id = $(this).parents('tr').prop('id');
                const row = $('#sequences').jqGrid('getRowData', id);
                const settings = {
                    id,
                    name: row.name,
                    repeat: row.repeat !== 'false',
                    shuffle: row.shuffle !== 'false',
                    speed: $('#speed-slider-' + id).slider('getValue')
                };
                if (runningSequences[row.name] === 'play') {
                    ipc.send('seqstart', settings);
                    checkShortcuts(settings);
                }
                sequenceSettings[row.name] = settings;
                ipc.send('saveSequenceSettings', JSON.stringify(sequenceSettings));
            });

            $('.speed-slider').each(function () {
                $(this).slider({
                    min: 0.05,
                    max: 40,
                    step: 0.05,
                    scale: 'logarithmic',
                    tooltip: 'always',
                    value: parseFloat($(this).val()) || 1,
                    focus: true
                });
                $(this).on('slide change', event => {
                    if (typeof event.value.newValue !== 'undefined') {
                        event.value = event.value.newValue;
                    }
                    const id = event.target.id.replace('speed-slider-', '');
                    const row = $('#sequences').jqGrid('getRowData', id);
                    const settings = {
                        id,
                        name: row.name,
                        repeat: row.repeat !== 'false',
                        shuffle: row.shuffle !== 'false',
                        speed: event.value
                    };
                    const gridData = $('#sequences').jqGrid('getGridParam').data;
                    gridData[id] = settings;
                    $('#sequences').jqGrid('setGridParam', {data: gridData});
                    if (runningSequences[row.name] === 'play') {
                        ipc.send('seqstart', settings);
                        checkShortcuts(settings);
                    }
                    sequenceSettings[row.name] = settings;
                    ipc.send('saveSequenceSettings', JSON.stringify(sequenceSettings));
                });
            });
        }
    })).jqGrid('filterToolbar').jqGrid('gridResize');

    $('#steps').jqGrid($.extend({}, defaultOptions, {
        colModel: [
            {
                name: 'id',
                width: 36,
                align: 'right',
                search: false,
                editable: false,
                sorttype: 'int',
                firstsortorder: 'asc'
            },
            {
                name: 'scene',
                search: false,
                sortable: false,
                editable: false
            },
            {
                name: 'hold',
                width: 36,
                align: 'right',
                editable: true,
                search: false,
                sortable: false
            },
            {
                name: 'trans',
                width: 36,
                align: 'right',
                editable: true,
                search: false,
                sortable: false
            }
        ],
        data: [],
        caption: 'Sequence Steps',
        beforeSelectRow(rowid) {
            if ($(this).getGridParam('selrow') === rowid) {
                return false;
            }
            return true;
        },
        onSelectRow(rowId) {
            selectedStep = rowId;
            $('#step-del').prop('disabled', false);
        },
        ondblClickRow(rowid, iRow, iCol) {
            const $this = $(this);
            const savedRow = $this.jqGrid('getGridParam', 'savedRow');

            if (savedRow.length > 0 && savedRow[0].id !== rowid) {
                $this.jqGrid('restoreRow', savedRow[0].id);
            }

            $this.jqGrid('editRow', rowid, {
                focusField: iCol,
                aftersavefunc(id, j, row) {
                    sequences[selectedSeq][id] = [row.scene, row.trans, row.hold];
                    ipc.send('seqstop', selectedSeq);
                    checkShortcuts({name: selectedSeq});
                    ipc.send('saveSequences', JSON.stringify(sequences));
                }
            });
        }
    })).jqGrid('sortableRows', {
        cursor: 'move',
        update() {
            const rows = $('#steps').jqGrid('getRowData');
            rows.forEach((row, id) => {
                row.id = id;
                sequences[selectedSeq][id] = [row.scene, row.trans, row.hold];
                ipc.send('seqstop', selectedSeq);
                checkShortcuts({name: selectedSeq});
                ipc.send('saveSequences', JSON.stringify(sequences));
                loadSteps(selectedSeq);
            });
        }
    }).jqGrid('filterToolbar').jqGrid('gridResize');

    $('#steps').jqGrid('sortGrid', 'id', true, 'asc');

    resizeGrids();
    $(window).resize(resizeGrids);

    ipc.on('scenes', (event, data) => {
        scenes = JSON.parse(data);
        loadScenes();
    });
    ipc.on('sequences', (event, data) => {
        sequences = JSON.parse(data);
        ipc.send('getsequenceSettings');
    });
    ipc.on('shortcuts', (event, data) => {
        shortcuts = JSON.parse(data);
        loadShortcuts();
        $('#start').hide();
    });
    ipc.on('sequenceSettings', (event, data) => {
        sequenceSettings = JSON.parse(data);
        loadSequences();
        ipc.send('getshortcuts');
    });

    ipc.send('getscenes');
    ipc.send('getsequences');
}

function resizeGrids() {
    const height = $(window).height() - 456;
    const width = $('#sequences-container').width() - 2;
    $('#scenes')
        .jqGrid('setGridWidth', width)
        .jqGrid('setGridHeight', height)
        .jqGrid('gridResize');
    $('#sequences')
        .jqGrid('setGridWidth', width)
        .jqGrid('setGridHeight', height)
        .jqGrid('gridResize');
    $('#steps')
        .jqGrid('setGridWidth', width)
        .jqGrid('setGridHeight', height + 20)
        .jqGrid('gridResize');
}

function loadScenes() {
    const gridData = [];
    $('#scenes').jqGrid('clearGridData');
    $('#scene-del').prop('disabled', true);
    $('button.shortcut-scene').prop('disabled', true);
    $('#scene-save').prop('disabled', true);
    $('#step-new').prop('disabled', true);
    sceneNames = {};
    Object.keys(scenes).forEach((name, id) => {
        sceneNames[name] = id;
        gridData.push({id, name});
    });
    $('#scenes').addRowData('id', gridData);
    $('#scenes').jqGrid('sortGrid', 'name', true, 'asc');
}

function loadSequences() {
    const gridData = [];
    $('#sequences').jqGrid('clearGridData');
    $('#sequences-del').prop('disabled', true);
    $('#sequences-dup').prop('disabled', true);
    $('button.shortcut-seq').prop('disabled', true);

    sequenceNames = {};
    Object.keys(sequences).forEach((name, id) => {
        sequenceNames[name] = id;
        if (!sequenceSettings[name]) {
            sequenceSettings[name] = {speed: 1, repeat: true, shuffle: false};
        }
        gridData.push({
            id,
            name,
            speed: sequenceSettings[name].speed,
            repeat: sequenceSettings[name].repeat,
            shuffle: sequenceSettings[name].shuffle
        });
    });
    ipc.send('saveSequenceSettings', JSON.stringify(sequenceSettings));
    $('#sequences').addRowData('id', gridData);
    $('#sequences').jqGrid('sortGrid', 'name', true, 'asc');
    Object.keys(runningSequences).forEach(s => {
        if (runningSequences[s] === 'play') {
            const $row = $('table#sequences tr[id=' + sequenceNames[s] + ']');
            $row.addClass('hold');
        }
    });
}

function loadSteps(seq) {
    selectedSeq = seq;
    const gridData = [];
    $('#steps').jqGrid('clearGridData');
    $('#step-del').prop('disabled', true);
    sequences[seq].forEach((step, id) => {
        gridData.push({id, scene: step[0], trans: step[1], hold: step[2]});
    });
    $('#steps').addRowData('id', gridData);
    $('#steps').jqGrid('sortGrid', 'id', true, 'asc');
}

ipc.on('seqstart', (event, seq) => {
    runningSequences[seq] = 'play';
    const settings = {
        name: seq,
        repeat: sequenceSettings[seq].repeat,
        shuffle: sequenceSettings[seq].shuffle,
        speed: sequenceSettings[seq].speed
    };
    checkShortcuts(settings);
    $('#jPlayButton_' + sequenceNames[seq]).addClass('btn-info');
    $('#jPauseButton_' + sequenceNames[seq]).removeClass('btn-info');
    const $row = $('table#sequences tr[id=' + sequenceNames[seq] + ']');
    $row.addClass('hold');
    $row.removeClass('trans');
});
ipc.on('seqstop', (event, seq) => {
    delete runningSequences[seq];
    checkShortcuts({name: seq});
    $('#jPlayButton_' + sequenceNames[seq]).removeClass('btn-info');
    $('#jPauseButton_' + sequenceNames[seq]).removeClass('btn-info');
    const $row = $('table#sequences tr[id=' + sequenceNames[seq] + ']');
    $row.removeClass('hold');
    $row.removeClass('trans');
});
ipc.on('seqpause', (event, seq) => {
    runningSequences[seq] = 'pause';
    $('#jPlayButton_' + sequenceNames[seq]).removeClass('btn-info');
    $('#jPauseButton_' + sequenceNames[seq]).addClass('btn-info');
    const $row = $('table#sequences tr[id=' + sequenceNames[seq] + ']');
    $row.removeClass('hold');
    $row.addClass('trans');
});

$('#step-new').click(() => {
    if (sequences[selectedSeq].length > 0) {
        const lastStep = sequences[selectedSeq][sequences[selectedSeq].length - 1];
        sequences[selectedSeq].push([selectedScene, lastStep[1], lastStep[2]]);
    } else {
        sequences[selectedSeq].push([selectedScene, 1, 1]);
    }
    ipc.send('seqstop', selectedSeq);
    checkShortcuts({name: selectedSeq});
    ipc.send('saveSequences', JSON.stringify(sequences));
    loadSteps(selectedSeq);
});

$('#step-del').click(() => {
    sequences[selectedSeq].splice(selectedStep, 1);
    ipc.send('seqstop', selectedSeq);
    checkShortcuts({name: selectedSeq});
    ipc.send('saveSequences', JSON.stringify(sequences));
    loadSteps(selectedSeq);
});

function nextName(names, name) {
    const base = name.replace(/_[0-9]+$/, '');
    let i = 0;
    while (names.indexOf(name) !== -1) {
        name = base + '_' + (i++);
    }
    return name;
}

$('#sequence-new').click(() => {
    const name = nextName(Object.keys(sequenceNames), 'sequence');
    sequences[name] = [];
    ipc.send('saveSequences', JSON.stringify(sequences));
    loadSequences();
    selectedSeq = name;
    $('#sequences').jqGrid('setSelection', sequenceNames[selectedSeq], true);
    $('#sequences #' + $('#sequences').jqGrid('getGridParam', 'selrow')).focus();
});

$('#sequence-dup').click(() => {
    const name = nextName(Object.keys(sequenceNames), selectedSeq);
    sequences[name] = $.extend([], sequences[selectedSeq]);
    ipc.send('saveSequences', JSON.stringify(sequences));
    loadSequences();
    selectedSeq = name;
    $('#sequences').jqGrid('setSelection', sequenceNames[selectedSeq], true);
    $('#sequences #' + $('#sequences').jqGrid('getGridParam', 'selrow')).focus();
});

$('#sequence-del').click(() => {
    remote.dialog.showMessageBox({
        message: `Really delete Sequence "${selectedSeq}"?`,
        buttons: [
            'Delete',
            'Cancel'
        ]
    }, res => {
        if (res === 0) {
            delete sequences[selectedSeq];
            delete sequenceSettings[selectedSeq];
            ipc.send('saveSequences', JSON.stringify(sequences));
            selectedSeq = null;
            loadSequences();
        }
    });
});

$('#scene-del').click(() => {
    remote.dialog.showMessageBox({
        message: `Really delete Scene "${selectedScene}"?`,
        buttons: [
            'Delete',
            'Cancel'
        ]
    }, res => {
        if (res === 0) {
            delete scenes[selectedScene];
            ipc.send('saveScenes', JSON.stringify(scenes));
            selectedScene = null;
            loadScenes();
        }
    });
});

$('#scene-save').click(() => {
    scenes[selectedScene] = saveScene();
    ipc.send('saveScenes', JSON.stringify(scenes));
    loadScenes();
});

$('#scene-new').click(() => {
    const name = nextName(Object.keys(scenes), 'scene');
    scenes[name] = saveScene();
    ipc.send('saveScenes', JSON.stringify(scenes));
    loadScenes();
    selectedScene = name;
    $('#scenes').jqGrid('setSelection', sceneNames[name], true);
    $('#scenes #' + $('#scenes').jqGrid('getGridParam', 'selrow')).focus();
});

ipc.on('shortcutedit', (event, mode) => {
    console.log('shortcutedit', mode);
    if (mode) {
        $('#shortcuts-container').hide();
        $('#shortcutsedit-container').show();
    } else {
        $('#shortcutsedit-container').hide();
        $('#shortcuts-container').show();
    }
});

$('button.shortcut-seq').click(function () {
    const id = parseInt($(this).parent().data('shortcut'), 10);
    const desc = (sequenceSettings[selectedSeq].repeat ? 'R' : '') +
        (sequenceSettings[selectedSeq].shuffle ? 'S' : '') +
        sequenceSettings[selectedSeq].speed;
    $(this).parent().find('span').html(selectedSeq + ' ' + desc);
    shortcuts[id] = {
        type: 'seq',
        name: selectedSeq,
        settings: sequenceSettings[selectedSeq],
        desc
    };
    loadShortcuts();
    ipc.send('saveShortcuts', JSON.stringify(shortcuts));
});

$('button.shortcut-scene').click(function () {
    const id = parseInt($(this).parent().data('shortcut'), 10);
    $(this).parent().find('span').html(selectedScene);
    shortcuts[id] = {
        type: 'scene',
        name: selectedScene
    };
    loadShortcuts();
    ipc.send('saveShortcuts', JSON.stringify(shortcuts));
});
const activeShortcuts = {};
function loadShortcuts() {
    shortcuts.forEach((s, i) => {
        if (s) {
            const $button = $('button[data-shortcut="' + i + '"]');
            $button.prop('disabled', false);
            $button.unbind('click');
            if (s.type === 'scene') {
                $button.html(s.name);
                $('.shortcutedit-box[data-shortcut="' + i + '"] span').html(s.name);
                $button.addClass('btn-info');
                $button.removeClass('btn-primary');
                $button.click(() => {
                    load(scenes[s.name]);
                });
            } else {
                $button.html(s.name + ' ' + s.desc);
                $('.shortcutedit-box[data-shortcut="' + i + '"] span').html(s.name + ' ' + s.desc);
                $button.removeClass('btn-info');
                $button.addClass('btn-primary');
                const {repeat, shuffle, speed} = s.settings;
                $button.click(() => {
                    if (activeShortcuts[i]) {
                        delete activeShortcuts[i];
                        $button.removeClass('active');
                        ipc.send('seqstop', s.name);
                        checkShortcuts({name: s.name});
                    } else if (sequences[s.name]) {
                        activeShortcuts[i] = true;
                        $button.addClass('active');
                        const settings = {
                            name: s.name,
                            repeat,
                            shuffle,
                            speed
                        };
                        ipc.send('seqstart', settings);
                        sequenceSettings[s.name] = {repeat, shuffle, speed};
                        loadSequences();
                        checkShortcuts(settings);
                        $('#sequences').jqGrid('setSelection', sequenceNames[s.name], true);
                        $('#sequences #' + $('#sequences').jqGrid('getGridParam', 'selrow')).focus();
                    }
                });
            }
        }
    });
}

function checkShortcuts(settings) {
    console.log('checkShortcuts', settings);
    shortcuts.forEach((s, i) => {
        if (
            s &&
            s.type === 'seq' &&
            !sequences[s.name]
        ) {
            $('button[data-shortcut="' + i + '"]').html('')
                .addClass('btn-info')
                .removeClass('btn-primary')
                .removeClass('active')
                .prop('disabled', true);
            delete shortcuts[i];
            ipc.send('saveShortcuts', JSON.stringify(shortcuts));
        } else if (
            s &&
            s.type === 'seq' &&
            s.name === settings.name &&
            (
                s.settings.repeat !== settings.repeat ||
                s.settings.shuffle !== settings.shuffle ||
                s.settings.speed !== settings.speed
            )
        ) {
            delete activeShortcuts[i];
            $('button[data-shortcut="' + i + '"]').removeClass('active');
        } else if (
            s &&
            s.type === 'seq' &&
            s.name === settings.name &&
            s.settings.repeat === settings.repeat &&
            s.settings.shuffle === settings.shuffle &&
            s.settings.speed === settings.speed
        ) {
            activeShortcuts[i] = true;
            $('button[data-shortcut="' + i + '"]').addClass('active');
        }
    });
}
