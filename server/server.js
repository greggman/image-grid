/*
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
var filters = require('./filters');
var http = require('http');
var path = require('path');
var readDirTree = require('../lib/readdirtree');
var TreeServer = require('./tree-server');

var optionSpec = {
  options: [
    { option: 'port', alias: 'p', type: 'Int',     description: "port to serve on", default: "8080", },
    { option: 'host',             type: 'String',  description: "host to serve on. Use 0.0.0.0 to publically serve", default: "localhost", },
    { option: 'help', alias: 'h', type: 'Boolean', description: 'displays help'},
  ],
  helpStyle: {
    typeSeparator: '=',
    descriptionSeparator: ' : ',
    initialIndent: 4,
  },
};

var optionator = require('optionator')(optionSpec);

function init(options) {
  var app = express();

  var images = [];
  options._.forEach(function(dirPath, ndx) {
    var files = readDirTree.sync(dirPath);
    images = images.concat(files.filter(filters.isImageOrVideoExtension).map(function(image) {
      return path.join("images", ndx.toString(), image).replace(/\\/g, '/');
    }));
    console.log(dirPath, "images:", images.length);
    app.use('/images/' + ndx, express.static(path.resolve(dirPath)));
  });

  var imageResponse = JSON.stringify(images);
  app.post('/images', function(req, res) {
    res.type('application/json').send(imageResponse);
  });
  app.use(express.static(path.join(__dirname, "..", "public")));

  var server = http.createServer(app);
  server.on('error', serverErrorHandler);
  server.on('listening', serverListeningHandler);
  tryToStartServer();

  function serverListeningHandler() {
    var treeServer = new TreeServer(server, {
      dirs: options._,
    });
    console.log("Go To http://" + options.host + ":" + options.port);
  };

  function serverErrorHandler() {
    ++options.port;
    tryToStartServer();
  };

  function tryToStartServer() {
    server.listen(options.port, options.host);
  }
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

