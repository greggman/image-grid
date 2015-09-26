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
    columnWidth: 160,
    padding: 10,
    images: [],
    columns: [],
  };

  misc.applyUrlSettings(g);

  io.sendJSON("/images", {}, function(err, images) {
    images.forEach(loadImage);
  });

  g.viewElem.addEventListener('click', hideImage);

  function loadImage(url) {
    var img = new Image();
    img.addEventListener('load', function() {
      addImage(img);
    });
    img.addEventListener('click', function() {
      viewImage(img);
    });
    img.src = url;
  }

  function hideImage() {
    g.viewElem.style.display = "none";
  }

  function viewImage(img) {
    g.viewElem.style.display = "block";
    g.viewElem.style.top = window.scrollY + "px";
    g.viewImg.src = img.src;
  }

  function addImage(img) {
    g.images.push(img);
    g.elem.appendChild(img);
    flowImage(img);
  }

  function flowImage(img) {
    var column = shortestColumn();
    var imageWidth = g.columnWidth - g.padding;
    var height = img.height * imageWidth / img.width | 0;
    var style = img.style;
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
    var width = g.elem.clientWidth;
    var numColumns = (width / g.columnWidth | 0) || 1;
    g.columns = [];
    for (var ii = 0; ii < numColumns; ++ii) {
      g.columns.push({
        ndx: ii,
        bottom: 0,
      });
    }

    g.images.forEach(flowImage);
  }

  window.addEventListener('resize', reflow);
  reflow();

});

