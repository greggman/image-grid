requirejs([
    './io',
    './misc',
    './tree-client',
  ], function(
    io,
    misc,
    TreeClient) {

  var $ = document.getElementById.bind(document);
  var viewersElem = $("viewers");
  var vPairHTML = viewersElem.innerHTML;
  viewersElem.innerHTML = "";

  var g = {
    minSize: 256,
    maxParallelDownloads: 8,
    columnWidth: 160,
    stretchMode: 3,
    padding: 10,
    maxSeekTime: 30,
    currentVPairNdx: 0,
    viewsAcross: 1,
    viewsDown: 1,
    freeLoadElements: [],
  };
window.g = g;
  misc.applyUrlSettingsDirect(g);
  var options = JSON.parse(JSON.stringify(g));

  g.ctx = document.createElement("canvas").getContext("2d");
  g.queue = [];
  g.imgCount = 0;

  function extname(path) {
    var pndx = path.lastIndexOf('.');
    if (pndx >= 0) {
      return path.substr(pndx);
    }
  }

  var videoExtensions = {
    ".webm": true,
    ".mp4": true,
    ".m4v": true,
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

  function euclideanModulo(n, m) {
    return ((n % m) + m) % m;
  }

  function EventEmitter() {

    var _handlers = {};

    var _on = function(event, fn) {
      _handlers[event] = fn;
    };

    var _emit = function(event) {
      var handler = _handlers[event];
      if (handler) {
        var args = Array.prototype.slice.call(arguments, 1);
        handler.apply(null, arguments);
      }
    };

    this.on = _on;
    this.addEventListener = _on;
    this.emit = _emit;
  }

  function Player(video, uiElem, options) {
    EventEmitter.call(this);
    var _self = this;
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
    var _newVideo;
    var _loopStart = 0;
    var _loopEnd = 0;
    var _loop = false;

    var _load = function(url) {
      _loop = false;
      _pause();
      video.src = url;
      video.load();
    };

    var _play = function() {
      video.play();
      video.playbackRate = _playbackRate;
      _playNode.nodeValue = _pauseIcon;
    };

    var _pause = function() {
      video.pause();
      _playNode.nodeValue = _playIcon;
    };

    var _que = function(deltaSeconds) {
      video.currentTime = Math.min(video.duration, Math.max(0, video.currentTime + deltaSeconds));
    };

    uiElem.addEventListener('click', function(e) {
      e.preventDefault();
      e.stopPropagation();
    });

    video.addEventListener('timeupdate', function() {
      if (_loop) {
        if (video.currentTime >= _loopEnd) {
          video.currentTime = _loopStart;
        }
      }
      _setTime();
    });

    video.addEventListener('canplay', function(e) {
      _self.emit('canplay', e);
    });
    video.addEventListener('loadeddata', function(e) {
      _self.emit('loadeddata', e);
    });

    _queElem.addEventListener('input', function() {
    //   if (!video.paused) {
         video.currentTime = _queElem.value * video.duration / 10000;
    //   }
    });

    _volumeElem.addEventListener('input', function() {
      video.volume = _volumeElem.value / 10000;
    });

    var _togglePlay = function() {
      if (video.paused) {
        _play();
      } else {
        _pause();
      }
    }

    _playElem.addEventListener('click', _togglePlay);

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

    var _setLoop = function(start, end) {
      _loop = true;
      _loopStart = Math.min(video.duration, Math.max(0, start));
      _loopEnd = Math.min(video.duration, Math.max(0, end));
    };

    var _clearLoop = function() {
      _loop = false;
    };

    this.load = _load;
    this.play = _play;
    this.pause = _pause;
    this.que = _que;
    this.setPlaybackRate = _setPlaybackRate;
    this.setLoop = _setLoop;
    this.clearLoop = _clearLoop;
    this.togglePlay = _togglePlay;

    _setTime(0);
  }

  var vPairCount = 0;
  function VPair(parent, options) {
    EventEmitter.call(this);
    var _self = this;
    var _l = JSON.parse(JSON.stringify(options));
    var div = document.createElement("div");
    div.innerHTML = vPairHTML;
    var vPair = div.firstElementChild;
    div.removeChild(vPair);
    parent.appendChild(vPair);
    var $ = vPair.querySelector.bind(vPair);
    this.l = _l;
    _l.vPair = vPair;
    _l.id = vPairCount++;
    _l.rotation = 0;
    _l.zoom = 1;
    _l.loop = 0;
    _l.loopStart = 0;
    _l.loopEnd = 0;
    _l.spacer = $(".spacer");
    _l.gridElem = $(".grid");
    _l.viewElem = $(".viewer");
    _l.viewImg = $(".viewer-img");
    _l.viewVideo = $(".viewer-video");
    _l.viewContent = $(".viewer-content");
    _l.tickElem = $(".tick");
    _l.nextElem = $(".next");
    _l.prevElem = $(".prev");
    _l.closeElem = $(".close");
    _l.stretchElem = $(".stretch");
    _l.rotateElem = $(".rotate");
    _l.stretchImages = [
      $(".stretch-0"),
      $(".stretch-1"),
      $(".stretch-2"),
      $(".stretch-3"),
    ];
    _l.numLoading = 0;
    _l.finishedLoading = false;
    _l.uiElem = $(".ui");
    _l.infoNode = document.createTextNode("");
    _l.viewing = false;
    _l.images = [];
    _l.columns = [];
    _l.player = new Player(_l.viewVideo, $(".pspot"));

    $(".info").appendChild(_l.infoNode);

    _l.closeElem.addEventListener('click', hideImage);
    _l.viewVideo.addEventListener('loadeddata', function(e) {
      _l.viewVideo.style.display = "inline-block";
      _l.viewImg.style.display = "none";
      adjustSize(_l.viewVideo, getOriginalSize(_l.viewVideo));
      _l.player.play();
    });

    _l.viewImg.addEventListener('load', function(e) {
      _l.viewImg.style.display = "inline-block";
      _l.viewVideo.style.display = "none";
      adjustSize(e.target, getOriginalSize(e.target));
    });

    function adjustSize(elem, orig) {
      var sizeBoth = _l.stretchMode === 3;
      if (/*isGif(elem.src) ||*/ sizeBoth) {
        sizeToFit(elem, orig);
      } else if (_l.stretchMode & 0x1) {
        (isRotated90() ? fitHeight : fitWidth).call(null, elem, orig);
      } else if (_l.stretchMode & 0x2) {
        (isRotated90() ? fitWidth : fitHeight).call(null, elem, orig);
      } else {
        actualSize(elem, orig);
      }
    }

    _l.nextElem.addEventListener('click', gotoNext);
    _l.prevElem.addEventListener('click', gotoPrev);
    _l.stretchElem.addEventListener('click', changeStretchMode);
    _l.rotateElem.addEventListener('click', rotate);
    updateStretch();

    function updateStretch() {
      _l.stretchImages.forEach(function(img, ndx) {
        img.style.display = (ndx === _l.stretchMode) ? "inline-block" : "none";
      });
    }

    function changeStretchMode(e) {
      e.preventDefault();
      e.stopPropagation();
      if (_l.viewing) {
        _l.stretchMode = (_l.stretchMode + 1) % 4;
        updateStretch();
        updateDisplayElem();
      }
    }

    function rotate(e) {
      e.preventDefault();
      e.stopPropagation();
      if (_l.viewing) {
        _l.rotation = (_l.rotation + 270) % 360;
        updateDisplayElem();
      }
    }

    function zoom(z) {
      if (_l.viewing) {
        _l.zoom += z;
        updateDisplayElem();
      }
    }

    function loop() {
      if (_l.displayElem instanceof HTMLVideoElement) {
        switch (_l.loop) {
          case 0:  // not looping, set start
            _l.loop = 1;
            _l.loopStart = _l.displayElem.currentTime;
            break;
          case 1:  // start set, set end
            _l.loop = 2;
            _l.loopEnd = _l.displayElem.currentTime;
            if (_l.loopStart > _l.loopEnd) {
              var t = _l.loopStart;
              _l.loopStart = _l.loopEnd;
              _l.loopEnd = t;
            }
            _l.player.setLoop(_l.loopStart, _l.loopEnd);
            break;
          case 2:
            _l.loop = 0;
            _l.player.clearLoop();
            break;
        }
      }
    }

    function getOriginalSize(elem) {
      return {
        width:  elem.naturalWidth  || elem.videoWidth,
        height: elem.naturalHeight || elem.videoHeight,
      };
    }

    function updateDisplayElem() {
      adjustSize(_l.displayElem, getOriginalSize(_l.displayElem));
    }

    function nextSlide() {
      gotoNext();
    }

    function togglePlay() {
      _l.player.togglePlay();
    }

    function toggleSlideshow() {
      if (_l.slideshow) {
        _l.slideshow = false
        if (_l.slideshowId) {
          clearTimeout(_l.slideshowId);
          _l.slideshowId = undefined;
        }
      } else {
        _l.slideshow = true;
        nextSlide();
      }
    }

    function gotoNext(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      //var next = _l.currentElem.nextElementSibling;
      //if (!next) {
      //  next = _l.currentElem.parentNode.firstElementChild;
      //}
      //viewImage(next);
      var ndx = (_l.currentElem.elemNdx + 1) % _l.images.length;
      var img = _l.images[ndx];
      if (_l.slideshow) {
        var timeout = 5000;
        if (isGif(img.orig.src)) {
          timeout = 10000;
        } else if (isVideoExtension(img.orig.src)) {
          timeout = 30000;
        }
        if (_l.slideshowId) {
          clearTimeout(_l.slideshowId);
        }
        _l.slideshowId = setTimeout(nextSlide, timeout);
      }
      viewImage(img);
    }

    function gotoPrev(e) {
      if (e) {
        e.preventDefault();
        e.stopPropagation();
      }
      //var prev = _l.currentElem.previousElementSibling;
      //if (!prev) {
      //  prev = _l.currentElem.parentNode.lastElementChild;
      //}
      //viewImage(prev);
      var ndx = _l.currentElem.elemNdx;
      ndx = ndx === 0 ? _l.images.length - 1 : ndx - 1;
      viewImage(_l.images[ndx]);
    }

    function isRotated90() {
      return _l.rotation / 90 % 2 === 1;
    }

    function getDisplayDimensions() {
      if (isRotated90()) {
        return {
          width: _l.vPair.clientHeight,
          height: _l.vPair.clientWidth,
        }
      } else {
        return {
          width: _l.vPair.clientWidth,
          height: _l.vPair.clientHeight,
        }
      }
    }

    function computeTransformAtCenter(elem, orig, width, height) {
      var sx = width  / orig.width;
      var sy = height / orig.height;
      var scale = Math.max(sx, sy) * _l.zoom;

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
      var displayCenterX = _l.vPair.clientWidth  / 2;
      var displayCenterY = _l.vPair.clientHeight / 2

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
          w: orig.width * scale,
          h: orig.height * scale,
        },
        displayCenter: {
          x: displayCenterX,
          y: displayCenterY,
        },
        imgDisplay: {
          w: imgDisplayWidth,
          h: imgDisplayHeight,
        },
        orig: {
          centerX: origCenterX,
          centerY: origCenterY,
          w:   orig.width,
          h:   orig.height,
        },
        newMin: {
          x: newLeft,
          y: newTop,
        },
      };
    }

  //  var dy = t.imgDisplay.h - window.innerHeight;
  //  if (dy > 0) {
  //    t.y -= dy / 2;
  //  }
  //  if (t.newMin.y < 0) {
  //    window.scrollBy(0, -t.newMin.y);
  //  } else {
  //    var newMax = t.newMin.y + t.s.height;
  //    var winBot = window.scrollY + window.innerHeight;
  //    dy = newMax - winBot;
  //    if (dy > 0) {
  //      window.scrollBy(0, -dy);
  //    }
  //  }
    function adjustToCenter(t, axis, dim, winSize, winScroll) {
      var scrollBy = 0;
      var delta = t.imgDisplay[dim] - winSize;
      if (delta > 0) {
        t[axis] -= delta / 2;
      }
      if (t.newMin[axis] < 0) {
        scrollBy = -t.newMin[axis];
      } else {
        var newMax = t.newMin[axis] + t.s[dim]  ;
        var winBot = winScroll + winSize;
        delta = newMax - winBot;
        if (delta > 0) {
          scrollBy = -delta;
        }
      }
      return scrollBy;
    }

    function setTransform(elem, t) {
      var scrollLeft = 0;_l.vPair.scrollLeft;
      var scrollTop  = 0;_l.vPair.scrollTop;
      var dx = adjustToCenter(t, 'x', 'w', _l.vPair.clientWidth,  scrollLeft);
      var dy = adjustToCenter(t, 'y', 'h', _l.vPair.clientHeight, scrollTop);
      _l.spacer.style.width  = (t.s.w | 0) + "px";
      _l.spacer.style.height = (t.s.h | 0) + "px";
    //_l.vPair.scrollBy(dx, dy);
      var translationPart = "translate(" + px(t.x + scrollLeft) + "," + px(t.y + scrollTop) + ")";

      //var scalePart = "scaleX(" + t.s.x + ") scaleY(" + t.s.y + ")";
      var scalePart = "scale(" + Math.max(t.scale) + ")";

      var rotatePart = "rotate(" + _l.rotation + "deg)";

      // FUCKING SAFARI! >:(
      if (elem.style.webkitTransform !== undefined) {
        elem.style.webkitTransform = translationPart + rotatePart + scalePart;
      } else {
        elem.style.transform = translationPart + rotatePart + scalePart;
      }
      _l.viewElem.style.display = "block";

    }

  //  if (newLeft <= 0) {
  //    // it's off the left so move it right
  //    x = -newLeft;
  //    if (imgDisplayWidth < _l.vPair.clientWidth) {
  //      x += (_l.vPair.clientWidth - imgDisplayWidth) / 2;
  //    }
  //  } else {
  //    // it's right from the left so center
  //    x = displayCenterX - origCenterX;
  //  }
  //
  //  if (newTop <= 0) {
  //    // It's off the top so move it down
  //    y = -newTop;
  //    if (imgDisplayHeight < _l.vPair.clientHeight) {
  //      y += (_l.vPair.clientHeight - imgDisplayHeight) / 2;
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

    function cue(seconds) {
      if (_l.displayElem instanceof HTMLVideoElement) {
        _l.displayElem.currentTime = euclideanModulo(_l.displayElem.currentTime + seconds, _l.displayElem.duration);
      }
    }

    function cueOrNextPrev(seconds) {
      if (_l.displayElem instanceof HTMLVideoElement) {
        cue(seconds);
      } else {
        if (seconds > 0) {
          gotoNext();
        } else {
          gotoPrev();
        }
      }
    }

    function hideImage() {
      _l.viewElem.style.display = "none";
      _l.player.pause();
      _l.viewing = false;
    }

    function viewImage(img, noHide) {
      _l.viewing = true;
      var url = img.orig.src;
      _l.currentElem = img;
      _l.infoNode.nodeValue = decodeURIComponent(url).substr(window.location.origin.length + "/images/".length);
      if (isVideoExtension(url)) {
        _l.loop = 0;
        _l.player.pause();
        _l.player.load(url);
        _l.displayElem = _l.viewVideo;
  //      _l.uiElem.style.display = "none";
      } else {
        _l.viewImg.src = url;
        _l.player.pause();
        _l.displayElem = _l.viewImg;
  //      _l.uiElem.style.display = isGif(url) ? "none" : "block";
      }
    }

    function addElement(elem, elemWidth, elemHeight) {
      elem.elemNdx = _l.images.length;
      _l.images.push(elem);
      _l.gridElem.appendChild(elem);
      if (!_l.currentElem) {
        _l.currentElem = elem;
      }
      flowElement(elem, elemWidth, elemHeight);
    }

    function flowElement(elem, elemWidth, elemHeight) {
      var column = shortestColumn();
      var imageWidth = _l.columnWidth - _l.padding;
      var height = elemHeight * imageWidth / elemWidth | 0;
      var style = elem.style;
      style.position = "absolute";
      style.display = "block";
      style.left  = px(column.ndx * _l.columnWidth);
      style.top   = px(column.bottom);
      style.width = px(imageWidth);
      style.height = px(height);
      column.bottom += height + _l.padding;
    }

    function shortestColumn() {
      var shortest = _l.columns[0];
      _l.columns.forEach(function(column) {
        if (column.bottom < shortest.bottom) {
          shortest = column;
        }
      });

      return shortest;
    }

    function loadImage(src, url, ndx) {
      ++_l.numLoading;
      var img = new Image();
      img.addEventListener('load', function() {
        addElement(img, img.naturalWidth, img.naturalHeight);
        --_l.numLoading;
        if (_l.numLoading === 0 && _l.finishedLoading) {
          sortByNdx();
        }
      });
      img.addEventListener('click', function() {
        viewImage(img);
      });
      img.src = url;
      img.orig = {
        src: src,
        ndx: ndx,
      };
    }

    function reflow() {
      var width = _l.gridElem.parentNode.clientWidth;
      var numColumns = (width / _l.columnWidth | 0) || 1;
// FIX      _l.gridElem.style.width = px(numColumns * _l.columnWidth - _l.padding);
      _l.columns = [];
      for (var ii = 0; ii < numColumns; ++ii) {
        _l.columns.push({
          ndx: ii,
          bottom: _l.padding,
        });
      }

      _l.images.forEach(function(elem) {
        if (elem instanceof HTMLImageElement) {
          flowElement(elem, elem.naturalWidth, elem.naturalHeight);
        } else {
          flowElement(elem, elem.videoWidth, elem.viewHeight);
        }
      });

      if (_l.viewing) {
        updateDisplayElem();
      }
    }

    var padding = "0000000000";
    function padLeft10(str) {
      return padding.substr(padding.length - (10 - str.length)) + str;
    }

    function createSortName(name) {
      var parts = name.split(/(\d+)/);
      for (var ii = 1; ii < parts.length; ii += 2) {
        parts[ii] = padLeft10(parts[ii]);
      }
      return parts.join('');
    }

    function getSortName(orig) {
      if (!orig.sortName) {
        orig.sortName = createSortName(orig.src);
      }
      return orig.sortName;
    }

    function sortByNdx() {
      console.log("sort");
      _l.images.sort(function(a, b) {
          var aStr = getSortName(a.orig);
          var bStr = getSortName(b.orig);
          return aStr < bStr ? -1 : (aStr > bStr ? 1 : 0);
      });
      _l.images.forEach(function(a, ndx) {
          a.elemNdx = ndx;
      });
    }

    this.loadImage = loadImage;
    this.finishedLoading = () => {
      _l.finishedLoading = true;
    };

    var rates = {
      "49": 1,
      "50": 0.66,
      "51": 0.5,
      "52": 0.33,
      "53": 0.25,
    };

    function handleKeyDown(e) {
      e.preventDefault();
      switch (e.keyCode) {
      case 27:
        hideImage();
        break;
      case 112:  // F1
        zoom(0.1);
        break;
      case 113:  // F2
        zoom(-0.1);
        break;
      case 76: // loop
        loop();
        break;
      case 16: // left-shift
      case 219: // [
        gotoPrev(e);
        break;
      case 17: // left control
      case 221: // ]
      case 220: // \|
        gotoNext(e);
        break;
      case 32:
        togglePlay();
        break;
      case 9:  // tab
      case 81: // q
      case 39: // right
        cueOrNextPrev(10);
        break;
      case 37: // left
      case 192: // tilda
      case 87: // w
        cueOrNextPrev(-5);
        break;
      case 38: // up
        e.preventDefault();
        e.stopPropagation();
        window.scrollBy(0, _l.vPair.clientHeight / -4 | 0);
        break;
      case 40: // down
        e.preventDefault();
        e.stopPropagation();
        window.scrollBy(0, _l.vPair.clientHeight / 4 | 0);
        break;
      case 49: // 1  1
      case 50: // 2  0.66
      case 51: // 3  0.5
      case 52: // 4  0.33
      case 53: // 5  0.25
        _l.player.setPlaybackRate(rates[e.keyCode]);
        break;
      case 83: // S
        toggleSlideshow();
        break;
      case 191: // /  rotate
      case 65:  // a  rotate
      case 88:  // x  rotate
        rotate(e);
        break;
      case 190: // . strech
      case 90: // z strech
        changeStretchMode(e);
        break;
      }
    };

    _l.vPair.addEventListener('click', function() {
      _self.emit('click');
    });

    window.addEventListener('resize', reflow);
    reflow();

    function setActive(active) {
      _l.tickElem.style.display = active ? "block" : "none";
    }

    this.setActive = setActive;
    this.handleKeyDown = handleKeyDown;
  }
  g.vPairs = [];
  for (var ii = 0; ii < g.viewsAcross; ++ii) {
    g.vPairs.push(new VPair(viewersElem, options));
  }
  g.vPairs[0].setActive(true);

  g.vPairs.forEach(function(vPair) {
    vPair.on('click', function() {
      makeActive(vPair);
    });
  });

  function makeActive(vPair) {
    getCurrentVPair().setActive(false);
    g.currentVPairNdx = g.vPairs.indexOf(vPair);
    getCurrentVPair().setActive(true);
  }

  function makeNextActive(dir) {
    var ndx = (g.currentVPairNdx + g.vPairs.length + dir) % g.vPairs.length;
    makeActive(g.vPairs[ndx]);
  }

  function getCurrentVPair() {
    g.currentVPairNdx = g.currentVPairNdx % g.vPairs.length;
    return g.vPairs[g.currentVPairNdx];
  }

  function dispatchKey(e) {
    e.preventDefault();
    console.log(e.keyCode);
    switch (e.keyCode) {
      case 114: // F3
        makeNextActive(-1);
        break;
      case 115: // F4
        makeNextActive(1);
        break;
      default:
        var vPair = getCurrentVPair();
        vPair.handleKeyDown(e);
        break;
    }
  }

  window.addEventListener('keydown', dispatchKey);

  function createLoadElements() {
    var video = document.createElement("video");
    var image = document.createElement("img");
    var loadElements = {
      video: video,
      image: image,
    };

    var free = function() {
      g.freeLoadElements.push(loadElements);
      processNext();
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
    });
    video.addEventListener('pause', function(e) {
      e.target.removeAttribute('src');
      e.target.load();
      free();
    });
    video.addEventListener('error', function(e) {
      console.error("could not load:", e.target.src, e);
      e.target.removeAttribute('src');
      e.target.load();
      free();
    });

    image.addEventListener('load', function(e) {
      makeThumbnail(e.target, e.target.naturalWidth, e.target.naturalHeight, isGif(e.target.src) ? "gif" : "");
      free();
    });
    image.addEventListener('error', free);
    free();
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
      var src = elem.src;
      var ndx = elem.orig.ndx;
      ctx.canvas.toBlob(function(blob) {
        var url = URL.createObjectURL(blob);
        loadImages(src, url, ndx);
      });
    }
  }

  function processNext() {
    if (!g.freeLoadElements.length) {
      return;
    }
    if (g.queue.length) {
      var loadElements = g.freeLoadElements.shift();
      var url = g.queue.shift();
console.log(url);
      var orig = {
        ndx: g.imgCount++,
      };
      if (isVideoExtension(url)) {
        loadElements.video.pause();
        loadElements.video.src = url;
        loadElements.video.orig = orig;
        loadElements.video.load();
      } else {
        loadElements.image.src = url;
        loadElements.image.orig = orig;
      }
    } else {
      g.vPairs.forEach(function(vPair) {
        vPair.finishedLoading();
      });
    }
  }

  function loadImages(src, url, ndx) {
    g.vPairs.forEach(function(vPair, pairNdx) {
      vPair.loadImage(src, url, ndx);
    });
  }

  for (var ii = 0; ii < g.maxParallelDownloads; ++ii) {
    createLoadElements();
  }
//  io.sendJSON("/images", {}, function(err, images) {
//    Array.prototype.push.apply(g.queue, images);
//  });

  var client = new TreeClient();
  client.addEventListener('connect', () => { console.log("ws connected"); });
  client.addEventListener('disconnect', () => { console.log("ws disconnected"); });
  client.addEventListener('change', (d) => { show('change', d); });
  client.addEventListener('remvoe', (d) => { show('remove', d); });

  client.addEventListener('add', (d) => {
    show('add', d);
    if (!d.isDir) {
      g.queue.push(d.name);
      processNext();
    }
  });


  function show(event, data) {
    console.log(event, data.name, data.isDir);
  }
});

