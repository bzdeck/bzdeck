/**
 * BzDeck Main Controllers
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.controllers = BzDeck.controllers || {};

/* ------------------------------------------------------------------------------------------------------------------
 * Core
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.controllers.core = {}
BzDeck.controllers.core.notifications = new Set();
BzDeck.controllers.core.timers = new Map();

BzDeck.controllers.core.request = function (method, path, params, data = null, listeners = {}, options = {}) {
  let server = BzDeck.models.data.server,
      account = BzDeck.models.data.account,
      xhr = new XMLHttpRequest(),
      url = new URL(server.url + server.endpoints.rest);

  params = params || new URLSearchParams();

  if (options.auth) {
    params.append('token', `${account.id}-${account.token}`);
  }

  url.pathname += path;
  url.searchParams = params;
  xhr.open(method, url.toString(), true);
  xhr.setRequestHeader('Accept', 'application/json');

  for (let [type, listener] of Iterator(listeners)) if (type !== 'upload') {
    xhr.addEventListener(type, event => listener(event));
  }

  for (let [type, listener] of Iterator(listeners.upload || {})) {
    xhr.upload.addEventListener(type, event => listener(event));
  }

  return new Promise((resolve, reject) => {
    xhr.addEventListener('load', event => {
      let text = event.target.responseText;

      text ? resolve(JSON.parse(text)) : reject(new Error('Data not found or not valid in the response.'));
    });

    xhr.addEventListener('error', event => reject(new Error('Connection error.')));
    xhr.addEventListener('abort', event => reject(new Error('Connection aborted.')));

    if (navigator.onLine) {
      xhr.send(data);
    } else {
      reject(new Error('You have to go online to load data.')); // l10n
    }
  });
};

BzDeck.controllers.core.show_notification = function (title, body) {
  if (BzDeck.models.data.prefs['notifications.show_desktop_notifications'] === false) {
    return;
  }

  // Firefox OS requires a complete URL for the icon
  let icon = location.origin + '/static/images/logo/icon-128.png',
      notification = new Notification(title, { body, icon });

  this.notifications.add(notification);

  return new Promise(resolve => notification.addEventListener('click', event => resolve(event)));
};

BzDeck.controllers.core.parse_comment = function (str) {
  let blockquote = p => {
    let regex = /^&gt;\s?/gm;

    if (!p.match(regex)) {
      return p;
    }

    let lines = p.split(/\n/),
        quote = [];

    for (let [i, line] of lines.entries()) {
      if (line.match(regex)) {
        // A quote start
        quote.push(line);
      }

      if ((!line.match(regex) || !lines[i + 1]) && quote.length) {
        // A quote end, the next line is not a part of the quote, or no more lines
        let quote_str = quote.join('\n'),
            quote_repl = quote_str.replace(regex, '');

        if (quote_repl.match(regex)) {
          // Nested quote(s) found, do recursive processing
          quote_repl = blockquote(quote_repl);
        }

        for (let p of quote_repl.split(/\n{2,}/)) {
          quote_repl = quote_repl.replace(p, `<p>${p}</p>`);
        }

        p = p.replace(quote_str, `<blockquote>${quote_repl}</blockquote>`);
        quote = [];
      }
    }

    return p;
  };

  str = FlareTail.util.string.sanitize(str);

  // Quotes
  for (let p of str.split(/\n{2,}/)) {
    str = str.replace(p, `<p>${blockquote(p)}</p>`);
  }

  str = str.replace(/\n{2,}/gm, '').replace(/\n/gm, '<br>');

  // General links
  str = str.replace(
    /((https?|feed|ftps?|ircs?|mailto|news):(?:\/\/)?[\w-]+(\.[\w-]+)+((&amp;|[\w.,@?^=%$:\/~+#-])*(&amp;|[\w@?^=%$\/~+#-]))?)/gm,
    '<a href="$1">$1</a>'
  );

  // Email links
  // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address
  str = str.replace(
    /^([a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/,
    '<a href="mailto:$1">$1</a>'
  );

  // Bugs
  str = str.replace(
    /Bug\s*#?(\d+)/igm,
    '<a href="/bug/$1" data-bug-id="$1">Bug $1</a>' // l10n
  );

  // Attachments
  str = str.replace(
    /Attachment\s*#?(\d+)/igm,
    '<a href="/attachment/$1" data-attachment-id="$1">Attachment $1</a>' // l10n
  );

  return str;
};

/* ------------------------------------------------------------------------------------------------------------------
 * App
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.controllers.app = {};

BzDeck.controllers.app.install = function () {
  return FlareTail.util.app.install(BzDeck.config.app.manifest); // Promise
};

BzDeck.controllers.app.register_activity_handler = function () {
  // Match BMO's bug detail pages.
  // TODO: Implement a handler for attachments
  let re = /^https?:\/\/(?:bugzilla\.mozilla\.org\/show_bug\.cgi\?id=|bugzil\.la\/)(\d+)$/;

  // Not implemented yet on Firefox OS nor Firefox for Android
  if (typeof navigator.mozRegisterActivityHandler === 'function') {
    navigator.mozRegisterActivityHandler({
      'name': 'view',
      'filters': {
        'type': 'url',
        'url': {
          'required': true,
          'regexp': re
        }
      }
    });
  }

  if (typeof navigator.mozSetMessageHandler === 'function') {
    navigator.mozSetMessageHandler('activity', req => {
      let match = req.source.url.match(re);

      if (match) {
        BzDeck.router.navigate('/bug/' + match[1]);
      }
    });
  }
};

/* ------------------------------------------------------------------------------------------------------------------
 * Session
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.controllers.session = {};

BzDeck.controllers.session.show_first_notification = function () {
  // Authorize a notification
  FlareTail.util.app.auth_notification();

  // Update UI & Show a notification
  BzDeck.controllers.bugs.toggle_unread(true);

  // Notify requests
  BzDeck.models.bugs.get_subscription_by_id('requests').then(bugs => {
    let len = bugs.size;

    if (!len) {
      return;
    }

    let title = len > 1 ? `You have ${len} requests`
                        : 'You have 1 request'; // l10n
    let body = len > 1 ? 'Select the Requests folder to browse those bugs.'
                       : 'Select the Requests folder to browse the bug.'; // l10n

    // TODO: Improve the notification body to describe more about the requests,
    // e.g. There are 2 bugs awaiting your information, 3 patches awaiting your review.

    // Select the Requests folder when the notification is clicked
    BzDeck.controllers.core.show_notification(title, body).then(event => BzDeck.router.navigate('/home/requests'));
  });
};

BzDeck.controllers.session.login = function () {
  BzDeck.views.session.login();
};

BzDeck.controllers.session.logout = function () {
  BzDeck.views.session.logout();

  this.clean();

  // Delete the account data
  BzDeck.models.data.account.active = false;
  BzDeck.models.accounts.save_account(BzDeck.models.data.account);

  delete BzDeck.models.data.account;
};

BzDeck.controllers.session.clean = function () {
  // Terminate timers
  for (let timer of BzDeck.controllers.core.timers.values()) {
    window.clearInterval(timer);
  }

  BzDeck.controllers.core.timers.clear();

  // Destroy all notifications
  for (let notification of BzDeck.controllers.core.notifications) {
    notification.close()
  };

  BzDeck.controllers.core.notifications.clear();

  // Disconnect from the Bugzfeed server
  BzDeck.controllers.bugzfeed.disconnect();
}

/* ------------------------------------------------------------------------------------------------------------------
 * Events
 * ------------------------------------------------------------------------------------------------------------------ */

window.addEventListener('beforeunload', event => {
  BzDeck.controllers.session.clean();
});

window.addEventListener('online', event => {
  BzDeck.controllers.bugzfeed.connect();
});
