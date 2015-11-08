/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Thread = function ThreadView () {};

BzDeck.views.Thread.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Thread.prototype.constructor = BzDeck.views.Thread;

BzDeck.views.Thread.prototype.onselect = function (event) {
  let ids = event.detail.ids;

  if (ids.length) {
    // Show the bug in the preview pane or a new tab
    this.consumer.controller.data.preview_id = Number.parseInt(ids[ids.length - 1]);
  }
};

BzDeck.views.Thread.prototype.ondblclick = function (event, selector) {
  let $target = event.originalTarget;

  if ($target.matches(selector)) {
    // Open Bug in New Tab
    BzDeck.router.navigate('/bug/' + $target.dataset.id, { ids: [...this.consumer.controller.data.bugs.keys()] });
  }
};

/* ------------------------------------------------------------------------------------------------------------------
 * Classic Thread
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.ClassicThread = function ClassicThreadView (consumer, name, $grid, options) {
  let default_cols = BzDeck.config.grid.default_columns,
      columns = BzDeck.prefs.get(`${name}.list.columns`) || default_cols,
      field = BzDeck.models.server.data.config.field;

  let toggle_prop = prop => {
    for (let $item of this.$$grid.view.selected) {
      let _data = this.$$grid.data.rows[$item.sectionRowIndex].data;

      _data[prop] = _data[prop] !== true;
    }
  };

  this.consumer = consumer;
  this.bugs = [];

  this.$$grid = new this.widgets.Grid($grid, {
    rows: [],
    columns: columns.map(col => {
      let _col = default_cols.find(__col => __col.id === col.id);

      // Add labels
      col.label = _col ? _col.label : field[col.id].description;

      return col;
    })
  }, options);

  this.$$grid.bind('Selected', event => this.onselect(event));
  this.$$grid.bind('dblclick', event => this.ondblclick(event, '[role="row"]'));
  this.$$grid.bind('Sorted', event => BzDeck.prefs.set(`${name}.list.sort_conditions`, event.detail.conditions));

  this.$$grid.bind('ColumnModified', event => {
    BzDeck.prefs.set(`${name}.list.columns`, event.detail.columns.map(col => ({
      id: col.id,
      type: col.type || 'string',
      hidden: col.hidden || false
    })));
  });

  this.$$grid.assign_key_bindings({
    // Show previous bug, an alias of UP
    B: event => this.helpers.kbd.dispatch($grid, 'ArrowUp'),
    // Show next bug, an alias of DOWN
    F: event => this.helpers.kbd.dispatch($grid, 'ArrowDown'),
    // Toggle read
    M: event => toggle_prop('unread'),
    // Toggle star
    S: event => toggle_prop('starred'),
  });

  this.on('BugModel:AnnotationUpdated', data => {
    let $row = $grid.querySelector(`[role="row"][data-id="${data.bug.id}"]`);

    if ($row) {
      $row.setAttribute(`data-${data.type}`, data.value);

      if (data.type === 'starred') {
        $row.querySelector('[data-id="starred"] [role="checkbox"]').setAttribute('aria-checked', data.value);
      }
    }
  }, true);
};

BzDeck.views.ClassicThread.prototype = Object.create(BzDeck.views.Thread.prototype);
BzDeck.views.ClassicThread.prototype.constructor = BzDeck.views.ClassicThread;

BzDeck.views.ClassicThread.prototype.update = function (bugs) {
  this.bugs = bugs;

  this.$$grid.build_body([...bugs.values()].map(bug => {
    let row = {
      id: `${this.$$grid.view.$container.id}-row-${bug.id}`,
      data: {},
      dataset: {
        unread: bug.unread === true,
        severity: bug.severity
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
          value = bug.mentors.map(name => BzDeck.collections.users.get(name, { name }).name).join(', ');
        } else { // Keywords
          value = value.join(', ');
        }
      }

      if (typeof value === 'object' && !Array.isArray(value)) { // Person
        value = BzDeck.collections.users.get(value.name, { name: value.name }).name;
      }

      if (field === 'starred') {
        value = bug.starred;
      }

      if (field === 'unread') {
        value = value === true;
      }

      row.data[field] = value;
    }

    row.data = new Proxy(row.data, {
      set: (obj, prop, value) => {
        if (prop === 'starred') {
          bug.starred = value;
        }

        if (prop === 'unread') {
          bug.unread = value;

          let row = this.$$grid.data.rows.find(row => row.data.id === obj.id);

          if (row && row.$element) {
            row.$element.dataset.unread = value;
          }
        }

        obj[prop] = value;

        return true;
      }
    });

    return row;
  }));
};

BzDeck.views.ClassicThread.prototype.filter = function (bugs) {
  this.$$grid.filter([...bugs.keys()]);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Vertical Thread
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.VerticalThread = function VerticalThreadView (consumer, name, $outer, options) {
  let mobile = this.helpers.env.device.mobile;

  this.consumer = consumer;
  this.name = name;
  this.options = options;

  this.$outer = $outer;
  this.$listbox = $outer.querySelector('[role="listbox"]');
  this.$$listbox = new this.widgets.ListBox(this.$listbox, []);
  this.$option = this.get_template('vertical-thread-item');
  this.$$scrollbar = new this.widgets.ScrollBar($outer);
  this.$scrollable_area = mobile ? $outer.querySelector('.scrollable-area-content') : $outer;

  this.$$listbox.bind('dblclick', event => this.ondblclick(event, '[role="option"]'));
  this.$$listbox.bind('Selected', event => {
    if (!event.detail.ids.length) {
      return;
    }

    this.onselect(event);

    // Create a marquee effect when the bug title is overflowing
    for (let $option of event.detail.items) {
      let $name = $option.querySelector('[itemprop="summary"]'),
          width = $name.scrollWidth;

      if (width > $name.clientWidth) {
        let name = `${$option.id}-name-marquee`,
            sheet = document.styleSheets[1];

        // Delete the rule first in case of any width changes
        for (let index in sheet.cssRules) {
          let rule = sheet.cssRules[index];

          if (rule.type === 7 && rule.name === name) {
            sheet.deleteRule(index);
            break;
          }
        }

        sheet.insertRule(`@keyframes ${name} { 0%, 10% { text-indent: 0 } 100% { text-indent: -${width+10}px } }`, 0);
        $name.style.setProperty('animation-name', name);
        $name.style.setProperty('animation-duration', `${width/25}s`);
      }
    }
  });

  this.$$listbox.assign_key_bindings({
    // Show previous bug, an alias of UP
    B: event => this.helpers.kbd.dispatch(this.$listbox, 'ArrowUp'),
    // Show next bug, an alias of DOWN
    F: event => this.helpers.kbd.dispatch(this.$listbox, 'ArrowDown'),
    // Toggle read
    M: event => {
      for (let $item of this.$$listbox.view.selected) {
        BzDeck.collections.bugs.get(Number($item.dataset.id)).unread = $item.dataset.unread === 'false';
      }
    },
    // Toggle star
    S: event => {
      for (let $item of this.$$listbox.view.selected) {
        BzDeck.collections.bugs.get(Number($item.dataset.id))
                          .starred = $item.querySelector('[itemprop="starred"]').matches('[aria-checked="false"]');
      }
    },
    // Open the bug in a new tab
    'O|Enter': event => {
      BzDeck.router.navigate('/bug/' + this.consumer.controller.data.preview_id,
                             { ids: [...this.consumer.controller.data.bugs.keys()] });
    },
  });

  this.on('BugModel:AnnotationUpdated', data => {
    let $option = this.$listbox.querySelector(`[role="option"][data-id="${data.bug.id}"]`);

    if ($option) {
      $option.setAttribute(`data-${data.type}`, data.value);

      if (data.type === 'starred') {
        let $checkbox = $option.querySelector('[itemprop="starred"]');

        $checkbox.setAttribute('aria-checked', data.value);
        $checkbox.setAttribute('content', data.value);
      }
    }
  }, true);

  // Lazy loading while scrolling
  this.$scrollable_area.addEventListener('scroll', event => {
    if (this.unrendered_bugs.length && event.target.scrollTop === event.target.scrollTopMax) {
      this.helpers.event.async(() => this.render());
    }
  });
};

BzDeck.views.VerticalThread.prototype = Object.create(BzDeck.views.Thread.prototype);
BzDeck.views.VerticalThread.prototype.constructor = BzDeck.views.VerticalThread;

BzDeck.views.VerticalThread.prototype.update = function (bugs) {
  let cond = this.options.sort_conditions;

  this.unrendered_bugs = cond ? this.helpers.array.sort([...bugs.values()], cond) : [...bugs.values()];
  this.$outer.setAttribute('aria-busy', 'true');
  this.$listbox.innerHTML = '';

  this.helpers.event.async(() => {
    this.render();
    this.$listbox.dispatchEvent(new CustomEvent('Updated'));
    this.$outer.removeAttribute('aria-busy');
    this.$scrollable_area.scrollTop = 0;
  });
};

BzDeck.views.VerticalThread.prototype.render = function () {
  let $fragment = new DocumentFragment();

  for (let bug of this.unrendered_bugs.splice(0, 50)) {
    // TODO: combine primary participants' avatars/initials (#124)
    let contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator;

    let $option = $fragment.appendChild(this.fill(this.$option.cloneNode(true), {
      id: bug.id,
      summary: bug.summary,
      last_change_time: bug.last_change_time,
      contributor: BzDeck.collections.users.get(contributor, { name: contributor }).properties,
      starred: bug.starred,
    }, {
      id: `${this.name}-vertical-thread-bug-${bug.id}`,
      'data-id': bug.id,
      'data-unread': !!bug.unread,
    }));
  }

  this.$listbox.appendChild($fragment);
  this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
  this.$$listbox.update_members();
  this.$$scrollbar.set_height();
};
