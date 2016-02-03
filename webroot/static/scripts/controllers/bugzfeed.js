/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bugzfeed Client Controller. This works with BugzfeedHandler on the shared worker.
 * @extends BzDeck.BaseController
 */
BzDeck.BugzfeedController = class BugzfeedController extends BzDeck.BaseController {
  /**
   * Get a BugzfeedController instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} controller - New BugzfeedController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.connected = false;
    this.subscription = new Set();

    // Add event handlers. Disconnect from the WebSocket server when the page is closed, otherwise the client continues
    // working background. Connect when the page is opened again or the network status has changed.
    window.addEventListener('online', event => this.connect());
    window.addEventListener('pageshow', event => this.connect());
    window.addEventListener('pagehide', event => this.disconnect());

    // Listen messages from the service worker.
    this.on('H:Connected', data => this.connected = true, true);
    this.on('H:Disonnected', data => this.connected = false, true);
    this.on('H:SubscriptionUpdated', data => this.subscription = new Set(detail.ids), true);
  }

  /**
   * Connect to the WebSocket server.
   * @argument {undefined}
   * @return {undefined}
   */
  connect () {
    if (BzDeck.server) {
      this.trigger(':Connect', { endpoint: BzDeck.server.endpoints.websocket });
    }
  }

  /**
   * Disconnect from the WebSocket server.
   * @argument {undefined}
   * @return {undefined}
   */
  disconnect () {
    this.trigger(':Disconnect');
  }

  /**
   * Subscribe to one or more bugs. Because FlareTail.app.Events has the subscribe function, this function begins with
   * an underscore.
   * @argument {Array.<Number>} ids - Bug IDs to subscribe.
   * @return {undefined}
   */
  _subscribe (ids) {
    this.trigger(':Subscribe', { ids });
  }

  /**
   * Unsubscribe from one or more bugs.
   * @argument {Array.<Number>} ids - Bug IDs to unsubscribe.
   * @return {undefined}
   */
  _unsubscribe (ids) {
    this.trigger(':Unsubscribe', { ids });
  }
}
