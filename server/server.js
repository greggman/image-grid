﻿/*
 * Copyright 2015, Gregg Tavares.
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are
 * met:
 *
 *     * Redistributions of source code must retain the above copyright
 * notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above
 * copyright notice, this list of conditions and the following disclaimer
 * in the documentation and/or other materials provided with the
 * distribution.
 *     * Neither the name of Gregg Tavares. nor the names of its
 * contributors may be used to endorse or promote products derived from
 * this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
 * "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
 * LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
 * A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
 * OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
 * SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
 * LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
 * DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
 * THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */

'use strict';

var express = require('express');
var http = require('http');
var imageSize = require('image-size');
var path = require('path');
var readDirTree = require('../lib/readdirtree');

var optionSpec = {
  options: [
    { option: 'help', alias: 'h', type: 'Boolean',  description: 'displays help'},
    { option: 'dirPath',          type: 'String',   description: 'path to get images from', required: true},
  ],
  helpStyle: {
    typeSeparator: '=',
    descriptionSeparator: ' : ',
    initialIndent: 4,
  },
};

var optionator = require('optionator')(optionSpec);

var imageExtensions = {
  ".jpg": true,
  ".jpeg": true,
  ".png": true,
  ".gif": true,
};

function init(options) {
  var files = readDirTree.sync(options.dirPath);
  var images = files.filter(isImageExtension).map(function(image) {
      return path.join("images", image).replace(/\\/g, '/');
  });
  var imageResponse = JSON.stringify(images);

  var app = express();
  app.post('/images', function(req, res) {
    res.type('application/json').send(imageResponse);
  });
  app.use('/images', express.static(path.resolve(options.dirPath)));
  app.use(express.static(path.join(__dirname, "..", "public")));

  var server = http.createServer(app);
  server.listen(8080);
}

function isImageExtension(filename) {
  return imageExtensions[path.extname(filename)];
}


try {
  var args = optionator.parse(process.argv);
} catch (e) {
  console.error(e);
  process.exit(1);  // eslint-disable-line
}

var printHelp = function() {
  console.log(optionator.generateHelp());
  process.exit(0);  // eslint-disable-line
};

if (args.help) {
  printHelp();
}

init(args);

