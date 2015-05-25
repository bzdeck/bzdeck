/**
 * BzDeck Global Sidebar Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.Sidebar = function SidebarController () {
  let mobile = FlareTail.util.ua.device.mobile;

  this.data = new Proxy({
    'folder_id': null
  }, {
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      // On mobile, the same folder can be selected
      if (!mobile && oldval === newval) {
        return true;
      }

      if (prop === 'folder_id' && oldval) {
        // On mobile, wait until the sidebar is closed so that the transition effects work smoother
        if (mobile) {
          window.setTimeout(window => {
            BzDeck.router.navigate('/home/' + newval);
            obj[prop] = newval;
          }, 600);

          return true;
        }

        BzDeck.router.navigate('/home/' + newval);
      }

      obj[prop] = newval;

      return true;
    }
  });

  BzDeck.views.sidebar = new BzDeck.views.Sidebar();

  this.on('V:FolderSelected', data => this.data.folder_id = data.id);

  // Update the sidebar Inbox folder at startup and whenever notified
  this.toggle_unread();
  this.on('BugModel:AnnotationUpdated', data => {
    if (data.type === 'unread') {
      this.toggle_unread();
    }
  }, true);
};

BzDeck.controllers.Sidebar.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Sidebar.prototype.constructor = BzDeck.controllers.Sidebar;

BzDeck.controllers.Sidebar.prototype.open_folder = function (folder_id) {
  let bugs = BzDeck.controllers.homepage.data.bugs = BzDeck.collections.subscriptions.get(folder_id); // Map

  this.trigger(':FolderOpened', { folder_id, bugs });
};

BzDeck.controllers.Sidebar.prototype.toggle_unread = function () {
  let all_bugs = BzDeck.collections.subscriptions.get_all().values(),
      number = [for (bug of all_bugs) if (bug.unread && bug.is_new) bug].length;

  this.trigger(':UnreadToggled', { number });
};
