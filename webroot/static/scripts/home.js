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

    splitter.bind('Resized', event => {
      let position = event.detail.position;

      if (position) {
        prefs[prefix + splitter.data.orientation] = position;
      }

      this.reposition_sticky_comment_header();
    });
  }

  // Star on the header
  let $star_checkbox = document.querySelector('#home-preview-bug header [data-field="_starred"]');
  (new FTw.Checkbox($star_checkbox)).bind('Toggled', event => {
    BzDeck.core.toggle_star(this.data.preview_id, event.detail.checked);
  });

  // Custom scrollbar (info)
  new FTw.ScrollBar(document.querySelector('#home-preview-bug-info'));

  // Custom scrollbar (timeline)
  let scrollbar = new FTw.ScrollBar(document.querySelector('#home-preview-bug-timeline'));
  scrollbar.onkeydown_extend = BzDeck.global.handle_timeline_keydown.bind(scrollbar);
  scrollbar.onscroll_extend = BzDeck.global.handle_timeline_scroll.bind(scrollbar);

  this.view = {};

  let prefs = BzDeck.data.prefs,
      vertical = mobile_mql.matches || prefs['ui.home.layout'] === 'vertical',
      columns = prefs['home.list.columns'] || BzDeck.options.grid.default_columns,
      field = BzDeck.data.bugzilla_config.field;

  let grid = this.view.grid = new FlareTail.widget.Grid(document.querySelector('#home-list'), {
    rows: [],
    columns: columns.map(col => {
      // Add labels
      col.label = {
        'id': 'ID', // Instead of Bug ID; l10n
        '_starred': 'Starred', // l10n
        '_unread': 'Unread' // l10n
      }[col.id] || field[col.id].description;

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

  mobile_mql.addListener(mql => {
    this.change_layout(prefs['ui.home.layout'], true);
  });

  grid.bind('Sorted', event => {
    prefs['home.list.sort_conditions'] = event.detail.conditions;
  });

  grid.bind('ColumnModified', event => {
    prefs['home.list.columns'] = event.detail.columns.map(col => {
      return {
        id: col.id,
        type: col.type || 'string',
        hidden: col.hidden || false
      };
    });
  });

  grid.bind('Selected', event => {
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
  });

  grid.bind('Rebuilt', event => {
    // Select the first bug on the list automatically when a folder is opened
    // TODO: Remember the last selected bug for each folder
    if (grid.data.rows.length && !window.matchMedia('(max-width: 799px)').matches) {
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
  let button = this.view.details_button
             = new FlareTail.widget.Button(document.querySelector('#home-button-show-details'));

  button.bind('Pressed', event => {
    BzDeck.detailspage = new BzDeck.DetailsPage(this.data.preview_id, this.data.bug_list);
  });

  this.data = new Proxy({
    bug_list: [],
    preview_id: null
  },
  {
    get: (obj, prop) => {
      if (prop === 'bug_list') {
        // Return a sorted bug list
        let bugs = {};

        for (let bug of obj[prop]) {
          bugs[bug.id] = bug;
        }

        return [bugs[row.data.id] for (row of this.view.grid.data.rows)];
      }

      return obj[prop];
    },
    set: (obj, prop, newval) => {
      let oldval = obj[prop];

      if (prop === 'preview_id') {
        FlareTail.util.event.async(() => {
          this.show_preview(oldval, newval);
        });
      }

      obj[prop] = newval;
    }
  });

  window.addEventListener('resize', event => {
    this.reposition_sticky_comment_header();
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

BzDeck.HomePage.prototype.change_layout = function (pref, sort_grid = false) {
  let vertical = FlareTail.util.device.mobile.mql.matches || !pref || pref === 'vertical',
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

  this.reposition_sticky_comment_header();
};

BzDeck.HomePage.prototype.reposition_sticky_comment_header = function () {
  let $timeline = document.querySelector('#home-preview-bug-timeline'),
      $header = $timeline.querySelector('header.sticky'),
      top = $timeline.getBoundingClientRect().top;

  if ($header) {
    top > 0 ? $header.style.top = top + 'px' : $header.classList.remove('sticky');
  }
};
