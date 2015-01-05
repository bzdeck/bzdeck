/**
 * BzDeck Thread Panes View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.Thread = function ThreadView () {};

BzDeck.views.Thread.prototype.onselect = function (event) {
  let ids = event.detail.ids;

  if (ids.length) {
    // Show the bug in the preview pane or a new tab
    this.consumer.data.preview_id = Number.parseInt(ids[ids.length - 1]);
  }
};

BzDeck.views.Thread.prototype.ondblclick = function (event, selector) {
  let $target = event.originalTarget;

  if ($target.matches(selector)) {
    // Open Bug in New Tab
    BzDeck.router.navigate('/bug/' + $target.dataset.id, { 'ids': [for (bug of this.consumer.data.bugs) bug.id] });
  }
};

/* ------------------------------------------------------------------------------------------------------------------
 * Classic Thread
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.ClassicThread = function ClassicThreadView (consumer, name, $grid, options) {
  let prefs = BzDeck.models.data.prefs,
      default_cols = BzDeck.config.grid.default_columns,
      columns = prefs[`${name}.list.columns`] || default_cols,
      field = BzDeck.models.data.server.config.field;

  let toggle_prop = prop => {
    for (let $item of this.$$grid.view.selected) {
      let _data = this.$$grid.data.rows[$item.sectionRowIndex].data;

      _data[prop] = _data[prop] !== true;
    }
  };

  this.consumer = consumer;
  this.bugs = [];

  this.$$grid = new FlareTail.widget.Grid($grid, {
    'rows': [],
    'columns': columns.map(col => {
      // Add labels
      col.label = [for (_col of default_cols) if (_col.id === col.id) _col.label][0] ||
                  field[col.id].description;

      return col;
    })
  }, options);

  this.$$grid.bind('Selected', event => this.onselect(event));
  this.$$grid.bind('dblclick', event => this.ondblclick(event, '[role="row"]'));
  this.$$grid.bind('Sorted', event => prefs[`${name}.list.sort_conditions`] = event.detail.conditions);

  this.$$grid.bind('ColumnModified', event => {
    prefs[`${name}.list.columns`] = event.detail.columns.map(col => ({
      'id': col.id,
      'type': col.type || 'string',
      'hidden': col.hidden || false
    }));
  });

  this.$$grid.assign_key_bindings({
    // Show previous bug, an alias of UP
    'B': event => FlareTail.util.kbd.dispatch($grid, event.DOM_VK_UP),
    // Show next bug, an alias of DOWN
    'F': event => FlareTail.util.kbd.dispatch($grid, event.DOM_VK_DOWN),
    // Toggle read
    'M': event => toggle_prop('_unread'),
    // Toggle star
    'S': event => toggle_prop('_starred'),
  });

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

BzDeck.views.ClassicThread.prototype = Object.create(BzDeck.views.Thread.prototype);

BzDeck.views.ClassicThread.prototype.constructor = BzDeck.views.ClassicThread;

BzDeck.views.ClassicThread.prototype.update = function (bugs) {
  this.bugs = bugs;

  this.$$grid.build_body(bugs.map(bug => {
    let row = {
      'id': `${this.$$grid.view.$container.id}-row-${bug.id}`,
      'data': {},
      'dataset': {
        'unread': bug._unread === true,
        'severity': bug.severity
      }
    };

    for (let column of this.$$grid.data.columns) {
      let field = column.id,
          value = bug[field];

      if (!value) {
        value = '';
      }

      if (Array.isArray(value)) {
        if (field === 'mentors') { // Array of Person
          value = [for (person of bug['mentors_detail']) BzDeck.controllers.users.get_name(person)].join(', ');
        } else { // Keywords
          value = value.join(', ');
        }
      }

      if (typeof value === 'object' && !Array.isArray(value)) { // Person
        value = BzDeck.controllers.users.get_name(bug[`${field}_detail`]);
      }

      if (field === '_starred') {
        value = BzDeck.controllers.bugs.is_starred(bug);
      }

      if (field === '_unread') {
        value = value === true;
      }

      row.data[field] = value;
    }

    row.data = new Proxy(row.data, {
      'set': (obj, prop, value) => {
        if (prop === '_starred') {
          BzDeck.controllers.bugs.toggle_star(obj.id, value);
        }

        if (prop === '_unread') {
          BzDeck.controllers.bugs.toggle_unread(obj.id, value);

          let row = [for (row of this.$$grid.data.rows) if (row.data.id === obj.id) row][0];

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

BzDeck.views.ClassicThread.prototype.filter = function (bugs) {
  this.$$grid.filter([for (bug of bugs) bug.id]);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Vertical Thread
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.VerticalThread = function VerticalThreadView (consumer, name, $outer, options) {
  let mobile = FlareTail.util.ua.device.mobile;

  this.consumer = consumer;
  this.name = name;
  this.options = options;

  this.$outer = $outer;
  this.$listbox = $outer.querySelector('[role="listbox"]');
  this.$$listbox = new FlareTail.widget.ListBox(this.$listbox, []);
  this.$option = FlareTail.util.content.get_fragment('vertical-thread-item').firstElementChild;
  this.$$scrollbar = new FlareTail.widget.ScrollBar($outer);
  this.$scrollable_area = mobile ? $outer.querySelector('.scrollable-area-content') : $outer;

  this.$$listbox.bind('Selected', event => this.onselect(event));
  this.$$listbox.bind('dblclick', event => this.ondblclick(event, '[role="option"]'));

  this.$$listbox.assign_key_bindings({
    // Show previous bug, an alias of UP
    'B': event => FlareTail.util.kbd.dispatch(this.$listbox, event.DOM_VK_UP),
    // Show next bug, an alias of DOWN
    'F': event => FlareTail.util.kbd.dispatch(this.$listbox, event.DOM_VK_DOWN),
    // Toggle read
    'M': event => {
      for (let $item of this.$$listbox.view.selected) {
        BzDeck.controllers.bugs.toggle_unread(Number($item.dataset.id), $item.dataset.unread === 'false');
      }
    },
    // Toggle star
    'S': event => {
      for (let $item of this.$$listbox.view.selected) {
        BzDeck.controllers.bugs.toggle_star(Number($item.dataset.id),
            $item.querySelector('[data-field="_starred"]').getAttribute('aria-checked') === 'false');
      }
    },
    // Open the bug in a new tab
    'O|RETURN': event => {
      BzDeck.router.navigate('/bug/' + this.consumer.data.preview_id,
                             { 'ids': [for (bug of this.consumer.data.bugs) bug.id] });
    },
  });

  window.addEventListener('Bug:StarToggled', event => {
    let bug = event.detail.bug,
        $option = this.$listbox.querySelector(`[role="option"][data-id="${bug.id}"]`);

    if ($option) {
      $option.querySelector('[data-field="_starred"]').setAttribute('aria-checked', !!bug._starred_comments.size);
    }
  });

  window.addEventListener('Bug:UnreadToggled', event => {
    let bug = event.detail.bug,
        $option = this.$listbox.querySelector(`[role="option"][data-id="${bug.id}"]`);

    if ($option) {
      $option.setAttribute('data-unread', !!bug._unread);
    }
  });

  // Lazy loading while scrolling
  this.$scrollable_area.addEventListener('scroll', event => {
    if (this.unrendered_bugs.length && event.target.scrollTop === event.target.scrollTopMax) {
      FlareTail.util.event.async(() => this.render());
    }
  });
};

BzDeck.views.VerticalThread.prototype = Object.create(BzDeck.views.Thread.prototype);

BzDeck.views.VerticalThread.prototype.constructor = BzDeck.views.VerticalThread;

BzDeck.views.VerticalThread.prototype.update = function (bugs) {
  let cond = this.options.sort_conditions;

  if (cond) {
    FlareTail.util.array.sort(bugs, cond);
  }

  this.unrendered_bugs = bugs;
  this.$outer.setAttribute('aria-busy', 'true');
  this.$listbox.innerHTML = '';

  FlareTail.util.event.async(() => {
    this.render();
    this.$listbox.dispatchEvent(new CustomEvent('Updated'));
    this.$outer.removeAttribute('aria-busy');
    this.$scrollable_area.scrollTop = 0;
  });
};

BzDeck.views.VerticalThread.prototype.render = function () {
  let $fragment = new DocumentFragment();

  for (let bug of this.unrendered_bugs.splice(0, 50)) {
    let $option = $fragment.appendChild(FlareTail.util.content.render(this.$option.cloneNode(true), {
      'id': bug.id,
      'name': bug.summary,
      'dateModified': bug.last_change_time,
    }, {
      'id': `${this.name}-vertical-thread-bug-${bug.id}`,
      'data-id': bug.id,
      'data-unread': !!bug._unread,
      'aria-checked': BzDeck.controllers.bugs.is_starred(bug)
    }));

    BzDeck.views.core.set_avatar(
        bug.comments ? BzDeck.controllers.bugs.find_person(bug, bug.comments[bug.comments.length - 1].creator)
                     : bug.creator_detail, $option.querySelector('img'));
  }

  this.$listbox.appendChild($fragment);
  this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$listbox.update_members();
  this.$$scrollbar.set_height();
};
