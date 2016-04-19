'use strict';

const filters = require('./filters');
const fs = require('fs');
const path = require('path');
const TheWatcher = require('thewatcher');
const WebSocketServer = require('./websocket-server');

class TreeWatcher {
  constructor(server, client, entries, options) {
    this._server = server;
    this._client = client;
    this._dirs = options._dirs;

    client.on('message', (data) => { this._onMessage(data); });
    client.on('disconnect', () => { this._onDisconnect(); });

    // send existing entries
    entries.forEach((isDir, filePath) => {
      this.send('add', { name: filePath, isDir: isDir });
    });
  }

  send(cmd, data) {
    this._client.send({cmd: cmd, data: data});
  }

  _onMessage(data) {
    console.log("GOT MSG:", JSON.stringify(data));
  }

  _onDisconnect() {
    this._client.on('message', undefined);
    this._client.on('disconnect', undefined);
    this._client.close();
    this._server.removeClient(this);
  }
}

function isImageOrVideoExtensionOrDirNotDot(filePath, stat) {
  if (path.basename(filePath)[0] === '.') {
    return false;
  }
  // FIX: remove this check?
  if (!stat) {
    try {
      stat = fs.statSync(filePath);
    } catch(e) {
    }
  }
  if (stat && stat.isDirectory()) {
    return true;
  }
  return filters.isImageOrVideoExtension(filePath);
}

function makeVirtualPath(dir, ndx, filePath) {
  return path.join("images", ndx.toString(), path.relative(dir, filePath));
}

class TreeServer {
  constructor(server, options) {
    this._clients = [];
    this._entries = new Map();
    this._watchers = options.dirs.map((dir, ndx) => {
      var watcher = new TheWatcher(dir, { filter: isImageOrVideoExtensionOrDirNotDot });
      watcher.on('add',    (f, s)     => { this._onAdd   (dir, ndx, f, s    ); });
      watcher.on('create', (f, s)     => { this._onCreate(dir, ndx, f, s    ); });
      watcher.on('remove', (f, s, s2) => { this._onRemove(dir, ndx, f, s, s2); });
      watcher.on('change', (f, s)     => { this._onChange(dir, ndx, f, s    ); });
      return watcher;
    });

    this._wss = new WebSocketServer(server);
    this._wss.on('connection', (client) => {
      this._clients.push(new TreeWatcher(this, client, this._entries, options));
    });
  }

  removeClient(client) {
    var ndx = this._clients.indexOf(client);
    this._clients.splice(ndx, 1);
  }

  send(cmd, data) {
    this._clients.forEach((client) => {
      client.send(cmd, data);
    });
  }

  _onAdd(dir, ndx, filePath, stat) {
    filePath = makeVirtualPath(dir, ndx, filePath);
    this._entries.set(filePath, stat.isDirectory());
    this.send('add', { name: filePath, isDir: stat.isDirectory(), });
  }

  _onCreate(dir, ndx, filePath, stat) {
    filePath = makeVirtualPath(dir, ndx, filePath);
    this._entries.set(filePath, stat.isDirectory());
    this.send('add', { name: filePath, isDir: stat.isDirectory(), });
  }

  _onChange(dir, ndx, filePath, stat) {
    filePath = makeVirtualPath(dir, ndx, filePath);
    this.send('change', { name: filePath, isDir: stat.isDirectory(), });
  }

  _onRemove(dir, ndx, filePath, stat) {
    filePath = makeVirtualPath(dir, ndx, filePath);
    this._entries.delete(filePath);
    this.send('remove', { name: filePath, isDir: stat.isDirectory(), });
  }
}

module.exports = TreeServer;

