// namespaces
var dwvjq = dwvjq || {};

/**
 * Application launcher.
 */

// start app function
function startApp() {
  // translate page
  dwv.i18nPage();

  // show dwv version
  dwvjq.gui.appendVersionHtml('0.7.0-beta');

  // application options
  var filterList = ['Threshold', 'Sharpen', 'Sobel'];

  var shapeList = [
    'Arrow',
    'Ruler',
    'Protractor',
    'Rectangle',
    'Roi',
    'Ellipse',
    'Circle',
    'FreeHand'
  ];

  var toolList = {
    Scroll: {},
    Opacity: {},
    WindowLevel: {},
    ZoomAndPan: {},
    Draw: {
      options: shapeList,
      type: 'factory',
      events: ['drawcreate', 'drawchange', 'drawmove', 'drawdelete']
    },
    Livewire: {
      events: ['drawcreate', 'drawchange', 'drawmove', 'drawdelete']
    },
    Filter: {
      options: filterList,
      type: 'instance',
      events: ['filterrun', 'filterundo']
    },
    Floodfill: {
      events: ['drawcreate', 'drawchange', 'drawmove', 'drawdelete']
    }
  };

  // initialise the application
  var options = {
    dataViewConfigs: {'*': [{divId: 'layerGroup0'}]},
    tools: toolList
    //"defaultCharacterSet": "chinese"
  };

  // main application
  var myapp = new dwv.App();
  myapp.init(options);

  // show help
  var isMobile = true;
  dwvjq.gui.appendHelpHtml(
    myapp.getToolboxController().getToolList(),
    isMobile,
    myapp,
    'resources/help'
  );

  // setup the undo gui
  var undoGui = new dwvjq.gui.Undo(myapp);
  undoGui.setup();

  // setup the dropbox loader
  var dropBoxLoader = new dwvjq.gui.DropboxLoader(myapp);
  dropBoxLoader.init();

  // setup the loadbox gui
  var loadboxGui = new dwvjq.gui.Loadbox(myapp);
  var loaderList = ['File', 'Url', 'GoogleDrive', 'Dropbox'];
  if (dwv.env.hasInputDirectory()) {
    loaderList.splice(1, 0, 'Folder');
  }
  loadboxGui.setup(loaderList);

  // info layer
  var infoController = new dwvjq.gui.info.Controller(myapp, 'dwv');
  infoController.init();

  // setup the tool gui
  var toolboxGui = new dwvjq.gui.ToolboxContainer(myapp, infoController);
  toolboxGui.setup(toolList);

  // setup the meta data gui
  var metaDataGui = new dwvjq.gui.MetaData(myapp);

  // setup the draw list gui
  var drawListGui = new dwvjq.gui.DrawList(myapp);
  drawListGui.init();

  // abort shortcut listener
  var abortOnCrtlX = function (event) {
    if (event.ctrlKey && event.keyCode === 88) {
      // crtl-x
      console.log('Abort load received from user (crtl-x).');
      myapp.abortLoad();
    }
  };

  // handle load events
  var nLoadItem = null;
  var nReceivedError = null;
  var nReceivedAbort = null;
  var isFirstRender = null;
  myapp.addEventListener('loadstart', function (event) {
    // reset counts
    nLoadItem = 0;
    nReceivedError = 0;
    nReceivedAbort = 0;
    isFirstRender = true;
    // hide drop box
    dropBoxLoader.showDropbox(false);
    // reset progress bar
    dwvjq.gui.displayProgress(0);
    // update info controller
    if (event.loadtype === 'image') {
      infoController.onLoadStart();
    }
    // allow to cancel via crtl-x
    window.addEventListener('keydown', abortOnCrtlX);
  });
  myapp.addEventListener('loadprogress', function (event) {
    var percent = Math.ceil((event.loaded / event.total) * 100);
    dwvjq.gui.displayProgress(percent);
  });
  myapp.addEventListener('loaditem', function (event) {
    ++nLoadItem;
    // add new meta data to the info controller
    if (event.loadtype === 'image') {
      infoController.onLoadItem(event);
    }
  });
  myapp.addEventListener('renderend', function (/*event*/) {
    if (isFirstRender) {
      isFirstRender = false;
      infoController.fitContainer();
      // initialise and display the toolbox on first render
      toolboxGui.initialise();
      toolboxGui.display(true);
    }
  });
  myapp.addEventListener('load', function (/*event*/) {
    // initialise undo gui
    undoGui.setup();
    // update meta data table
    metaDataGui.update(myapp.getMetaData(0));
  });
  myapp.addEventListener('error', function (event) {
    console.error('load error', event);
    ++nReceivedError;
  });
  myapp.addEventListener('abort', function (/*event*/) {
    ++nReceivedAbort;
  });
  myapp.addEventListener('loadend', function (/*event*/) {
    // show alert for errors
    if (nReceivedError) {
      var message = 'A load error has ';
      if (nReceivedError > 1) {
        message = nReceivedError + ' load errors have ';
      }
      message += 'occured. See log for details.';
      alert(message);
      // show the drop box if no item were received
      if (!nLoadItem) {
        dropBoxLoader.showDropbox(true);
      }
    }
    // console warn for aborts
    if (nReceivedAbort !== 0) {
      console.warn('Data load was aborted.');
      dropBoxLoader.showDropbox(true);
    }
    // stop listening for crtl-x
    window.removeEventListener('keydown', abortOnCrtlX);
    // hide the progress bar
    dwvjq.gui.displayProgress(100);
  });

  // handle undo/redo
  myapp.addEventListener('undoadd', function (event) {
    undoGui.addCommandToUndoHtml(event.command);
  });
  myapp.addEventListener('undo', function (/*event*/) {
    undoGui.enableLastInUndoHtml(false);
  });
  myapp.addEventListener('redo', function (/*event*/) {
    undoGui.enableLastInUndoHtml(true);
  });

  // handle key events
  myapp.addEventListener('keydown', function (event) {
    myapp.defaultOnKeydown(event);
  });

  // handle window resize
  // WARNING: will fail if the resize happens and the image is not shown
  // (for example resizing while viewing the meta data table)
  window.addEventListener('resize', function () {
    myapp.onResize();
    infoController.fitContainer();
  });

  // possible load from location
  dwvjq.utils.loadFromUri(window.location.href, myapp);
}

