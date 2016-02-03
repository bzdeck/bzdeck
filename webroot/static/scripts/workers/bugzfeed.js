/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Declare the BzDeck app namespace. This code is on a dedicated worker thread.
 * @namespace
 */
const BzDeck = { workers: {} };

/**
 * Implement a client of the Bugzfeed push notification service offered by bugzilla.mozilla.org, enabling live update of
 * bug timelines.
 * @see {@link https://wiki.mozilla.org/BMO/ChangeNotificationSystem}
 */
BzDeck.BugzfeedWorker = class BugzfeedWorker {
  /**
   * Initialize the Bugzfeed background service.
   * @constructor
   * @argument {undefined}
   * @return {Object} worker - New BugzfeedWorker instance.
   */
  constructor () {
    this.subscriptions = new Set();

    self.addEventListener('message', event => this._onmessage(event));
  }

  /**
   * Called whenever a message is received from the main thread.
   * @argument {ServiceWorkerMessageEvent} event - The message event.
   * @return {undefined}
   */
  _onmessage (event) {
    let { command, endpoint, ids } = event.data;

    let func = {
      'Connect': () => this.connect(endpoint),
      'Disconnect': () => this.disconnect(),
      'Subscribe': () => this.subscribe(ids),
      'Unsubscribe': () => this.unsubscribe(ids),
    }[command];

    if (func) {
      func()
    }
  }

  /**
   * Connect to the WebSocket server and specify event handlers.
   * @argument {String} [endpoint] - WebSocket server URL.
   * @return {undefined}
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
   * @argument {undefined}
   * @return {undefined}
   */
  disconnect () {
    if (this.websocket) {
      this.websocket.close();
    }
  }

  /**
   * Send a message to the WebSocket server.
   * @argument {String} command - One of supported commands: subscribe, unsubscribe, subscriptions or version.
   * @argument {Array.<Number>} ids - Bug IDs to subscribe.
   * @return {undefined}
   * @see {@link https://wiki.mozilla.org/BMO/ChangeNotificationSystem#Commands}
   */
  send (command, ids) {
    if (this.websocket && this.websocket.readyState === 1) {
      this.websocket.send(JSON.stringify({ command, bugs: ids }));
    }
  }

  /**
   * Subscribe to one or more bugs.
   * @argument {Array.<Number>} ids - Bug IDs to subscribe.
   * @return {undefined}
   */
  subscribe (ids) {
    ids.forEach(id => this.subscriptions.add(id));
    this.send('subscribe', ids);
  }

  /**
   * Unsubscribe from one or more bugs.
   * @argument {Array.<Number>} ids - Bug IDs to unsubscribe.
   * @return {undefined}
   */
  unsubscribe (ids) {
    ids.forEach(id => this.subscriptions.delete(id));
    this.send('unsubscribe', ids);
  }

  /**
   * Called when the socket connection is opened. Subscribe to bugs once (re)connected.
   * @argument {Event} event - The open event.
   * @return {undefined}
   */
  onopen (event) {
    if (this.reconnector) {
      self.clearInterval(this.reconnector);
      delete this.reconnector;
    }

    if (this.subscriptions.size) {
      this.subscribe([...this.subscriptions]);
    }

    self.postMessage({ status: 'Connected' });
  }

  /**
   * Called when the socket connection is closed. Try to reconnect every 30 seconds after unexpectedly disconnected.
   * @argument {CloseEvent} event - The close event.
   * @return {undefined}
   * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/CloseEvent}
   */
  onclose (event) {
    if (!this.reconnector && ![1000, 1005].includes(event.code)) {
      this.reconnector = self.setInterval(() => this.connect(), 30000);
    }

    self.postMessage({ status: 'Disonnected' });
  }

  /**
   * Called when the socket connection raises an error. Try to reconnect every 30 seconds after unexpectedly
   * disconnected.
   * @argument {Event} event - The error event.
   * @return {undefined}
   */
  onerror (event) {
    if (!this.reconnector) {
      this.reconnector = self.setInterval(() => this.connect(), 30000);
    }

    self.postMessage({ status: 'Disonnected' });
  }

  /**
   * Called whenever a message is received from the server. When a bug is updated, notify the ID to the main thread.
   * @argument {MessageEvent} event - The message event.
   * @return {undefined}
   */
  onmessage (event) {
    let { command, bug, bugs, result, when } = JSON.parse(event.data);

    if (command === 'update') {
      self.postMessage({ status: 'BugUpdated', id: bug });
    }

    if (command === 'subscribe' && result === 'ok') {
      self.postMessage({ status: 'SubscriptionsUpdated', ids: bugs });
    }
  }
}

BzDeck.workers.bugzfeed = new BzDeck.BugzfeedWorker();
