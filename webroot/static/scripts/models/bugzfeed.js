/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Implement a client of the Bugzfeed push notification service offered by bugzilla.mozilla.org, enabling live update of
 * bug timelines.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 * @see {@link https://wiki.mozilla.org/BMO/ChangeNotificationSystem MozillaWiki}
 */
BzDeck.BugzfeedModel = class BugzfeedModel extends BzDeck.BaseModel {
  /**
   * Initialize the Bugzfeed background service.
   * @constructor
   * @returns {BugzfeedModel} New BugzfeedModel instance.
   */
  constructor () {
    super(); // Assign this.id

    this.connected = false;
    this.subscriptions = new Set();
  }

  /**
   * Connect to the WebSocket server and specify event handlers.
   * @param {String} [endpoint] - WebSocket server URL.
   */
  connect (endpoint) {
    this.endpoint = endpoint || this.endpoint;

    if (!this.endpoint || !navigator.onLine) {
      return;
    }

    this.websocket = new WebSocket(this.endpoint);
    this.websocket.addEventListener('open', event => this.onopen(event));
    this.websocket.addEventListener('close', event => this.onclose(event));
    this.websocket.addEventListener('error', event => this.onerror(event));
    this.websocket.addEventListener('message', event => this.onmessage(event));
  }

  /**
   * Disconnect from the WebSocket server.
   */
  disconnect () {
    if (this.websocket) {
      this.websocket.close();
    }
  }

  /**
   * Send a message to the WebSocket server.
   * @param {String} command - One of supported commands: subscribe, unsubscribe, subscriptions or version.
   * @param {Array.<Number>} ids - Bug IDs to subscribe.
   */
  send (command, ids) {
    if (this.websocket && this.websocket.readyState === 1) {
      this.websocket.send(JSON.stringify({ command, bugs: ids }));
    }
  }

  /**
   * Subscribe to one or more bugs.
   * @param {Array.<Number>} ids - Bug IDs to subscribe.
   */
  _subscribe (ids) {
    ids.forEach(id => this.subscriptions.add(id));
    this.send('subscribe', ids);
  }

  /**
   * Unsubscribe from one or more bugs.
   * @param {Array.<Number>} ids - Bug IDs to unsubscribe.
   */
  _unsubscribe (ids) {
    ids.forEach(id => this.subscriptions.delete(id));
    this.send('unsubscribe', ids);
  }

  /**
   * Called when the socket connection is opened. Subscribe to bugs once (re)connected.
   * @param {Event} event - The open event.
   */
  onopen (event) {
    if (this.reconnector) {
      window.clearInterval(this.reconnector);
      delete this.reconnector;
    }

    if (this.subscriptions.size) {
      this._subscribe([...this.subscriptions]);
    }

    this.connected = true;
    this.trigger('#Connected');
  }

  /**
   * Called when the socket connection is closed. Try to reconnect every 30 seconds after unexpectedly disconnected.
   * @param {CloseEvent} event - The close event.
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent MDN}
   */
  onclose (event) {
    if (!this.reconnector && ![1000, 1005].includes(event.code)) {
      this.reconnector = window.setInterval(() => this.connect(), 30000);
    }

    this.connected = false;
    this.trigger('#Disconnected');
  }

  /**
   * Called when the socket connection raises an error. Try to reconnect every 30 seconds after unexpectedly
   * disconnected.
   * @param {Event} event - The error event.
   */
  onerror (event) {
    if (!this.reconnector) {
      this.reconnector = window.setInterval(() => this.connect(), 30000);
    }

    this.connected = false;
    this.trigger('#Disconnected');
  }

  /**
   * Called whenever a message is received from the server. When a bug is updated, notify the ID to the main thread.
   * @param {MessageEvent} event - The message event.
   */
  onmessage (event) {
    const { command, bug: id, bugs: ids, result, when } = JSON.parse(event.data);

    if (command === 'update') {
      this.trigger('#BugUpdated', { id });
    }

    if (command === 'subscribe' && result === 'ok') {
      this.trigger('#SubscriptionsUpdated', { ids });
    }
  }
}
