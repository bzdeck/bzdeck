/**
 * BzDeck Home Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.HomePage = function () {
  let FTw = FlareTail.widget,
      mobile = FlareTail.util.device.type.startsWith('mobile'),
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

    splitter.bind('Resized', event => {
      let position = event.detail.position;

      if (position) {
        prefs[prefix + splitter.data.orientation] = position;
      }
    });
  }

  let $bug = document.querySelector('#home-preview-pane article'),
      $info = document.querySelector('#preview-bug-info').content.cloneNode(true).firstElementChild;

  $bug.appendChild($info).id = 'home-preview-bug-info';

  // Star on the header
  let $star_checkbox = document.querySelector('#home-preview-bug header [data-field="_starred"]');

  (new FTw.Checkbox($star_checkbox)).bind('Toggled', event => {
    BzDeck.core.toggle_star(this.data.preview_id, event.detail.checked);
  });

  // Custom scrollbar (info)
  new FTw.ScrollBar($info);

  // Custom scrollbar (timeline)
  let scrollbar = new FTw.ScrollBar(document.querySelector('#home-preview-bug-timeline'));

  if (scrollbar) {
    scrollbar.onkeydown_extend = BzDeck.bug.timeline.handle_keydown.bind(scrollbar);
  }

  this.view = {};

  let prefs = BzDeck.data.prefs,
      layout_pref = prefs['ui.home.layout'],
      vertical = mobile || !layout_pref || layout_pref === 'vertical',
      default_cols = BzDeck.options.grid.default_columns,
      columns = prefs['home.list.columns'] || default_cols,
      field = BzDeck.data.bugzilla_config.field;

  let grid = this.view.grid = new FlareTail.widget.Grid(document.querySelector('#home-list'), {
    'rows': [],
    'columns': columns.map(col => {
      // Add labels
      col.label = [for (_col of default_cols) if (_col.id === col.id) _col.label][0] ||
                  field[col.id].description;

      return col;
    })
  },
  {
    'date': { 'simple': vertical },
    'sortable': true,
    'reorderable': true,
    'sort_conditions': vertical ? { 'key': 'last_change_time', 'order': 'descending' }
                                : prefs['home.list.sort_conditions'] ||
                                  { 'key': 'id', 'order': 'ascending' }
  });

  this.change_layout(prefs['ui.home.layout']);

  grid.bind('Sorted', event => {
    prefs['home.list.sort_conditions'] = event.detail.conditions;
  });

  grid.bind('ColumnModified', event => {
    prefs['home.list.columns'] = event.detail.columns.map(col => {
      return {
        'id': col.id,
        'type': col.type || 'string',
        'hidden': col.hidden || false
      };
    });
  });

  grid.bind('Selected', event => {
    let ids = event.detail.ids;

    if (ids.length) {
      // Show Bug in Preview Pane
      this.data.preview_id = Number.parseInt(ids[ids.length - 1]);

      if (mobile) {
        BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
      }

      let data = this.view.grid.data;
    }
  });

  grid.bind('Rebuilt', event => {
    // Select the first bug on the list automatically when a folder is opened
    // TODO: Remember the last selected bug for each folder
    if (grid.data.rows.length && !mobile) {
      grid.view.selected = grid.view.focused = grid.view.members[0];
    }
  });

  grid.bind('dblclick', event => {
    let $target = event.originalTarget;

    if ($target.mozMatchesSelector('[role="row"]')) {
      // Open Bug in New Tab
      BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
    }
  });

  grid.bind('keydown', event => {
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
  }, true); // use capture

  // Show Details button
  let $button = document.querySelector('#home-preview-bug [data-command="show-details"]'),
      button = this.view.details_button = new FlareTail.widget.Button($button);

  button.bind('Pressed', event => {
    BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
  });

  this.data = new Proxy({
    'bug_list': [],
    'preview_id': null
  },
  {
    'get': (obj, prop) => {
      if (prop === 'bug_list') {
        // Return a sorted bug list
        let bugs = {};

        for (let bug of obj[prop]) {
          bugs[bug.id] = bug;
        }

        return [for (row of this.view.grid.data.rows) bugs[row.data.id]];
      }

      return obj[prop];
    },
    'set': (obj, prop, newval) => {
      let oldval = obj[prop];

      if (prop === 'preview_id' && oldval !== newval) {
        FlareTail.util.event.async(() => {
          this.show_preview(oldval, newval);
        });

        BzDeck.bugzfeed.subscribe([newval]);
      }

      obj[prop] = newval;
    }
  });

  window.addEventListener('UI:toggle_star', event => {
    // Thread
    for (let $row of document.querySelectorAll('[id^="home-list-row"]')) {
      $row.querySelector('[data-id="_starred"] [role="checkbox"]')
          .setAttribute('aria-checked', event.detail.ids.has(Number.parseInt($row.dataset.id)));
    }

    // Preview
    document.querySelector('#home-preview-bug [data-field="_starred"]')
            .setAttribute('aria-checked', event.detail.ids.has(this.data.preview_id));
  });

  window.addEventListener('UI:toggle_unread', event => {
    // Thread
    for (let $row of document.querySelectorAll('[id^="home-list-row"]')) {
      $row.setAttribute('data-unread', event.detail.ids.has(Number.parseInt($row.dataset.id)));
    }
  });

  window.addEventListener('bug:updated', event => {
    if (this.data.preview_id === event.detail.bug.id) {
      BzDeck.bug.update(document.querySelector('#home-preview-bug'),
                        event.detail.bug, event.detail.changes);
    }
  });
};

BzDeck.HomePage.prototype.show_preview = function (oldval, newval) {
  let $pane = document.querySelector('#home-preview-pane'),
      $bug = document.querySelector('#home-preview-bug'),
      button = this.view.details_button;

  // Remove the current preview if exists

  if (!newval) {
    $bug.setAttribute('aria-hidden', 'true');
    button.data.disabled = true;

    return;
  }

  BzDeck.model.get_bug_by_id(newval).then(bug => {
    if (!bug) {
      $bug.setAttribute('aria-hidden', 'true');
      button.data.disabled = true;

      return;
    }

    // Fill the content
    BzDeck.bug.fill_data($bug, bug);
    BzDeck.core.toggle_unread(bug.id, false);
    $bug.setAttribute('aria-hidden', 'false');
    button.data.disabled = false;
  });
};

BzDeck.HomePage.prototype.change_layout = function (pref, sort_grid = false) {
  let vertical = FlareTail.util.device.type.startsWith('mobile') || !pref || pref === 'vertical',
      grid = this.view.grid,
      splitter = this.preview_splitter;

  document.documentElement.setAttribute('data-home-layout', vertical ? 'vertical' : 'classic');
  grid.options.adjust_scrollbar = !vertical;
  grid.options.date.simple = vertical;

  // Change the date format on the thread pane
  for (let $time of grid.view.$container.querySelectorAll('time')) {
    $time.textContent = FlareTail.util.datetime.format($time.dateTime, { 'simple': vertical });
    $time.dataset.simple = vertical;
  }

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

BzDeck.HomePage.prototype.change_window_title = function (title) {
  document.title = title;
  document.querySelector('[role="banner"] h1').textContent = title;
  document.querySelector('#tab-home').title = title;
  document.querySelector('#tab-home label').textContent = title;
  document.querySelector('#tabpanel-home h2').textContent = title;
};
