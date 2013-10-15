/**
 * BzDeck Home Page
 * Copyright © 2013 BriteGrid. All rights reserved.
 * Using: ECMAScript Harmony
 * Requires: Firefox 18
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.HomePage = function () {
  let BGw = BriteGrid.widget,
      mobile_mql = BriteGrid.util.device.mobile.mql,
      prefs = BzDeck.data.prefs;

  // A movable splitter between the thread pane and preview pane
  let $splitter = document.querySelector('#home-preview-splitter');
  if ($splitter) {
    let splitter = new BGw.Splitter($splitter),
        pref_name = 'ui.home.preview.splitter.position';
    if (prefs[pref_name]) {
      splitter.data.position = prefs[pref_name];
    }
    $splitter.addEventListener('Resized', function (event) {
      prefs[pref_name] = event.detail.position;
    });
  }

  // Custom scrollbar
  new BGw.ScrollBar(document.getElementById('home-preview-bug-info'));
  new BGw.ScrollBar(document.getElementById('home-preview-bug-timeline'));

  this.view = {};

  let $grid = document.getElementById('home-list'),
      prefs = BzDeck.data.prefs,
      columns = prefs['home.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  let grid = this.view.grid = new BriteGrid.widget.Grid($grid, {
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
    sort_conditions: (mobile_mql.matches) ? { key: 'last_change_time', order: 'descending' }
                                          : prefs['home.list.sort_conditions'] ||
                                            { key: 'id', order: 'ascending' }
  });

  mobile_mql.addListener(function (mql) {
    if (mql.matches) {
      // Force to change the sort condition when switched to the mobile layout
      let cond = grid.options.sort_conditions;
      cond.key = 'last_change_time'; // Chenge the key
      cond.key = 'last_change_time'; // Chenge the order to descending
    }
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
      if (mobile_mql.matches) {
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
      if (prop === 'preview_id') {
        this.show_preview(oldval, newval);
      }
      obj[prop] = newval;
    }.bind(this)
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
