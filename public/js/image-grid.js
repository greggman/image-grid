requirejs([
    './io',
    './misc',
  ], function(
    io,
    misc) {

  var $ = document.getElementById.bind(document);

  var g = {
    minSize: 256,
    maxParallelDownloads: 8,
    columnWidth: 160,
    stretchMode: 3,
    padding: 10,
    maxSeekTime: 30,
    rotation: 0,
  };
  window.g = g;

  g.elem = $("grid");
  g.viewElem = $("viewer");
  g.viewImg = $("viewer-img");
  g.viewVideo = $("viewer-video");
  g.viewContent = $("viewer-content");
  g.nextElem = $("next");
  g.prevElem = $("prev");
  g.stretchElem = $("stretch");
  g.rotateElem = $("rotate");
  g.stretchImages = [
    $("stretch-0"),
    $("stretch-1"),
    $("stretch-2"),
    $("stretch-3"),
  ];
  g.uiElem = $("ui");
  g.ctx = document.createElement("canvas").getContext("2d");
  g.images = [];
  g.columns = [];
  g.queue = [];
  g.infoNode = document.createTextNode("");
  g.viewing = false;

  $("info").appendChild(g.infoNode);

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
      createLoadElements();
    }
  });

  function Player(video, uiElem) {
    var $ = uiElem.querySelector.bind(uiElem);
    var _pauseIcon = "❚❚";
    var _playIcon = "▶";

    var _playElem = $(".play");
    var _queElem = $(".que");
    var _timeElem = $(".time");
    var _volumeElem = $(".volume");
    var _oldTime;
    var _oldQue;
    var _timeNode = document.createTextNode("");
    _timeElem.appendChild(_timeNode);
    var _playNode = document.createTextNode(_playIcon);
    _playElem.appendChild(_playNode);
    var _playbackRate = 1;

    var _play = function() {
      video.play();
      video.playbackRate = _playbackRate;
      _playNode.nodeValue = _pauseIcon;
    };

    var _pause = function() {
      video.pause();
      _playNode.nodeValue = _playIcon;
    };

    uiElem.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    video.addEventListener('timeupdate', function() {
      _setTime();
    });

    _queElem.addEventListener('input', function() {
    //   if (!video.paused) {
         video.currentTime = _queElem.value * video.duration / 10000;
    //   }
    });

    _volumeElem.addEventListener('input', function() {
      video.volume = _volumeElem.value / 10000;
    });

    _playElem.addEventListener('click', function() {
      if (video.paused) {
        _play();
      } else {
        _pause();
      }
    });

    var _padZero = function(num, size) {
      var s = "00000" + num;
      return s.substr(s.length - size);
    };

    var _setTime = function() {
      var totalSeconds = video.currentTime | 0;
      var s = totalSeconds % 60;
      var m = (totalSeconds / 60 | 0) % 60;
      var h = totalSeconds / 60 / 60 | 0;

      var time = ((h == 0) ? '' : (_padZero(h, 2) + ':')) +
                 _padZero(m, 2) + ':' + _padZero(s, 2);

      if (_oldTime !== time) {
        _oldTime = time;
        _timeNode.nodeValue = time;
      }

      var que = video.currentTime / video.duration * 10000 | 0;
      if (_oldQue !== que) {
        _oldQue = que;
        _queElem.value = que;
      }
    };

    var _setPlaybackRate = function(rate) {
      _playbackRate = rate;
      video.playbackRate = rate;
    };

    this.play = _play;
    this.pause = _pause;
    this.setPlaybackRate = _setPlaybackRate;

    _setTime(0);
  }

  g.player = new Player(g.viewVideo, $("pspot"));

  g.viewElem.addEventListener('click', hideImage);
  g.viewVideo.addEventListener('canplay', function(e) {
    g.viewVideo.style.display = "inline-block";
    g.viewImg.style.display = "none";
    adjustSize(g.viewVideo, getOriginalSize(g.viewVideo));
    g.player.play();
  });
  g.viewVideo.addEventListener('loadeddata', function(e) {
    g.viewVideo.style.display = "inline-block";
    g.viewImg.style.display = "none";
    adjustSize(g.viewVideo, getOriginalSize(g.viewVideo));
    g.player.play();
  });

  g.viewImg.addEventListener('load', function(e) {
    g.viewImg.style.display = "inline-block";
    g.viewVideo.style.display = "none";
    adjustSize(e.target, getOriginalSize(e.target));
  });

  function adjustSize(elem, orig) {
    var sizeBoth = g.stretchMode === 3;
    if (/*isGif(elem.src) ||*/ sizeBoth) {
      sizeToFit(elem, orig);
    } else if (g.stretchMode & 0x1) {
      (isRotated90() ? fitHeight : fitWidth).call(null, elem, orig);
    } else if (g.stretchMode & 0x2) {
      (isRotated90() ? fitWidth : fitHeight).call(null, elem, orig);
    } else {
      actualSize(elem, orig);
    }
  }

  g.nextElem.addEventListener('click', gotoNext);
  g.prevElem.addEventListener('click', gotoPrev);
  g.stretchElem.addEventListener('click', changeStretchMode);
  g.rotateElem.addEventListener('click', rotate);
  updateStretch();

  function updateStretch() {
    g.stretchImages.forEach(function(img, ndx) {
      img.style.display = (ndx === g.stretchMode) ? "inline-block" : "none";
    });
  }

  function changeStretchMode(e) {
    e.preventDefault();
    e.stopPropagation();
    g.stretchMode = (g.stretchMode + 1) % 4;
    updateStretch();
    updateDisplayElem();
  }

  function rotate(e) {
    e.preventDefault();
    e.stopPropagation();
    g.rotation = (g.rotation + 90) % 360;
//    g.viewContent.style.transform = "rotate(" + g.rotation + "deg)";
    updateDisplayElem();
  }

  function getOriginalSize(elem) {
    return {
      width:  elem.naturalWidth  || elem.videoWidth,
      height: elem.naturalHeight || elem.videoHeight,
    };
  }

  function updateDisplayElem() {
    adjustSize(g.displayElem, getOriginalSize(g.displayElem));
  }

  var rates = {
    "49": 1,
    "50": 0.66,
    "51": 0.5,
    "52": 0.33,
    "53": 0.25,
  };
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
    case 49: // 1  1
    case 50: // 2  0.66
    case 51: // 3  0.5
    case 52: // 4  0.33
    case 53: // 5  0.25
      g.player.setPlaybackRate(rates[e.keyCode]);
    }
  });

  function createLoadElements() {
    var video = document.createElement("video");
    var image = document.createElement("img");
    var loadElements = {
      video: video,
      image: image,
    };

    var processNextWithThis = function() {
      processNext(loadElements);
    };

    video.addEventListener('loadedmetadata', function(e) {
      var seekTime = Math.min(g.maxSeekTime, e.target.duration / 2);
      e.target.currentTime = seekTime;
      e.target.muted = true;
    });
    video.addEventListener('seeked', function(e) {
      e.target.play();
    });
    video.addEventListener('playing', function(e) {
      makeThumbnail(e.target, e.target.videoWidth, e.target.videoHeight, "▶︎");
      e.target.pause();
      processNextWithThis();
    });
    video.addEventListener('error', processNextWithThis);

    image.addEventListener('load', function(e) {
      makeThumbnail(e.target, e.target.naturalWidth, e.target.naturalHeight, isGif(e.target.src) ? "gif" : "");
      processNextWithThis();
    });
    image.addEventListener('error', processNextWithThis);

    processNextWithThis();
  }

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

  function isRotated90() {
    return g.rotation / 90 % 2 === 1;
  }

  function getDisplayDimensions() {
    if (isRotated90()) {
      return {
        width: window.innerHeight,
        height: window.innerWidth,
      }
    } else {
      return {
        width: window.innerWidth,
        height: window.innerHeight,
      }
    }
  }

  function computeTransformAtCenter(elem, orig, width, height) {
    var sx = width  / orig.width;
    var sy = height / orig.height;
    var scale = Math.max(sx, sy);

    // If we did nothing, no scale, no translation, it would be here
    //
    //     +----+-------+
    //     |    |       |
    //     |    |       |
    //     |    |       |
    //     +----+       |
    //     |            |
    //     +------------+
    //
    // After scaling it could be one of these because it scales around the center of the image
    //
    //                         +------+
    //     +------------+      |+-----+------+
    //     |+--+        |      ||     |      |
    //     ||  |        |      ||     |      |
    //     ||  |        |  or  ||     |      |
    //     |+--+        |      ||     |      |
    //     |            |      ++-----+      |
    //     +------------+       +------------+
    //
    //
    var displayCenterX = window.innerWidth  / 2;
    var displayCenterY = window.innerHeight / 2

    var imgDisplayWidth  = isRotated90() ? height : width;
    var imgDisplayHeight = isRotated90() ? width  : height;

    var origCenterX = orig.width  / 2;
    var origCenterY = orig.height / 2;

    var x = displayCenterX - origCenterX;
    var y = displayCenterY - origCenterY;

    var newLeft = origCenterX + x - (imgDisplayWidth  / 2);
    var newTop  = origCenterY + y - (imgDisplayHeight / 2);

    return {
      x: x,
      y: y,
      scale: scale,
      s: {
        x: sx,
        y: sy,
      },
      displayCenter: {
        x: displayCenterX,
        y: displayCenterY,
      },
      imgDisplay: {
        w: imgDisplayWidth,
        h: imgDisplayHeight,
      },
      origCenter: {
        x: origCenterX,
        y: origCenterY,
      },
      newMin: {
        x: newLeft,
        y: newTop,
      },
    };
  }

  function setTransform(elem, t) {
    var translationPart = "translate(" + px(t.x) + "," + px(t.y + window.scrollY) + ")";

    //var scalePart = "scaleX(" + t.s.x + ") scaleY(" + t.s.y + ")";
    var scalePart = "scale(" + Math.max(t.scale) + ")";

    var rotatePart = "rotate(" + g.rotation + "deg)";

    // FUCKING SAFARI! >:(
    if (elem.style.webkitTransform !== undefined) {
      elem.style.webkitTransform = translationPart + rotatePart + scalePart;
    } else {
      elem.style.transform = translationPart + rotatePart + scalePart;
    }
    g.viewElem.style.display = "block";
  }

