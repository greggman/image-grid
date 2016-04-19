'use strict';

const path = require('path');

var imageExtensions = {
  ".jpg": true,
  ".jpeg": true,
  ".png": true,
  ".gif": true,
  ".webp": true,
};

var videoExtensions = {
  ".webm": true,
  ".mp4": true,
  ".m4v": true,
  ".ogv": true,
};

function isImageExtension(filename) {
  return imageExtensions[path.extname(filename).toLowerCase()];
}

function isVideoExtension(filename) {
  return videoExtensions[path.extname(filename).toLowerCase()];
}

function isImageOrVideoExtension(filename) {
  return isImageExtension(filename) || isVideoExtension(filename);
}

module.exports = {
  isImageExtension: isImageExtension,
  isVideoExtension: isVideoExtension,
  isImageOrVideoExtension: isImageOrVideoExtension,
};

