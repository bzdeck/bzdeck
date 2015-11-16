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
  this.on('BugModel:AnnotationUpdated', data => {
    if (data.type === 'unread') {
      this.toggle_unread();
    }
  }, true);

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
 * Register the app for a Web activity. This is actually not working on Firefox OS.
 *
 * @argument {undefined}
 * @return {undefined}
 * @see {@link https://hacks.mozilla.org/2013/01/introducing-web-activities/}
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/MozActivityRequestHandler}
 */
BzDeck.controllers.Global.prototype.register_activity_handler = function () {
  // Match BMO's bug detail pages.
  // TODO: Implement a handler for attachments
  let re = /^https?:\/\/(?:bugzilla\.mozilla\.org\/show_bug\.cgi\?id=|bugzil\.la\/)(\d+)$/;

  // Not implemented yet on Firefox OS nor Firefox for Android
  if (typeof navigator.mozRegisterActivityHandler === 'function') {
    navigator.mozRegisterActivityHandler({
      name: 'view',
      filters: {
        type: 'url',
        url: {
          required: true,
          regexp: re
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
