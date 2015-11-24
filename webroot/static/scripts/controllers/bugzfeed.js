/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Bugzfeed Client Controller. This works with the BugzfeedClientWorker background service.
 *
 * @constructor
 * @argument {undefined}
 * @return {Object} controller - New BugzfeedClientController instance.
 */
BzDeck.controllers.BugzfeedClient = function BugzfeedClientController () {
  this.connected = false;
  this.subscription = new Set();

  // Add event handlers. Disconnect from the WebSocket server when the page is closed, otherwise the client continues
  // working background. Connect when the page is opened again or the network status has changed.
  window.addEventListener('online', event => this.connect());
  window.addEventListener('pageshow', event => this.connect());
  window.addEventListener('pagehide', event => this.disconnect());

  // Listen messages from the service worker.
  navigator.serviceWorker.addEventListener('message', event => this.onmessage(event));
};

BzDeck.controllers.BugzfeedClient.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.BugzfeedClient.prototype.constructor = BzDeck.controllers.BugzfeedClient;

/**
 * Called whenever a message is received from the service worker.
 *
 * @argument {ServiceWorkerMessageEvent} event - The message event.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.onmessage = function (event) {
  let [ service, type, detail ] = event.data;

  if (service !== 'Bugzfeed') {
    return;
  }

  if (type === 'Connected') {
    this.connected = true;
  }

  if (type === 'Disonnected') {
    this.connected = false;
  }

  if (type === 'BugUpdated') {
    this.trigger(':BugUpdated', { id: detail.id });
  }

  if (type === 'SubscriptionUpdated') {
    this.subscription = new Set(detail.ids);
  }
};

/**
 * Connect to the WebSocket server.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.connect = function () {
  if (BzDeck.models.server) {
    this.notify_worker('Bugzfeed', 'Connect', { endpoint: BzDeck.models.server.endpoints.websocket });
  }
};

/**
 * Disconnect from the WebSocket server.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype.disconnect = function () {
  this.notify_worker('Bugzfeed', 'Disconnect');
};

/**
 * Subscribe to one or more bugs. Because FlareTail.app.Events has the subscribe function, this function begins with an
 * underscore.
 *
 * @argument {Array.<Number>} ids - Bug IDs to subscribe.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype._subscribe = function (ids) {
  this.notify_worker('Bugzfeed', 'Subscribe', { ids });
};

/**
 * Unsubscribe from one or more bugs.
 *
 * @argument {Array.<Number>} ids - Bug IDs to unsubscribe.
 * @return {undefined}
 */
BzDeck.controllers.BugzfeedClient.prototype._unsubscribe = function (ids) {
  this.notify_worker('Bugzfeed', 'Unsubscribe', { ids });
};
