/*
 * Copyright 2014, Gregg Tavares.
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

"use strict";

define([
    './virtualsocket',
  ], function(
    VirtualSocket) {
  /**
   * TreeClient is what a controller(phone) uses to talk with a
   * tree's TreeServer(the tree).
   *
   * Messages sent with `sendCmd` get sent to the tree. Messages
   * from the tree are delivered to callbacks registered with
   * `addEventListener`.
   *
   * @constructor
   * @alias TreeClient
   * @param {TreeClient~Options} [options] options.
   */
  var TreeClient = function(options) {
    options = options || {};
    var g_socket;
    var g_sendQueue = [];
    var eventListeners = {};
    var log = options.quiet === true ? console.log.bind(console) : function() {};


    /**
     * Adds an event listener for the given event type.
     * event types are made up by you. Sending a command
     * from the tree with
     *
     *     someNetPlayer.sendCmd('foo', {data: "bar"});
     *
     * Will arrive at the event listener registered for 'foo' here
     * and given an object `{data: "bar"}`.
     *
     * Note: Currently only 1 listener is allowed per eventType.
     * Adding a second listener for an specific eventType replaces
     * the previous listener for that type.
     *
     * @param {string} eventType name of event
     * @param {TreeClient~Listener} listener callback to call for
     *        event.
     */
    this.addEventListener = function(eventType, listener) {
      eventListeners[eventType] = listener;
    };

    /**
     * Removes an eventListener
     * @param {string} eventType name of event
     */
    this.removeEventListener = function(eventType) {
      eventListeners[eventType] = undefined;
    };

    var sendEvent_ = function(eventType, args) {
      var fn = eventListeners[eventType];
      if (fn) {
        fn.apply(this, args);
      } else {
        console.error("TreeClient: unknown event: " + eventType);
      }
    }.bind(this);

    var connected_ = function() {
      for (var ii = 0; ii < g_sendQueue.length; ++ii) {
        g_socket.send(g_sendQueue[ii]);
      }
      g_sendQueue = [];
      log("connected");
      sendEvent_('connect');
    };

    var disconnected_ = function() {
      if (g_socket) {
        g_socket = undefined;
        log("disconnected");
        sendEvent_('disconnect');
        eventListeners = {};
      }
    };

    var processMessage_ = function(msg) {
      sendEvent_(msg.cmd, [msg.data]); // FIX: no need for this array?
    };

    var handleError_ = function(err) {
      log(err);
      sendEvent_('error');
      if (g_socket) {
        g_socket.close();
      }
      disconnected_();
    };

    var connect_ = function() {
      g_sendQueue = [];
      g_socket = options.socket || new VirtualSocket(options);
      g_socket.on('connect', connected_.bind(this));
      g_socket.on('message', processMessage_.bind(this));
      g_socket.on('disconnect', disconnected_.bind(this));
      g_socket.on('error', handleError_.bind(this));
    }.bind(this);

    var sendCmdLowLevel = function(cmd, data) {
      if (!g_socket) {
        return;
      }
      var msg = {
        cmd: cmd,
        data: data,
      };
      if (!g_socket.isConnected()) {
        g_sendQueue.push(msg);
      } else {
        g_socket.send(msg);
      }
    };

    var sendCmd = function(cmd, data) {
      sendCmdLowLevel(cmd, data);
    };

    /**
     * Sends a command to the tree
     * @param {string} cmd name of command
     * @param {Object=} data any jsonifyable object.
     * @example
     *
     *     client.sendCmd('position', {
     *        x: 123,
     *        y: 456,
     *     });
     */
    this.sendCmd = sendCmd;

    connect_();
  };
  return TreeClient;
});