// Image decoders (for web workers)
dwv.image.decoderScripts = {
  jpeg2000: 'node_modules/dwv/decoders/pdfjs/decode-jpeg2000.js',
  'jpeg-lossless': 'node_modules/dwv/decoders/rii-mango/decode-jpegloss.js',
  'jpeg-baseline': 'node_modules/dwv/decoders/pdfjs/decode-jpegbaseline.js',
  rle: 'node_modules/dwv/decoders/dwv/decode-rle.js'
};

// status flags
var domContentLoaded = false;
var i18nInitialised = false;
// launch when both DOM and i18n are ready
function launchApp() {
  if (domContentLoaded && i18nInitialised) {
    startApp();
  }
}
// i18n ready?
dwv.i18nOnInitialised(function () {
  // call next once the overlays are loaded
  var onLoaded = function (data) {
    dwvjq.gui.info.overlayMaps = data;
    i18nInitialised = true;
    launchApp();
  };
  // load overlay map info
  $.getJSON(dwv.i18nGetLocalePath('overlays.json'), onLoaded).fail(function () {
    console.log('Using fallback overlays.');
    $.getJSON(dwv.i18nGetFallbackLocalePath('overlays.json'), onLoaded);
  });
});

// check environment support
dwv.env.check();
// initialise i18n
dwv.i18nInitialise('auto', 'node_modules/dwv');

// DOM ready?
$(document).ready(function () {
  domContentLoaded = true;
  launchApp();
});
