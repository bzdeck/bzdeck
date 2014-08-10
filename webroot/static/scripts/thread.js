/**
 * BzDeck Thread Panes
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

/* ----------------------------------------------------------------------------------------------
 * Thread View
 * ---------------------------------------------------------------------------------------------- */

BzDeck.Thread = function Thread (consumer, name, $grid, options) {
  let prefs = BzDeck.model.data.prefs,
      mobile = FlareTail.util.device.type.startsWith('mobile'),
      default_cols = BzDeck.config.grid.default_columns,
      columns = prefs[`${name}.list.columns`] || default_cols,
      field = BzDeck.model.data.server.config.field;

  this.bugs = [];

  this.grid = new FlareTail.widget.Grid($grid, {
    'rows': [],
    'columns': columns.map(col => {
      // Add labels
      col.label = [for (_col of default_cols) if (_col.id === col.id) _col.label][0] ||
                  field[col.id].description;

      return col;
    })
  }, options);

  this.grid.bind('Sorted', event => {
    prefs[`${name}.list.sort_conditions`] = event.detail.conditions;
  });

  this.grid.bind('ColumnModified', event => {
    prefs[`${name}.list.columns`] = event.detail.columns.map(col => {
      return {
        'id': col.id,
        'type': col.type || 'string',
        'hidden': col.hidden || false
      };
    });
  });

  this.grid.bind('Selected', event => {
    let ids = event.detail.ids;

    if (ids.length) {
      // Show Bug in Preview Pane
      let id = consumer.data.preview_id = Number.parseInt(ids[ids.length - 1]);

      // Mobile compact layout
      if (mobile) {
        BzDeck.DetailsPage.open(id, this.bugs);
      }
    }
  });

  this.grid.bind('dblclick', event => {
    let $target = event.originalTarget;

    if ($target.matches('[role="row"]')) {
      // Open Bug in New Tab
      BzDeck.DetailsPage.open(Number.parseInt($target.dataset.id), this.bugs);
    }
  });

  this.grid.bind('keydown', event => {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey,
        data = this.grid.data,
        view = this.grid.view,
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

  window.addEventListener('Bug:StarToggled', event => {
    let bug = event.detail.bug,
        $row = $grid.querySelector(`[role="row"][data-id="${bug.id}"]`);

    if ($row) {
      $row.querySelector('[data-id="_starred"] [role="checkbox"]')
          .setAttribute('aria-checked', !!bug._starred_comments.size);
    }
  });

  window.addEventListener('Bug:UnreadToggled', event => {
    let bug = event.detail.bug,
        $row = $grid.querySelector(`[role="row"][data-id="${bug.id}"]`);

    if ($row) {
      $row.setAttribute('data-unread', !!bug._unread);
    }
  });
};

BzDeck.Thread.prototype.update = function (bugs) {
  this.bugs = bugs;

  this.grid.build_body(bugs.map(bug => {
    let row = {
      'id': `${this.grid.view.$container.id}-row-${bug.id}`,
      'data': {},
      'dataset': {
        'unread': bug._unread === true,
        'severity': bug.severity
      }
    };

    for (let column of this.grid.data.columns) {
      let field = column.id,
          value = bug[field];

      if (!value) {
        value = '';
      }

      if (Array.isArray(value)) {
        if (field === 'mentors') { // Array of Person
          value = [for (person of bug['mentors_detail']) BzDeck.core.get_name(person)].join(', ');
        } else { // Keywords
          value = value.join(', ');
        }
      }

      if (typeof value === 'object' && !Array.isArray(value)) { // Person
        value = BzDeck.core.get_name(bug[`${field}_detail`]);
      }

      if (field === '_starred') {
        value = BzDeck.model.bug_is_starred(bug);
      }

      if (field === '_unread') {
        value = value === true;
      }

      row.data[field] = value;
    }

    row.data = new Proxy(row.data, {
      'set': (obj, prop, value) => {
        if (prop === '_starred') {
          BzDeck.core.toggle_star(obj.id, value);
        }

        if (prop === '_unread') {
          BzDeck.core.toggle_unread(obj.id, value);

          let row = [for (row of this.grid.data.rows) if (row.data.id === obj.id) row][0];

          if (row && row.$element) {
            row.$element.dataset.unread = value;
          }
        }

        obj[prop] = value;
      }
    });

    return row;
  }));
};
