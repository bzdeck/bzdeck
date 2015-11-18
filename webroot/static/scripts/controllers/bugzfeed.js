/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Bugzfeed Client Controller. This is a client implementation of the Bugzfeed push notification service
 * offered by bugzilla.mozilla.org, enabling live update of bug timelines.
 *
 * @constructor
 * @argument {undefined}
 * @return {Object} controller - New BugzfeedClient instance.
 * @see {@link https://wiki.mozilla.org/BMO/ChangeNotificationSystem}
 */
BzDeck.controllers.BugzfeedClient = function BugzfeedClient () {
  this.subscription = new Set();
  window.addEventListener('online', event => this.connect());
};

/**
 * Connect to the WebSocket server and specify event handlers.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.connect = function () {
  let endpoint = BzDeck.models.server.endpoints.websocket;

  if (!endpoint || !navigator.onLine) {
    return;
  }

  this.websocket = new WebSocket(endpoint);
  this.websocket.addEventListener('open', event => this.onopen(event));
  this.websocket.addEventListener('close', event => this.onclose(event));
  this.websocket.addEventListener('error', event => this.onerror(event));
  this.websocket.addEventListener('message', event => this.onmessage(event));
};

/**
 * Disconnect from the WebSocket server.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.disconnect = function () {
  if (this.websocket) {
    this.websocket.close();
  }
};

/**
 * Send a message to the WebSocket server.
 *
 * @argument {String} command - One of supported commands: subscribe, unsubscribe, subscriptions or version.
 * @argument {Array.<Number>} bugs - Bug IDs to subscribe.
 * @return {undefined}
 * @see {@link https://wiki.mozilla.org/BMO/ChangeNotificationSystem#Commands}
 */
BzDeck.controllers.BugzfeedClient.prototype.send = function (command, bugs) {
  if (this.websocket && this.websocket.readyState === 1) {
    this.websocket.send(JSON.stringify({ command, bugs }));
  }
};

/**
 * Subscribe to one or more bugs. Because FlareTail.app.Events has the subscribe function, this function begins with an
 * underscore.
 *
 * @argument {Array.<Number>} bugs - Bug IDs to subscribe.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype._subscribe = function (bugs) {
  for (let bug of bugs) {
    this.subscription.add(bug);
  }

  this.send('subscribe', bugs);
};

/**
 * Unsubscribe from one or more bugs.
 *
 * @argument {Array.<Number>} bugs - Bug IDs to unsubscribe.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype._unsubscribe = function (bugs) {
  for (let bug of bugs) {
    this.subscription.delete(bug);
  }

  this.send('unsubscribe', bugs);
};

/**
 * Called when the socket connection is opened. Subscribe to bugs once (re)connected.
 *
 * @argument {Event} event - The open event.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.onopen = function (event) {
  if (this.reconnector) {
    window.clearInterval(this.reconnector);
    delete this.reconnector;
  }

  if (this.subscription.size) {
    this._subscribe([...this.subscription]);
  }
};

/**
 * Called when the socket connection is closed. Try to reconnect every 30 seconds after unexpectedly disconnected.
 *
 * @argument {CloseEvent} event - The close event.
 * @return {undefined}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent}
 */
BzDeck.controllers.BugzfeedClient.prototype.onclose = function (event) {
  if (!this.reconnector && ![1000, 1005].includes(event.code)) {
    this.reconnector = window.setInterval(() => this.connect(), 30000);
  }
};

/**
 * Called when the socket connection raises an error. Try to reconnect every 30 seconds after unexpectedly disconnected.
 *
 * @argument {Event} event - The error event.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.onerror = function (event) {
  if (!this.reconnector) {
    this.reconnector = window.setInterval(() => this.connect(), 30000);
  }
};

/**
 * Called whenever a message is received from the server. Retrieve the latest data when a bug is updated.
 *
 * @argument {MessageEvent} event - The message event.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.onmessage = function (event) {
  let { bug: id, command } = JSON.parse(event.data);

  if (command === 'update') {
    BzDeck.collections.bugs.get(id, { id, _unread: true }).fetch();
  }
};
