/**
 * BzDeck Home Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 18
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.HomePage = function () {
  let BGw = BriteGrid.widget;

  let folder_data = this.folder_data = [
    {
      'id': 'home-folders--inbox',
      'label': 'Inbox',
      'selected': true,
      'data': { 'id': 'inbox' }
    },
    {
      'id': 'home-folders--starred',
      'label': 'Starred',
      'data': { 'id': 'starred' }
    },
    {
      'id': 'home-folders--unread',
      'label': 'Unread',
      'data': { 'id': 'unread' }
    },
    {
      'id': 'home-folders--important',
      'label': 'Important',
      'data': { 'id': 'important' }
    },
    {
      'id': 'home-folders--subscriptions--cc',
      'label': 'CCed',
      'data': { 'id': 'subscriptions/cc' }
    },
    {
      'id': 'home-folders--subscription--reported',
      'label': 'Reported',
      'data': { 'id': 'subscriptions/reported' }
    },
    {
      'id': 'home-folders--subscription--assigned',
      'label': 'Assigned',
      'data': { 'id': 'subscriptions/assigned' }
    },
    {
      'id': 'home-folders--subscription--qa',
      'label': 'QA Contact',
      'data': { 'id': 'subscriptions/qa' }
    },
    {
      'id': 'home-folders--subscriptions',
      'label': 'All Bugs',
      'data': { 'id': 'subscriptions' }
    }
  ];

  let folders = this.folders = new BGw.ListBox(document.getElementById('home-folders'), folder_data);
  folders.view = new Proxy(folders.view, {
    set: function (obj, prop, value) {
      if (prop === 'selected') {
        let $folder = Array.isArray(value) ? value[0] : value;
        this.data.folder_id = $folder.dataset.id;
      }
      obj[prop] = value;
    }.bind(this)
  });

  // Use custom scrollbar on desktop
  if (BriteGrid.widget.mode.layout === 'desktop') {
    new BGw.ScrollBar(document.getElementById('home-folders-outer'));
    new BGw.ScrollBar(document.getElementById('home-preview-bug-info'));
    new BGw.ScrollBar(document.getElementById('home-preview-bug-timeline'));
  }

  this.view = {};

  let $grid = document.getElementById('home-list'),
      mobile = BriteGrid.widget.mode.layout === 'mobile',
      prefs = BzDeck.data.prefs,
      columns = prefs['home.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  this.view.grid = new BriteGrid.widget.Grid($grid, {
    rows: [],
    columns: columns.map(function (col) {
      // Add labels
      switch (col.id) {
        case '_starred': {
          col.label = 'Starred';
          break;
        }
        case '_unread': {
          col.label = 'Unread';
          break;
        }
        default: {
          col.label = field[col.id].description;
        }
      }
      return col;
    })
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: (mobile) ? { key: 'last_change_time', order: 'descending' }
                              : prefs['home.list.sort_conditions'] ||
                                { key: 'id', order: 'ascending' }
  });

  $grid.addEventListener('Sorted', function (event) {
    prefs['home.list.sort_conditions'] = event.detail.conditions;
  });

  $grid.addEventListener('ColumnModified', function (event) {
    prefs['home.list.columns'] = event.detail.columns.map(function (col) {
      return {
        id: col.id,
        type: col.type || 'string',
        hidden: col.hidden || false
      };
    });
  });

  $grid.addEventListener('Selected', function (event) {
    let ids = event.detail.ids;
    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = Number.toInteger(ids[ids.length - 1]);
      // Mobile compact layout
      if (mobile) {
        new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
      }
      // Mark as Read
      let data = this.view.grid.data;
      for (let $item of event.detail.items) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = false;
      }
    }
  }.bind(this));

  $grid.addEventListener('dblclick', function (event) {
    let $target = event.originalTarget;
    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
    }
  }.bind(this));

  $grid.addEventListener('keydown', function (event) {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.focused);
    // [B] Select previous bug
    if (!modifiers && event.keyCode === event.DOM_VK_B && index > 0) {
      view.selected = view.focused = members[index - 1];
    }
    // [F] Select next bug
    if (!modifiers && event.keyCode === event.DOM_VK_F && index < members.length - 1) {
      view.selected = view.focused = members[index + 1];
    }
    // [M] toggle read
    if (!modifiers && event.keyCode === event.DOM_VK_M) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = _data._unread !== true;
      }
    }
    // [S] toggle star
    if (!modifiers && event.keyCode === event.DOM_VK_S) {
      for (let $item of view.selected) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._starred = _data._starred !== true;
      }
    }
  }.bind(this), true); // use capture

  // Show Details button
  let $button = document.getElementById('home-button-show-details'),
      button = this.view.details_button = new BriteGrid.widget.Button($button);

  $button.addEventListener('Pressed', function (event) {
    BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
  }.bind(this));

  this.data = new Proxy({
    bug_list: [],
    folder_id: null,
    preview_id: null
  },
  {
    get: function (obj, prop) {
      if (prop === 'bug_list') {
        // Return a sorted bug list
        let bugs = {};
        for (let bug of obj[prop]) {
          bugs[bug.id] = bug;
        }
        return this.view.grid.data.rows.map(function (row) bugs[row.data.id]);
      }
      return obj[prop];
    }.bind(this),
    set: function (obj, prop, newval) {
      let oldval = obj[prop];
      // On mobile, the same folder can be selected
      if (!mobile && oldval === newval) {
        return;
      }
      if (prop === 'folder_id') {
        this.open_folder(newval);
      }
      if (prop === 'preview_id') {
        this.show_preview(oldval, newval);
      }
      obj[prop] = newval;
    }.bind(this)
  });

  // Select the 'Inbox' folder
  this.data.folder_id = 'inbox';

  // Authorize notification
  BriteGrid.util.app.auth_notification();

  // Update UI: the Unread folder on the home page
  BzDeck.model.get_all_bugs(function (bugs) {
    bugs = bugs.filter(function (bug) bug._unread);
    let num = bugs.length,
        $label = document.querySelector('[id="home-folders--unread"] label');
    if (!num) {
      $label.textContent = 'Unread'; // l10n
      return;
    }    
    // Statusbar
    $label.textContent = 'Unread (%d)'.replace('%d', num); // l10n
    let status = (num > 1) ? 'You have %d unread bugs'.replace('%d', num)
                           : 'You have 1 unread bug'; // l10n
    BzDeck.global.show_status(status);
    // Notification
    let list = [];
    for (let [i, bug] of Iterator(bugs)) {
      list.push(bug.id + ' - ' + bug.summary);
      if (num > 3 && i === 2) {
        list.push('...');
        break;
      }
    }
    BzDeck.global.show_notification(status, list.join('\n'));
  });
};

BzDeck.HomePage.prototype.show_preview = function (oldval, newval) {
  let $pane = document.getElementById('home-preview-pane'),
      $template = document.getElementById('home-preview-bug'),
      button = this.view.details_button;

  // Remove the current preview if exists

  if (!newval) {
    $template.setAttribute('aria-hidden', 'true');
    button.data.disabled = true;
    return;
  }

  BzDeck.model.get_bug_by_id(newval, function (bug) {
    if (!bug) {
      $template.setAttribute('aria-hidden', 'true');
      button.data.disabled = true;
      return;
    }
    // Fill the content
    BzDeck.global.fill_template($template, bug);
    $template.setAttribute('aria-hidden', 'false');
    button.data.disabled = false;
  });
};

BzDeck.HomePage.prototype.open_folder = function (folder_id) {
  this.data.preview_id = null;

  let update_list = function (bugs) {
    this.data.bug_list = bugs;
    BzDeck.global.update_grid_data(this.view.grid, bugs);
  }.bind(this);

  let get_subscribed_bugs = function (callback) {
    BzDeck.model.get_all_subscriptions(function (subscriptions) {
      let ids = [];
      for (let sub of subscriptions) {
        // Remove duplicates
        ids = ids.concat(sub.bugs.map(function (bug) bug.id)
                                 .filter(function (id) ids.indexOf(id) === -1));
      }
      BzDeck.model.get_bugs_by_ids(ids, function (bugs) {
        callback(bugs);
      });
    });
  };

  // Mobile compact layout
  if (BriteGrid.widget.mode.layout === 'mobile' &&
      BzDeck.toolbar.tablist.view.selected[0].id !== 'tab-home') {
    // Select the home tab
    BzDeck.toolbar.tablist.view.selected = BzDeck.toolbar.tablist.view.members[0];
  }

  // Change the window title and the tab label
  let folder_label = this.folder_data
                         .filter(function (folder) folder.data.id === folder_id)[0].label;
  document.title = folder_label + ' | BzDeck'; // l10n
  document.querySelector('[role="banner"] h1').textContent = folder_label;
  document.querySelector('#tab-home').title = folder_label;
  document.querySelector('#tab-home label').textContent = folder_label;
  document.querySelector('#tabpanel-home h2').textContent = folder_label;

  // Save history
  let hash = '#' + folder_id;
  if (location.hash !== hash) {
    history.pushState({}, folder_label, hash);
  }

  if (folder_id === 'inbox') {
    get_subscribed_bugs(function (bugs) {
      bugs.reverse(function (a, b) a.last_change_time > b.last_change_time);
      update_list(bugs.slice(0, 50)); // Recent 50 bugs
    });
  }

  if (folder_id.match(/^subscriptions\/(.*)/)) {
    BzDeck.model.get_subscription_by_id(RegExp.$1, function (sub) {
      BzDeck.model.get_bugs_by_ids(sub.bugs.map(function (bug) bug.id), function (bugs) {
        update_list(bugs);
      });
    });
  }

  if (folder_id === 'subscriptions') {
    get_subscribed_bugs(function (bugs) {
      update_list(bugs);
    });
  }

  if (folder_id === 'starred') {
    // Starred bugs may include non-subscribed bugs, so get ALL bugs
    BzDeck.model.get_all_bugs(function (bugs) {
      update_list(bugs.filter(function (bug) bug._starred));
    });
  }

  if (folder_id === 'unread') {
    // Unread bugs may include non-subscribed bugs, so get ALL bugs
    BzDeck.model.get_all_bugs(function (bugs) {
      update_list(bugs.filter(function (bug) bug._unread));
    });
  }

  if (folder_id === 'important') {
    get_subscribed_bugs(function (bugs) {
      update_list(bugs.filter(
        function (bug) ['blocker', 'critical', 'major'].indexOf(bug.severity) > -1));
    });
  }
};
