/**
 * BzDeck Home Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 23
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.HomePage = function () {
  let BGw = BriteGrid.widget;

  let folder_data = [
    {
      'id': '-subscriptions',
      'label': 'My Bugs',
      'selected': true,
      'data': { 'id': 'subscriptions' },
      'sub': [
        {
          'id': '-subscriptions--cc',
          'label': 'CCed',
          'data': { 'id': 'subscriptions/cc' }
        },
        {
          'id': '-subscription--reported',
          'label': 'Reported',
          'data': { 'id': 'subscriptions/reported' }
        },
        {
          'id': '-subscription--assigned',
          'label': 'Assigned',
          'data': { 'id': 'subscriptions/assigned' }
        },
        {
          'id': '-subscription--qa',
          'label': 'QA Contact',
          'data': { 'id': 'subscriptions/qa' }
        }
      ]
    },
    {
      'id': '-recent',
      'label': 'Recent',
      'data': { 'id': 'recent' }
    },
    {
      'id': '-starred',
      'label': 'Starred',
      'data': { 'id': 'starred' }
    },
    {
      'id': '-unread',
      'label': 'Unread',
      'data': { 'id': 'unread' }
    }
  ];

  let folders = new BGw.Tree(document.getElementById('home-folders'), folder_data);
  folders.view = new Proxy(folders.view, {
    set: (obj, prop, value) => {
      if (prop === 'selected') {
        let $folder = Array.isArray(value) ? value[0] : value;
        this.data.folder_id = $folder.dataset.id;
      }
      obj[prop] = value;
    }
  });

  new BGw.ScrollBar(document.getElementById('home-folders-outer'));
  new BGw.ScrollBar(document.getElementById('home-preview-bug-info'));
  new BGw.ScrollBar(document.getElementById('home-preview-bug-timeline'));

  this.view = {};

  let $grid = document.getElementById('home-list');
  this.view.grid = new BriteGrid.widget.Grid($grid, {
    rows: [],
    columns: BzDeck.options.grid.default_columns
  },
  {
    sortable: true,
    reorderable: true,
    sort_conditions: { key:'id', order:'ascending' }
  });

  $grid.addEventListener('Selected', event => {
    let ids = event.detail.ids;
    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = Number.toInteger(ids[ids.length - 1]);
      // Mark as Read
      let data = this.view.grid.data;
      for (let $item of event.detail.items) {
        let _data = data.rows[$item.sectionRowIndex].data;
        _data._unread = false;
      }
    }
  });

  $grid.addEventListener('dblclick', event => {
    let $target = event.originalTarget;
    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      new BzDeck.DetailsPage($target.dataset.id);
    }
  });

  $grid.addEventListener('keydown', event => {
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
  }, true); // use capture

  // Show Details button
  let $button = document.getElementById('home-button-show-details'),
      button = this.view.details_button = new BriteGrid.widget.Button($button);

  $button.addEventListener('Pressed', event => {
    new BzDeck.DetailsPage(this.data.preview_id);
  });

  this.data = new Proxy({
    folder_id: null,
    preview_id: null
  },
  {
    set: (obj, prop, newval) => {
      let oldval = obj[prop];
      if (oldval === newval) {
        return;
      }
      if (prop === 'folder_id') {
        this.open_folder(newval);
      }
      if (prop === 'preview_id') {
        this.show_preview(oldval, newval);
      }
      obj[prop] = newval;
    }
  });

  $grid.addEventListener('Rebuilt', event => {
    if (BzDeck.bootstrap.processing) {
      BzDeck.bootstrap.finish();
    }
  });

  // Select the 'My Bugs' folder
  this.data.folder_id = 'subscriptions';

  // Authorize notification
  BriteGrid.util.app.auth_notification();

  // Update UI: the Unread folder on the home page
  BzDeck.model.get_all_bugs(bugs => {
    bugs = bugs.filter(bug => bug._unread);
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

  BzDeck.model.get_bug_by_id(newval, bug => {
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
  let ids = [],
      bugs = [],
      grid = this.view.grid;

  this.data.preview_id = null;

  let update_list = () => {
    if (bugs.length) {
      // If bugs provided, just update view
      BzDeck.global.update_grid_data(grid, bugs);
    } else {
      BzDeck.model.get_bugs_by_ids(ids, bugs => {
        BzDeck.global.update_grid_data(grid, bugs);
      });
    }
  };

  if (folder_id.match(/^subscriptions\/(.*)/)) {
    BzDeck.model.get_subscription_by_id(RegExp.$1, sub => {
      ids = sub.bugs.map(bug => bug.id);
      update_list();
    });
  }

  if (folder_id === 'subscriptions') {
    BzDeck.model.get_all_subscriptions(subscriptions => {
      for (let sub of subscriptions) {
        ids = ids.concat(sub.bugs.map(bug => bug.id).filter(id => ids.indexOf(id) === -1));
      }
      update_list();
    });
  }

  if (folder_id === 'starred') {
    BzDeck.model.get_all_bugs(_bugs => {
      bugs = _bugs.filter(bug => bug._starred === true);
      update_list();
    });
  }

  if (folder_id === 'unread') {
    BzDeck.model.get_all_bugs(_bugs => {
      bugs = _bugs.filter(bug => bug._unread === true);
      update_list();
    });
  }

  if (folder_id === 'recent') {
    BzDeck.model.get_all_bugs(_bugs => {
      bugs = _bugs.filter(bug => bug._last_viewed);
      bugs.sort((a, b) => a._last_viewed > b._last_viewed);
      bugs = bugs.slice(0, 100); // Recent 100 bugs
      update_list();
    });
  }
};
