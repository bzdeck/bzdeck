/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Global Controller that provides some utility functions for controllers.
 *
 * @constructor
 * @extends BaseController
 * @argument {undefined}
 * @return {Object} controller - New GlobalController instance.
 */
BzDeck.controllers.Global = function GlobalController () {
  this.subscribe('BugModel:AnnotationUpdated', true);

  // Navigation, can be requested by any view
  this.on('V:OpenBug', data => BzDeck.router.navigate(`/bug/${data.id}`, { ids: data.ids, att_id: data.att_id }), true);
  this.on('V:OpenAttachment', data => BzDeck.router.navigate(`/attachment/${data.id}`), true);
  this.on('V:OpenProfile', data => BzDeck.router.navigate(`/profile/${data.email}`), true);
};

BzDeck.controllers.Global.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Global.prototype.constructor = BzDeck.controllers.Global;

BzDeck.controllers.Global.prototype.notifications = new Set();
BzDeck.controllers.Global.prototype.timers = new Map();

/**
 * Prepare the corresponding view. This should be called after the prefs are retrieved.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.Global.prototype.init = function () {
  this.view = BzDeck.views.global = new BzDeck.views.Global();
};

/**
 * Called by BugModel whenever a bug annotation is updated. Notify the change if the type is 'unread'.
 *
 * @argument {Object} data - Annotation change details.
 * @argument {Proxy} data.bug - Changed bug.
 * @argument {String} data.type - Annotation type such as 'starred' or 'unread'.
 * @argument {Boolean} data.value - New annotation value.
 * @return {undefined}
 */
BzDeck.controllers.Global.prototype.on_annotation_updated = function (data) {
  if (data.type === 'unread') {
    this.toggle_unread();
  }
};

/**
 * Determine the number of unread bugs and notify the view.
 *
 * @argument {Boolean} [loaded=false] - Whether bug data is loaded at startup.
 * @return {undefined}
 */
BzDeck.controllers.Global.prototype.toggle_unread = function (loaded = false) {
  if (!BzDeck.controllers.homepage) {
    return;
  }

  let bugs = [...BzDeck.collections.bugs.get_all().values()].filter(bug => bug.unread),
      status = bugs.length > 1 ? `You have ${bugs.length} unread bugs` : 'You have 1 unread bug', // l10n
      extract = bugs.slice(0, 3).map(bug => `${bug.id} - ${bug.summary}`).join('\n'),
      unread_num = [...BzDeck.controllers.homepage.data.bugs.values()].filter(bug => bug.unread).length;

  // Update View
  this.view.toggle_unread(bugs, loaded, unread_num);

  // Select Inbox when the notification is clicked
  // this.show_notification(status, extract).then(event => BzDeck.router.navigate('/home/inbox'));
};

/**
 * Show a desktop notification.
 *
 * @argument {String} title
 * @argument {String} body
 * @return {Promise.<MouseEvent>} event - Promise to be resolved in an event fired when the notification is clicked.
 */
BzDeck.controllers.Global.prototype.show_notification = function (title, body) {
  if (BzDeck.prefs.get('notifications.show_desktop_notifications') === false) {
    return;
  }

  // Firefox OS requires a complete URL for the icon
  let icon = location.origin + '/static/images/logo/icon-128.png',
      notification = new Notification(title, { body, icon });

  this.notifications.add(notification);

  return new Promise(resolve => notification.addEventListener('click', event => resolve(event)));
};

/**
 * Parse a bug comment and format as HTML. URLs are automatically converted to links. Bug IDs and attachment IDs are
 * converted to in-app links. Quotes are nested in <blockquote> elements. TODO: Add more autolinkification support (#68)
 * and improve the performance probably using a worker.
 *
 * @argument {String} str - Bug comment in plain text, as provided by Bugzilla.
 * @return {String} str - HTML-formatted comment.
 */
BzDeck.controllers.Global.prototype.parse_comment = function (str) {
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

  str = this.helpers.string.sanitize(str);

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
    '<a href="/attachment/$1" data-att-id="$1">Attachment $1</a>' // l10n
  );

  return str;
};