//  if (newLeft <= 0) {
//    // it's off the left so move it right
//    x = -newLeft;
//    if (imgDisplayWidth < window.innerWidth) {
//      x += (window.innerWidth - imgDisplayWidth) / 2;
//    }
//  } else {
//    // it's right from the left so center
//    x = displayCenterX - origCenterX;
//  }
//
//  if (newTop <= 0) {
//    // It's off the top so move it down
//    y = -newTop;
//    if (imgDisplayHeight < window.innerHeight) {
//      y += (window.innerHeight - imgDisplayHeight) / 2;
//    }
//  } else {
//    // It's down from top so center
//    y = displayCenterY - origCenterY;
//  }

  function moveIfOffScreen(t, axis, dimension) {
    if (t.newMin[axis] < 0) {
      t[axis] -= t.newMin[axis];
    }
  }

  function actualSize(elem, orig) {
    var w = orig.width;
    var h = orig.height;
    var t = computeTransformAtCenter(elem, orig, w, h);

    // center if smaller
    // move left if wider than display
    // move down if taller than display
    moveIfOffScreen(t, 'x', 'w');
    moveIfOffScreen(t, 'y', 'h');
    setTransform(elem, t);
  }

  function sizeToFit(elem, orig) {
    var display = getDisplayDimensions();
    var w = orig.width  / display.width;
    var h = orig.height / display.height;
    if (w < h) {
      w = orig.width * display.height / orig.height | 0;
      h = display.height;
    } else {
      w = display.width;
      h = orig.height * display.width / orig.width | 0;
    }
    var t = computeTransformAtCenter(elem, orig, w, h);

    // it fits on display so nothing to do
    setTransform(elem, t);
  }

  function fitWidth(elem, orig) {
    var display = getDisplayDimensions();
    var w = display.width;
    var h = orig.height * w / orig.width | 0;
    var t = computeTransformAtCenter(elem, orig, w, h);

    // it fits width wise
    // if height shorter than display done (it's centered)
    // if height taller than display move down
    if (isRotated90()) {
      moveIfOffScreen(t, 'x', 'w');
    } else {
      moveIfOffScreen(t, 'y', 'h');
    }
    setTransform(elem, t);
  }

  function fitHeight(elem, orig) {
    var display = getDisplayDimensions();
    var h = display.height;
    var w = orig.width * h / orig.height | 0;
    var t = computeTransformAtCenter(elem, orig, w, h);

    // it fits height wise
    // if width is thinner than dispaly done (it's centered)
    // if width is wider than display move right
    if (isRotated90()) {
      moveIfOffScreen(t, 'y', 'h');
    } else {
      moveIfOffScreen(t, 'x', 'w');
    }
    setTransform(elem, t);
  }

  function makeThumbnail(elem, elemWidth, elemHeight, msg) {
    if (isGif(elem.src) || (elemWidth >= g.minSize && elemHeight >= g.minSize)) {
      var imageWidth = g.columnWidth - g.padding;
      var height = elemHeight * imageWidth / elemWidth | 0;
      var ctx = g.ctx;
      ctx.canvas.width = imageWidth;
      ctx.canvas.height = height;
      ctx.drawImage(elem, 0, 0, imageWidth, height);
      ctx.textBaseline = "top";
      ctx.fillStyle = "black";
      ctx.fillText(msg, 4, 6);
      ctx.fillStyle = "white";
      ctx.fillText(msg, 5, 5);
      loadImage(elem.src, ctx.canvas.toDataURL());
    }
  }

  function processNext(loadElements) {
    if (g.queue.length) {
      var url = g.queue.shift();
      if (isVideoExtension(url)) {
        loadElements.video.pause();
        loadElements.video.src = url;
        loadElements.video.load();
      } else {
        loadElements.image.src = url;
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
    g.player.pause();
    g.viewing = false;
  }

  function viewImage(img, noHide) {
    g.viewing = true;
    var url = img.origSrc;
    g.currentElem = img;
    g.infoNode.nodeValue = decodeURIComponent(url).substr(window.location.origin.length + "/images/".length);
    if (isVideoExtension(url)) {
      g.player.pause();
      g.viewVideo.src = url;
      g.viewVideo.load();
      g.displayElem = g.viewVideo;
//      g.uiElem.style.display = "none";
    } else {
      g.viewImg.src = url;
      g.player.pause();
      g.displayElem = g.viewImg;
//      g.uiElem.style.display = isGif(url) ? "none" : "block";
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

    if (g.viewing) {
      updateDisplayElem();
    }
  }

  window.addEventListener('resize', reflow);
  reflow();

});

