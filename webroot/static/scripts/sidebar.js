/**
 * BzDeck Global Sidebar
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.Sidebar = function Sidebar () {
  let FTw = FlareTail.widget,
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      phone = FlareTail.util.device.type === 'mobile-phone',
      $root = document.documentElement, // <html>
      $sidebar = document.querySelector('#sidebar');

  if (mobile) {
    document.querySelector('#sidebar-account').appendChild(document.querySelector('#main-menu--app--account'));
    document.querySelector('#sidebar-menu').appendChild(document.querySelector('#main-menu--app-menu'));
  }

  $root.setAttribute('data-sidebar-hidden', phone);
  $sidebar.setAttribute('aria-hidden', phone);

  new FTw.ScrollBar($sidebar.querySelector('div'));

  $sidebar.addEventListener('click', event => {
    if (phone) {
      let hidden = $sidebar.getAttribute('aria-hidden') !== 'true';

      $root.setAttribute('data-sidebar-hidden', hidden);
      $sidebar.setAttribute('aria-hidden', hidden);
    }
  });

  this.folder_data = [
    {
      'id': 'sidebar-folders--inbox',
      'label': 'Inbox',
      'selected': true,
      'data': { 'id': 'inbox' }
    },
    {
      'id': 'sidebar-folders--starred',
      'label': 'Starred',
      'data': { 'id': 'starred' }
    },
    {
      'id': 'sidebar-folders--recent',
      'label': 'Recent',
      'data': { 'id': 'recent' }
    },
    {
      'id': 'sidebar-folders--requests',
      'label': 'Requests',
      'data': { 'id': 'requests' }
    },
    {
      'id': 'sidebar-folders--cc',
      'label': 'CCed',
      'data': { 'id': 'cc' }
    },
    {
      'id': 'sidebar-folders--reported',
      'label': 'Reported',
      'data': { 'id': 'reported' }
    },
    {
      'id': 'sidebar-folders--assigned',
      'label': 'Assigned',
      'data': { 'id': 'assigned' }
    },
    {
      'id': 'sidebar-folders--mentor',
      'label': 'Mentor',
      'data': { 'id': 'mentor' }
    },
    {
      'id': 'sidebar-folders--qa',
      'label': 'QA Contact',
      'data': { 'id': 'qa' }
    },
    {
      'id': 'sidebar-folders--important',
      'label': 'Important',
      'data': { 'id': 'important' }
    },
    {
      'id': 'sidebar-folders--all',
      'label': 'All Bugs',
      'data': { 'id': 'all' }
    }
  ];

  let $$folders = this.$$folders = new FTw.ListBox(document.querySelector('#sidebar-folder-list'), this.folder_data);

  $$folders.bind('Selected', event => this.data.folder_id = event.detail.ids[0]);

  this.data = new Proxy({
    'folder_id': null,
  },
  {
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      // On mobile, the same folder can be selected
      if (!mobile && oldval === newval) {
        return;
      }

      if (prop === 'folder_id' && oldval) {
        BzDeck.core.navigate('/home/' + newval);
      }

      obj[prop] = newval;
    }
  });

  this.open_folder('inbox');

  window.addEventListener('Bug:UnreadToggled', event => {
    // Update the sidebar Inbox folder
    BzDeck.model.get_all_subscriptions().then(subscriptions => {
      let unread = new Set();

      for (let [key, bugs] of subscriptions) {
        for (let bug of bugs) if (bug._unread) {
          unread.add(bug.id);
        }
      }

      this.toggle_unread_ui(unread.size);
    });
  });
};

BzDeck.Sidebar.prototype.open_folder = function (folder_id) {
  let home = BzDeck.pages.home;

  home.data.preview_id = null;

  let update_list = bugs => {
    home.data.bug_list = bugs;
    FlareTail.util.event.async(() => {
      home.thread.update(bugs);
      document.querySelector('#home-list > footer').setAttribute('aria-hidden', bugs.length ? 'true' : 'false');
    });

    let folder_label = [for (f of this.folder_data) if (f.data.id === folder_id) f][0].label,
        unread = [for (bug of bugs) if (bug._unread) bug].length;

    BzDeck.pages.home.update_window_title(folder_label + (unread > 0 ? ` (${unread})` : ''));
  };

  let get_subscribed_bugs = () => new Promise(resolve => {
    BzDeck.model.get_all_subscriptions().then(subscriptions => {
      let ids = [];

      for (let [key, bugs] of subscriptions) {
        // Remove duplicates
        ids.push(...[for (bug of bugs) if (!ids.includes(bug.id)) bug.id]);
      }

      BzDeck.model.get_bugs_by_ids(ids).then(bugs => resolve(bugs));
    });
  });

  // Mobile compact layout
  if (FlareTail.util.device.type.startsWith('mobile') &&
      BzDeck.toolbar.$$tablist.view.selected[0].id !== 'tab-home') {
    // Select the home tab
    BzDeck.toolbar.$$tablist.view.selected = BzDeck.toolbar.$$tablist.view.members[0];
  }

  if (folder_id === 'inbox') {
    get_subscribed_bugs().then(bugs => {
      let recent_time = Date.now() - 1000 * 60 * 60 * 24 * 11;
      let is_new = bug => {
        if (bug._unread) {
          return true;
        }

        // Ignore CC Changes option
        // At first startup, bug details are not loaded yet, so check if the comments exist
        if (BzDeck.model.data.prefs['notifications.ignore_cc_changes'] !== false && bug.comments) {
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
      update_list([for (bug of bugs) if (is_new(bug)) bug]);
    });
  }

  if (folder_id.match(/^(cc|reported|assigned|mentor|qa|requests)$/)) {
    BzDeck.model.get_subscription_by_id(folder_id).then(bugs => update_list(bugs));
  }

  if (folder_id === 'all') {
    get_subscribed_bugs().then(bugs => {
      update_list(bugs);
    });
  }

  if (folder_id === 'starred') {
    // Starred bugs may include non-subscribed bugs, so get ALL bugs
    BzDeck.model.get_all_bugs().then(bugs => {
      update_list([for (bug of bugs) if (BzDeck.model.bug_is_starred(bug)) bug]);
    });
  }

  if (folder_id === 'recent') {
    // Recently selected bugs may include non-subscribed bugs, so get ALL bugs
    // TODO: Bugs on threads should be sorted by the last viewed date, not by the last modified date.
    BzDeck.model.get_all_bugs().then(bugs => {
      update_list([for (bug of bugs) if (bug._last_viewed) bug]
                    .sort((a, b) => a._last_viewed < b._last_viewed).slice(0, 50));
    });
  }

  if (folder_id === 'important') {
    get_subscribed_bugs().then(bugs => {
      let severities = ['blocker', 'critical', 'major'];

      update_list([for (bug of bugs) if (severities.includes(bug.severity)) bug]);
    });
  }
};

BzDeck.Sidebar.prototype.toggle_unread_ui = function (num) {
  let $label = document.querySelector('#sidebar-folders--inbox label'),
      $num = $label.querySelector('span');

  if (num) {
    $num = $num || $label.appendChild(document.createElement('span'));
    $num.textContent = num;
  } else if ($num) {
    $num.remove();
  }
};
