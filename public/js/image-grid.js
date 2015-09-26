requirejs([
    './io',
    './misc',
  ], function(
    io,
    misc) {

  var g = {
    elem: document.getElementById("grid"),
    viewElem: document.getElementById("viewer"),
    viewImg: document.getElementById("viewer-img"),
    viewVideo: document.getElementById("viewer-video"),
    ctx: document.createElement("canvas").getContext("2d"),
    columnWidth: 160,
    padding: 10,
    images: [],
    columns: [],
    queue: [],
    video: document.createElement("video"),
    image: document.createElement("img"),
  };

  misc.applyUrlSettings(g);

  function extname(path) {
    var pndx = path.lastIndexOf('.');
    if (pndx >= 0) {
      return path.substr(pndx);
    }
  }

  var videoExtensions = {
    ".webm": true,
    ".mp4": true,
    ".ogv": true,
  };
  function isVideoExtension(filename) {
    return videoExtensions[extname(filename).toLowerCase()];
  }

  io.sendJSON("/images", {}, function(err, images) {
    Array.prototype.push.apply(g.queue, images);
    processNext();
  });

  g.viewElem.addEventListener('click', hideImage);
  g.viewVideo.addEventListener('canplay', function(e) {
    console.log("canplay");
    e.target.play();
  });
  g.viewVideo.addEventListener('loadeddata', function(e) {
    console.log("loadeddata");
    e.target.play();
  });

  g.video.addEventListener('canplay', function(e) {
    makeThumbnail(e.target, e.target.videoWidth, e.target.videoHeight);
  });

  g.image.addEventListener('load', function(e) {
    makeThumbnail(e.target, e.target.width, e.target.height);
  });

  function makeThumbnail(elem, elemWidth, elemHeight) {
    var imageWidth = g.columnWidth - g.padding;
    var height = elemHeight * imageWidth / elemWidth | 0;
    var ctx = g.ctx;
    ctx.canvas.width = imageWidth;
    ctx.canvas.height = height;
    ctx.drawImage(elem, 0, 0, imageWidth, height);
    loadImage(elem.src, ctx.canvas.toDataURL());
    g.videoPending = false;
    processNext();
  }

  function processNext() {
    if (g.queue.length) {
      var url = g.queue.shift();
      if (isVideoExtension(url)) {
        g.video.pause();
        g.video.currentTime = 0;
        g.video.src = url;
        g.video.load();
      } else {
        g.image.src = url;
      }
    }
  }

  function loadImage(src, url) {
    var img = new Image();
    img.addEventListener('load', function() {
      addElement(img, img.width, img.height);
    });
    img.addEventListener('click', function() {
      viewImage(img);
    });
    img.src = url;
    img.origSrc = src;
  }

  function hideImage() {
    g.viewElem.style.display = "none";
    g.viewVideo.pause();
  }

  function viewImage(img) {
    g.viewElem.style.display = "block";
    g.viewElem.style.top = window.scrollY + "px";
    var url = img.origSrc;
    if (isVideoExtension(url)) {
      g.viewVideo.pause();
      g.viewVideo.src = url;
      g.viewVideo.style.display = "inline-block";
      g.viewVideo.currentTime = 0;
      g.viewVideo.load();
      g.viewImg.style.display = "none";
    } else {
      g.viewImg.src = url;
      g.viewImg.style.display = "inline-block";
      g.viewVideo.pause();
      g.viewVideo.style.display = "none";
    }
  }

  function addElement(elem, elemWidth, elemHeight) {
    g.images.push(elem);
    g.elem.appendChild(elem);
    flowElement(elem, elemWidth, elemHeight);
  }

  function flowElement(elem, elemWidth, elemHeight) {
    var column = shortestColumn();
    var imageWidth = g.columnWidth - g.padding;
    var height = elemHeight * imageWidth / elemWidth | 0;
    var style = elem.style;
    style.position = "absolute";
    style.display = "block";
    var left =(column.ndx * g.columnWidth) + "px";
    style.left  = left;
    style.top   = (column.bottom) + "px";
    style.width = (imageWidth) + "px";
    style.height = (height) + "px";
    column.bottom += height + g.padding;
  }

  function shortestColumn() {
    var shortest = g.columns[0];
    g.columns.forEach(function(column) {
      if (column.bottom < shortest.bottom) {
        shortest = column;
      }
    });

    return shortest;
  }

  function reflow() {
    var width = g.elem.parentNode.clientWidth;
    var numColumns = (width / g.columnWidth | 0) || 1;
    g.elem.style.width = (numColumns * g.columnWidth - g.padding) + "px";
    g.columns = [];
    for (var ii = 0; ii < numColumns; ++ii) {
      g.columns.push({
        ndx: ii,
        bottom: 0,
      });
    }

    g.images.forEach(function(elem) {
      if (elem instanceof HTMLImageElement) {
        flowElement(elem, elem.width, elem.height);
      } else {
        flowElement(elem, elem.videoWidth, elem.viewHeight);
      }
    });
  }

  window.addEventListener('resize', reflow);
  reflow();

});

