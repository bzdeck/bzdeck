/**
 * BzDeck Home Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.HomePage = function () {
  let FTw = FlareTail.widget,
      mobile_mql = FlareTail.util.device.mobile.mql,
      prefs = BzDeck.data.prefs;

  // A movable splitter between the thread pane and preview pane
  {
    let splitter = this.preview_splitter
                 = new FTw.Splitter(document.querySelector('#home-preview-splitter')),
        prefix = 'ui.home.preview.splitter.position.',
        pref = prefs[prefix + splitter.data.orientation];

    if (pref) {
      splitter.data.position = pref;
    }

    splitter.bind('Resized', function (event) {
      let position = event.detail.position;

      if (position) {
        prefs[prefix + splitter.data.orientation] = position;
      }
    });
  }

  // Custom scrollbar (info)
  new FTw.ScrollBar(document.querySelector('#home-preview-bug-info'));

  // Custom scrollbar (timeline)
  let scrollbar = new FTw.ScrollBar(document.querySelector('#home-preview-bug-timeline'));
  scrollbar.onkeydown_extend = BzDeck.global.navigate_timeline_with_key.bind(scrollbar);

  this.view = {};

  let prefs = BzDeck.data.prefs,
      vertical = mobile_mql.matches || prefs['ui.home.layout'] === 'vertical',
      columns = prefs['home.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  let grid = this.view.grid = new FlareTail.widget.Grid(document.querySelector('#home-list'), {
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
    sort_conditions: vertical ? { key: 'last_change_time', order: 'descending' }
                              : prefs['home.list.sort_conditions'] ||
                                { key: 'id', order: 'ascending' }
  });

  this.change_layout(prefs['ui.home.layout']);

  mobile_mql.addListener(function (mql) {
    this.change_layout(prefs['ui.home.layout'], true);
  }.bind(this));

  grid.bind('Sorted', function (event) {
    prefs['home.list.sort_conditions'] = event.detail.conditions;
  });

  grid.bind('ColumnModified', function (event) {
    prefs['home.list.columns'] = event.detail.columns.map(function (col) {
      return {
        id: col.id,
        type: col.type || 'string',
        hidden: col.hidden || false
      };
    });
  });

  grid.bind('Selected', function (event) {
    let ids = event.detail.ids;

    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = parseInt(ids[ids.length - 1]);

      // Mobile compact layout or Vertical View
      if (window.matchMedia('(max-width: 799px)').matches) {
        new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
      }

      let data = this.view.grid.data;

      // Mark as Read
      for (let $item of event.detail.items) {
        data.rows[$item.sectionRowIndex].data._unread = false;
      }
    }
  }.bind(this));

  grid.bind('dblclick', function (event) {
    let $target = event.originalTarget;

    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
    }
  }.bind(this));

  grid.bind('keydown', function (event) {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.view.grid.data,
        view = this.view.grid.view,
        members = view.members,
        index = members.indexOf(view.$focused);

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
  let button = this.view.details_button
             = new FlareTail.widget.Button(document.querySelector('#home-button-show-details'));

  button.bind('Pressed', function (event) {
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

        return [bugs[row.data.id] for (row of this.view.grid.data.rows)];
      }

      return obj[prop];
    }.bind(this),
    set: function (obj, prop, newval) {
      let oldval = obj[prop];

      if (prop === 'preview_id') {
        FlareTail.util.event.async(function () {
          this.show_preview(oldval, newval);
        }.bind(this));
      }

      obj[prop] = newval;
    }.bind(this)
  });
};

BzDeck.HomePage.prototype.show_preview = function (oldval, newval) {
  let $pane = document.querySelector('#home-preview-pane'),
      $template = document.querySelector('#home-preview-bug'),
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

BzDeck.HomePage.prototype.change_layout = function (pref, sort_grid = false) {
  let vertical = FlareTail.util.device.mobile.mql.matches || pref === 'vertical',
      grid = this.view.grid,
      splitter = this.preview_splitter;

  document.documentElement.setAttribute('data-home-layout', vertical ? 'vertical' : 'classic');
  grid.options.adjust_scrollbar = !vertical;

  if (splitter) {
    let orientation = vertical ? 'vertical' : 'horizontal',
        pref = BzDeck.data.prefs['ui.home.preview.splitter.position.' + orientation];

    splitter.data.orientation = orientation;

    if (pref) {
      splitter.data.position = pref;
    }
  }

  if (vertical && sort_grid) {
    // Force to change the sort condition when switched to the mobile layout
    let cond = grid.options.sort_conditions;
    cond.key = 'last_change_time';
    cond.order = 'descending';
  }
};
