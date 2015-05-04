/**
 * Bugzilla Push Notifications support
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * See https://wiki.mozilla.org/BMO/ChangeNotificationSystem for the details of the API.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.BugzfeedClient = function BugzfeedClient () {
  this.subscription = new Set();
};

BzDeck.controllers.BugzfeedClient.prototype.connect = function () {
  let endpoint = BzDeck.models.server.endpoints.websocket;

  if (!endpoint || !navigator.onLine) {
    return;
  }

  this.websocket = new WebSocket(endpoint);

  this.websocket.addEventListener('open', event => {
    if (this.reconnector) {
      window.clearInterval(this.reconnector);
      delete this.reconnector;
    }

    // Subscribe bugs once (re)connected
    if (this.subscription.size) {
      this.subscribe([...this.subscription]);
    }
  });

  this.websocket.addEventListener('close', event => {
    // Try to reconnect every 30 seconds when unexpectedly disconnected
    if (!this.reconnector && ![1000, 1005].includes(event.code)) {
      this.reconnector = window.setInterval(() => this.connect(), 30000);
    }
  });

  this.websocket.addEventListener('error', event => {
    // Try to reconnect every 30 seconds when unexpectedly disconnected
    if (!this.reconnector) {
      this.reconnector = window.setInterval(() => this.connect(), 30000);
    }
  });

  this.websocket.addEventListener('message', event => {
    let { bug: id, command } = JSON.parse(event.data);

    if (command === 'update') {
      BzDeck.collections.bugs.get(id, { id, '_unread': true }).fetch();
    }
  });
};

BzDeck.controllers.BugzfeedClient.prototype.disconnect = function () {
  if (this.websocket) {
    this.websocket.close();
  }
};

BzDeck.controllers.BugzfeedClient.prototype.send = function (command, bugs) {
  if (this.websocket && this.websocket.readyState === 1) {
    this.websocket.send(JSON.stringify({ command, bugs }));
  }
};

BzDeck.controllers.BugzfeedClient.prototype.subscribe = function (bugs) {
  for (let bug of bugs) {
    this.subscription.add(bug);
  }

  this.send('subscribe', bugs);
};

BzDeck.controllers.BugzfeedClient.prototype.unsubscribe = function (bugs) {
  for (let bug of bugs) {
    this.subscription.delete(bug);
  }

  this.send('unsubscribe', bugs);
};

window.addEventListener('online', event => {
  BzDeck.controllers.bugzfeed.connect();
});
