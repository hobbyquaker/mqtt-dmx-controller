const electron = require('electron');
const ipc = electron.ipcRenderer;
const $ = jQuery = require('jquery');
window.$ = window.jQuery = jQuery;

require('./node_modules/bootstrap/dist/js/npm.js');
//require('./node_modules/jquery-ui-dist/jquery-ui.min');
require('./node_modules/bootstrap-slider/dist/bootstrap-slider.min');
require('./node_modules/free-jqgrid/dist/jquery.jqgrid.min')(window, jQuery);

const data = new Array(512).fill(null);

const scenes = {
    "led white":        [null, 0, 0, 0, null, 0, 0, 0, null, 0, 0, 0, null, 0, 0, 0, null, 0, 0, 0, null, 0, 0, 0],
    "led cyan":         [null, 255, 0, 0, null, 255, 0, 0, null, 255, 0, 0, null, 255, 0, 0, null, 255, 0, 0, null, 255, 0, 0],
    "led magenta":      [null, 0, 255, 0, null, 0, 255, 0, null, 0, 255, 0, null, 0, 255, 0, null, 0, 255, 0, null, 0, 255, 0],
    "led yellow":       [null, 0, 0, 255, null, 0, 0, 255, null, 0, 0, 255, null, 0, 0, 255, null, 0, 0, 255, null, 0, 0, 255],
    "led red":          [null, 0, 255, 255, null, 0, 255, 255, null, 0, 255, 255, null, 0, 255, 255, null, 0, 255, 255, null, 0, 255, 255],
    "led blue":         [null, 255, 255, 0, null, 255, 255, 0, null, 255, 255, 0, null, 255, 255, 0, null, 255, 255, 0, null, 255, 255, 0],
    "led green":        [null, 255, 0, 255, null, 255, 0, 255, null, 255, 0, 255, null, 255, 0, 255, null, 255, 0, 255, null, 255, 0, 255],
    "led on":           [255, null, null, null, 255, null, null, null, 255, null, null, null, 255, null, null, null, 255, null, null, null, 255, null, null, null],
    "led off":          [0, null, null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null, 0, null, null, null],
    "led 1 off":        [0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    "led 2 off":        [null, null, null, null, 0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    "led 3 off":        [null, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null],
    "led 4 off":        [null, null, null, null, null, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null, null, null, null, null],
    "led 5 off":        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, null, null, null, null, null, null, null],
    "led 6 off":        [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, null, null, null],
    "led 1 on":         [255],
    "led 2 on":         [null, null, null, null, 255],
    "led 3 on":         [null, null, null, null, null, null, null, null, 255],
    "led 4 on":         [null, null, null, null, null, null, null, null, null, null, null, null, 255],
    "led 5 on":         [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255],
    "led 6 on":         [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255],



    "led 1 white":      [null, 0, 0, 0],
    "led 1 cyan":       [null, 255, 0, 0],
    "led 1 magenta":    [null, 0, 255, 0],
    "led 1 yellow":     [null, 0, 0, 255],
    "led 1 red":        [null, 0, 255, 255],
    "led 1 blue":       [null, 255, 255, 0],
    "led 1 bc2":       [null, 255, 160, 0],
    "led 1 bc1":       [null, 255, 80, 0],
    "led 1 green":      [null, 255, 0, 255],

    "led 2 white":      [null, null, null, null, null, 0, 0, 0],
    "led 2 cyan":     [null, null, null, null, null, 255, 0, 0],
    "led 2 magenta":     [null, null, null, null, null, 0, 255, 0],
    "led 2 yellow":     [null, null, null, null, null, 0, 0, 255],
    "led 2 red":     [null, null, null, null, null, 0, 255, 255],
    "led 2 blue":     [null, null, null, null, null, 255, 255, 0],
    "led 2 bc2":       [null, null, null, null, null, 255, 160, 0],
    "led 2 bc1":       [null, null, null, null, null, 255, 80, 0],
    "led 2 green":    [null, null, null, null, null, 255, 0, 255],

    "led 3 white":     [null, null, null, null, null, null, null, null, null, 0, 0, 0],
    "led 3 cyan":     [null, null, null, null, null, null, null, null, null, 255, 0, 0],
    "led 3 magenta":     [null, null, null, null, null, null, null, null, null, 0, 255, 0],
    "led 3 yellow":     [null, null, null, null, null, null, null, null, null, 0, 0, 255],
    "led 3 red":     [null, null, null, null, null, null, null, null, null, 0, 255, 255],
    "led 3 blue":     [null, null, null, null, null, null, null, null, null, 255, 255, 0],
    "led 3 bc2":       [null, null, null, null, null, null, null, null, null, 255, 160, 0],
    "led 3 bc1":       [null, null, null, null, null, null, null, null, null, 255, 80, 0],
    "led 3 green":    [null, null, null, null, null, null, null, null, null, 255, 0, 255],

    "led 4 white":     [null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0],
    "led 4 cyan":     [null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 0, 0],
    "led 4 magenta":     [null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 255, 0],
    "led 4 yellow":     [null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 255],
    "led 4 red":     [null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 255, 255],
    "led 4 blue":     [null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 255, 0],
    "led 4 bc2":       [null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 160, 0],
    "led 4 bc1":       [null, null, null, null, null, null, null, null, null, null, null, null, null,  255, 80, 0],
    "led 4 green":    [null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 0, 255],

    "led 5 white":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0],
    "led 5 cyan":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 0, 0],
    "led 5 magenta":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 255, 0],
    "led 5 yellow":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 255],
    "led 5 red":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 255, 255],
    "led 5 blue":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 255, 0],
    "led 5 bc2":       [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 160, 0],
    "led 5 bc1":       [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 80, 0],
    "led 5 green":    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 0, 255],

    "led 6 white":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 0],
    "led 6 cyan":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 0, 0],
    "led 6 magenta":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 255, 0],
    "led 6 yellow":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 0, 255],
    "led 6 red":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 0, 255, 255],
    "led 6 blue":     [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 255, 0],
    "led 6 bc2":       [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 160, 0],
    "led 6 bc1":       [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 80, 0],
    "led 6 green":    [null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, null, 255, 0, 255]
};

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
        reversed: true
    }).on('slide', function (event) {
        const idx = parseInt($(this).data('channel'), 10) - 1;
        const $container = $(this).parent().parent();
        $container.find('input.channel-value').val(event.value);
        if ($container.find('input.channel-active').is(':checked')) {
            data[idx] = event.value;
        } else {
            data[idx] = null;
        }
        update();
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



function update() {
    let last = 0;
    $('input.channel-active').each(function () {
        if ($(this).is(':checked')) {
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


$(document).ready(function () {
    for (let i = 1; i <= 24; i++) {
        appendChannel(i);
    }

    load(new Array(512).fill(0));
    initGrids();

    /*
    $('#speed').slider({
        range: "min",
        min: 1,
        max: 25,
        slide: function( event, ui ) {

        }
    });
    */

    $('#scene-del').button().click(function () {

    });

    $('#scene-new').button().click(function () {

    });

    $('#scene-save').button().click(function () {

    });
});

function initGrids() {

    const defaultOptions = {
        cmTemplate: { autoResizable: true, editable: true },
        autowidth:  true,
        width:      '100%',
        caption: 'Scenes',
        height: 200,
        guiStyle: "bootstrap",
        inlineEditing: { keys: true, defaultFocusField: "name", focusField: "name" },
        hidegrid: false
    };

    $('#scenes').jqGrid($.extend(defaultOptions, {
        colModel: [
            {
                name: 'name',
                editrules: {required: true}
            }
        ],
        data: [],
        beforeSelectRow: function(rowid, e) {
            if ($(this).getGridParam('selrow') === rowid) {
                return false;
            } else {
                return true;
            }
        },
        onSelectRow: function (rowid, status, e) {
            load(scenes[e.target.innerText]);
        },
        ondblClickRow: function (rowid, status, e) {
            const $this = $(this);
            const savedRow = $this.jqGrid("getGridParam", "savedRow");

            if (savedRow.length > 0 && savedRow[0].id !== rowid) {
                $this.jqGrid("restoreRow", savedRow[0].id);
            }

            $this.jqGrid("editRow", rowid, {focusField: e.target});
        },
    })).jqGrid("filterToolbar").jqGrid("gridResize");


    loadScenes();


    $('#sequences').jqGrid($.extend(defaultOptions, {
        colModel: [
            { name: 'name' },
            { name: 'tools' }
        ],
        data: [],
        caption: 'Sequences',
    })).jqGrid("filterToolbar").jqGrid("gridResize");

    $('#steps').jqGrid($.extend(defaultOptions, {
        colModel: [
            { name: 'name' },
            { name: 'tools' }
        ],
        data: [],
        caption: 'Sequence Steps',
    })).jqGrid("filterToolbar").jqGrid("gridResize");

    resizeGrids();
    $(window).resize(resizeGrids);
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
        .jqGrid('setGridHeight', height)
        .jqGrid('gridResize');
}

function loadScenes() {
    const gridData = [];
    Object.keys(scenes).forEach((name, id) => {
         gridData.push({id, name});
    });
    $('#scenes').addRowData('id', gridData);
}
