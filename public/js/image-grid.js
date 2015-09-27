requirejs([
    './io',
    './misc',
  ], function(
    io,
    misc) {

  var g = {
    minSize: 256,
    maxParallelDownloads: 8,
    elem: document.getElementById("grid"),
    viewElem: document.getElementById("viewer"),
    viewImg: document.getElementById("viewer-img"),
    viewVideo: document.getElementById("viewer-video"),
    nextElem: document.getElementById("next"),
    prevElem: document.getElementById("prev"),
    ctx: document.createElement("canvas").getContext("2d"),
    columnWidth: 160,
    fitHeight: true,
    padding: 10,
    images: [],
    columns: [],
    queue: [],
    video: document.createElement("video"),
    image: document.createElement("img"),
  };

  misc.applyUrlSettingsDirect(g);

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
  function isGif(filename) {
    return extname(filename).toLowerCase() === ".gif";
  }

  function px(v) {
    return v + "px";
  }

  io.sendJSON("/images", {}, function(err, images) {
    Array.prototype.push.apply(g.queue, images);
    for (var ii = 0; ii < g.maxParallelDownloads; ++ii) {
      processNext();
    }
  });

  g.viewElem.addEventListener('click', hideImage);
  g.viewVideo.addEventListener('canplay', function(e) {
    g.viewVideo.style.display = "inline-block";
    g.viewImg.style.display = "none";
    sizeToFit(g.viewVideo, g.viewVideo.videoWidth, g.viewVideo.videoHeight);
    e.target.play();
  });
  g.viewVideo.addEventListener('loadeddata', function(e) {
    g.viewVideo.style.display = "inline-block";
    g.viewImg.style.display = "none";
    sizeToFit(g.viewVideo, g.viewVideo.videoWidth, g.viewVideo.videoHeight);
    e.target.play();
  });

  g.viewImg.addEventListener('load', function(e) {
    g.viewImg.style.display = "inline-block";
    g.viewVideo.style.display = "none";
    if (isGif(e.target.src) || g.fitHeight) {
      sizeToFit(e.target, e.target.naturalWidth, e.target.naturalHeight);
    } else {
      fitWidth(e.target, e.target.naturalWidth, e.target.naturalHeight);
    }
  });

  g.nextElem.addEventListener('click', gotoNext);
  g.prevElem.addEventListener('click', gotoPrev);

  window.addEventListener('keydown', function(e) {
    switch (e.keyCode) {
    case 37: // left
      gotoPrev(e);
      break;
    case 39: // right
      gotoNext(e);
      break;
    case 38: // up
      e.preventDefault();
      e.stopPropagation();
      window.scrollBy(0, window.innerHeight / -4 | 0);
      break;
    case 40: // down
      e.preventDefault();
      e.stopPropagation();
      window.scrollBy(0, window.innerHeight / 4 | 0);
      break;
    }
  });

  g.video.addEventListener('canplay', function(e) {
    makeThumbnail(e.target, e.target.videoWidth, e.target.videoHeight, "▶︎");
  });
  g.video.addEventListener('error', processNext);

  g.image.addEventListener('load', function(e) {
    makeThumbnail(e.target, e.target.naturalWidth, e.target.naturalHeight, isGif(e.target.src) ? "gif" : "");
  });
  g.image.addEventListener('error', processNext);

  function gotoNext(e) {
    e.preventDefault();
    e.stopPropagation();
    var next = g.currentElem.nextElementSibling;
    if (!next) {
      next = g.currentElem.parentNode.firstElementChild;
    }
    viewImage(next);
  }

  function gotoPrev(e) {
    e.preventDefault();
    e.stopPropagation();
    var prev = g.currentElem.previousElementSibling;
    if (!prev) {
      prev = g.currentElem.parentNode.lastElementChild;
    }
    viewImage(prev);
  }

  function verticallyCenter(height) {
    var dh = window.innerHeight - height;
    g.viewElem.style.top = px(window.scrollY + ((dh > 0) ? (dh / 2 | 0) : 0));
    g.viewElem.style.display = "block";
  }

  function sizeToFit(elem, width, height) {
    var w = width  / window.innerWidth;
    var h = height / window.innerHeight;
    if (w < h) {
      w = width * window.innerHeight / height | 0;
      h = window.innerHeight;
    } else {
      w = window.innerWidth;
      h = height * window.innerWidth / width | 0;
    }
    elem.style.width  = px(w);
    elem.style.height = px(h);
    verticallyCenter(h);
  }

  function fitWidth(elem, width, height) {
    var w = window.innerWidth;
    var h = height * w / width | 0;
    elem.style.width  = px(w);
    elem.style.height = px(h);
    verticallyCenter(h);
  }

  function makeThumbnail(elem, elemWidth, elemHeight, msg) {
    if (isGif(elem.src) || (elemWidth >= g.minSize && elemHeight >= g.minSize)) {
      var imageWidth = g.columnWidth - g.padding;
      var height = elemHeight * imageWidth / elemWidth | 0;
      var ctx = g.ctx;
      ctx.canvas.width = imageWidth;
      ctx.canvas.height = height;
      ctx.fillStyle = "white";
      ctx.textBaseline = "top";
      ctx.drawImage(elem, 0, 0, imageWidth, height);
      ctx.fillText(msg, 5, 5);
      loadImage(elem.src, ctx.canvas.toDataURL());
    }
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
      addElement(img, img.naturalWidth, img.naturalHeight);
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

  function viewImage(img, noHide) {
    var url = img.origSrc;
    g.currentElem = img;
    if (isVideoExtension(url)) {
      g.viewVideo.pause();
      g.viewVideo.src = url;
      g.viewVideo.currentTime = 0;
      g.viewVideo.load();
    } else {
      g.viewImg.src = url;
      g.viewVideo.pause();
    }
  }

  function addElement(elem, elemWidth, elemHeight) {
    g.images.push(elem);
    g.elem.appendChild(elem);
    if (!g.currentElem) {
      g.currentElem = elem;
    }
    flowElement(elem, elemWidth, elemHeight);
  }

  function flowElement(elem, elemWidth, elemHeight) {
    var column = shortestColumn();
    var imageWidth = g.columnWidth - g.padding;
    var height = elemHeight * imageWidth / elemWidth | 0;
    var style = elem.style;
    style.position = "absolute";
    style.display = "block";
    style.left  = px(column.ndx * g.columnWidth);
    style.top   = px(column.bottom);
    style.width = px(imageWidth);
    style.height = px(height);
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
    g.elem.style.width = px(numColumns * g.columnWidth - g.padding);
    g.columns = [];
    for (var ii = 0; ii < numColumns; ++ii) {
      g.columns.push({
        ndx: ii,
        bottom: g.padding,
      });
    }

    g.images.forEach(function(elem) {
      if (elem instanceof HTMLImageElement) {
        flowElement(elem, elem.naturalWidth, elem.naturalHeight);
      } else {
        flowElement(elem, elem.videoWidth, elem.viewHeight);
      }
    });
  }

  window.addEventListener('resize', reflow);
  reflow();

});

