/**
 * Bugzilla Push Notifications support
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * See https://wiki.mozilla.org/BMO/ChangeNotificationSystem for the details of the API.
 */

BzDeck.controllers.BugzfeedClient = function BugzfeedClient () {
  this.subscription = new Set();
};

BzDeck.controllers.BugzfeedClient.prototype.connect = function () {
  let endpoint = BzDeck.models.data.server.endpoints.websocket;

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
      this._subscribe([...this.subscription]);
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
    let message = JSON.parse(event.data)

    if (message.command === 'update') {
      this.get_changes(message);
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

BzDeck.controllers.BugzfeedClient.prototype._subscribe = function (bugs) {
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

BzDeck.controllers.BugzfeedClient.prototype.get_changes = function (message) {
  BzDeck.controllers.bugs.fetch_bug(message.bug).then(bug => {
    let time = new Date(message.when + (message.when.endsWith('Z') ? '' : 'Z')),
        get_change = (field, time_field = 'creation_time') =>
          [for (item of bug[field]) if (new Date(item[time_field]) - time === 0) item][0],
        changes = new Map(),
        comment = get_change('comments'),
        attachment = get_change('attachments'),
        history = get_change('history', 'when');

    if (comment) {
      changes.set('comment', comment);
    }

    if (attachment) {
      changes.set('attachment', attachment);
    }

    if (history) {
      changes.set('history', history);
    }

    this.save_changes(bug, changes);

    FlareTail.util.event.trigger(window, 'Bug:Updated', { 'detail': { bug, changes }});
  });
};

BzDeck.controllers.BugzfeedClient.prototype.save_changes = function (bug, changes) {
  BzDeck.models.bugs.get_bug_by_id(bug.id).then(cache => {
    if (changes.has('comment')) {
      cache.comments.push(changes.get('comment'));
    }

    if (changes.has('attachment')) {
      cache.attachments = cache.attachments;
      cache.attachments.push(changes.get('attachment'));
    }

    if (changes.has('history')) {
      cache.history = cache.history;
      cache.history.push(changes.get('history'));

      for (let change in changes.get('history').changes) {
        cache[change.field_name] = bug[change.field_name];
      }
    }

    BzDeck.models.bugs.save_bug(cache);
  });
};
