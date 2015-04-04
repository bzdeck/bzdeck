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

  // Update the sidebar Inbox folder
  this.on('Bug:UnreadToggled', data => BzDeck.models.bugs.get_subscribed_bugs().then(bugs => {
    this.trigger(':UnreadToggled', { 'number': [for (bug of bugs) if (bug._unread) bug].length });
  }));
};

BzDeck.controllers.Sidebar.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Sidebar.prototype.constructor = BzDeck.controllers.Sidebar;

BzDeck.controllers.Sidebar.prototype.open_folder = function (folder_id) {
  let update = bugs => {
    BzDeck.controllers.homepage.data.bugs = [...bugs]; // Clone the array or somehow it cannot be saved by Proxy
    this.trigger(':FolderOpened', { folder_id, bugs });
  };

  if (folder_id === 'inbox') {
    BzDeck.models.bugs.get_subscribed_bugs().then(bugs => {
      let recent_time = Date.now() - 1000 * 60 * 60 * 24 * 11;
      let is_new = bug => {
        if (bug._unread) {
          return true;
        }

        // Ignore CC Changes option
        // At first startup, bug details are not loaded yet, so check if the comments exist
        if (BzDeck.models.prefs.data['notifications.ignore_cc_changes'] !== false && bug.comments) {
          // Check if there is a comment, attachment or non-CC change(s) on the last modified time
          return [for (c of bug.comments) if (c.creation_time === bug.last_change_time) c].length ||
                 [for (a of bug.attachments || []) if (a.creation_time === bug.last_change_time) a].length ||
                 [for (h of bug.history || []) if (h.when === bug.last_change_time &&
                     [for (c of h.changes) if (c.field_name !== 'cc') c].length) h].length;
        }

        // Simply check the last modified date
        return new Date(bug.last_change_time) > recent_time;
      };

      // Recent bugs changed in 10 days + unread bugs
      update([for (bug of bugs) if (is_new(bug)) bug]);
    });
  }

  if (['watching', 'reported', 'assigned', 'mentor', 'qa', 'requests'].includes(folder_id)) {
    BzDeck.models.bugs.get_subscription(folder_id).then(bugs => update(bugs));
  }

  if (folder_id === 'all') {
    BzDeck.models.bugs.get_subscribed_bugs().then(bugs => update(bugs));
  }

  if (folder_id === 'starred') {
    // Starred bugs may include non-subscribed bugs, so get ALL bugs
    BzDeck.models.bugs.get_all().then(bugs => {
      update([for (bug of bugs) if (BzDeck.controllers.bugs.is_starred(bug)) bug]);
    });
  }

  if (folder_id === 'important') {
    BzDeck.models.bugs.get_subscribed_bugs().then(bugs => {
      let severities = ['blocker', 'critical', 'major'];

      update([for (bug of bugs) if (severities.includes(bug.severity)) bug]);
    });
  }
};
