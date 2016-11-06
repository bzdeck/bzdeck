/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Thread View. This constructor is intended to be inherited by each specific thread view.
 * @extends BzDeck.BaseView
 */
BzDeck.ThreadView = class ThreadView extends BzDeck.BaseView {
  /**
   * Get a ThreadView instance. This is necessary to call the constructor of the base Event class.
   * @constructor
   * @param {undefined}
   * @returns {Object} view - New ThreadView instance.
   */
  constructor () {
    super(); // Assign this.id
  }

  /**
   * Called whenever one or more items are selected on the thread. Show the last-selected bug in the relevant Preview
   * Pane or a new tab.
   * @param {CustomEvent} event - Providing an array of selected item IDs.
   * @returns {undefined}
   */
  onselect (event) {
    const ids = event.detail.ids;

    if (ids.length) {
      this.consumer.presenter.data.preview_id = Number.parseInt(ids[ids.length - 1]);
    }
  }

  /**
   * Called whenever the thread is double-clicked. Expand the bug container.
   * @param {MouseEvent} event - Fired dblclick event.
   * @param {String} selector - Defining the target element.
   * @fires ThreadView#OpeningBugRequested
   * @returns {undefined}
   */
  ondblclick (event, selector) {
    const $target = event.originalTarget;

    if ($target.matches(selector)) {
      this.trigger('ThreadView#OpeningBugRequested');
    }
  }

  /**
   * Open a specific bug in a new tab.
   * @param {Number} id - Bug ID to show.
   * @fires AnyView#OpeningBugRequested
   * @returns {undefined}
   */
  open_bug (id) {
    this.trigger('AnyView#OpeningBugRequested', { id, siblings: [...this.consumer.presenter.data.bugs.keys()] });
  }
}

/**
 * Define the Classic Thread View that represents a traditional tabular thread.
 * @extends BzDeck.ThreadView
 */
BzDeck.ClassicThreadView = class ClassicThreadView extends BzDeck.ThreadView {
  /**
   * Get a ClassicThreadView instance.
   * @constructor
   * @param {Object} consumer - View that contains the thread.
   * @param {String} name - Identifier for the thread.
   * @param {HTMLElement} $grid - Element to be activated as the new thread. Should have the grid role.
   * @param {Array} columns - Column list.
   * @param {Object} options - Used for the Grid widget.
   * @returns {Object} view - New ClassicThreadView instance.
   */
  constructor (consumer, name, $grid, columns, options) {
    super(); // Assign this.id

    const default_cols = BzDeck.config.grid.default_columns;
    const field = BzDeck.host.data.config.field;

    const toggle_prop = prop => {
      for (const $item of this.$$grid.view.selected) {
        const _data = this.$$grid.data.rows[$item.sectionRowIndex].data;

        _data[prop] = _data[prop] !== true;
      }
    };

    this.consumer = consumer;
    this.bugs = [];

    this.$$grid = new FlareTail.widgets.Grid($grid, {
      rows: [],
      columns: (columns || default_cols).map(col => {
        col.label = (default_cols.find(__col => __col.id === col.id) || {}).label || field[col.id].description;

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
      B: event => FlareTail.helpers.kbd.dispatch($grid, 'ArrowUp'),
      // Show next bug, an alias of DOWN
      F: event => FlareTail.helpers.kbd.dispatch($grid, 'ArrowDown'),
      // Toggle star
      S: event => toggle_prop('starred'),
    });

    this.subscribe_safe('BugModel#AnnotationUpdated', true);
  }

  /**
   * Update the thread with the specified bugs.
   * @param {Map.<Number, Proxy>} bugs - List of bugs to render.
   * @returns {Promise.<undefined>}
   */
  async update (bugs) {
    this.bugs = bugs;

    const rows = await Promise.all([...bugs.values()].map(async bug => {
      const row = {
        id: `${this.$$grid.view.$container.id}-row-${bug.id}`,
        data: {},
        dataset: {
          unread: bug.unread,
          severity: bug.severity
        }
      };

      await Promise.all(this.$$grid.data.columns.map(async column => {
        const field = column.id;
        let value = bug[field];

        if (!value) {
          value = '';
        } else if (Array.isArray(value)) {
          if (field === 'mentors') { // Array of Person
            const mentors = await Promise.all(bug.mentors.map(name => BzDeck.collections.users.get(name, { name })));

            value = mentors.map(mentor => mentors.name).join(', ');
          } else { // Keywords & Aliases
            value = value.join(', ');
          }
        } else if (typeof value === 'object' && !Array.isArray(value)) { // Person
          const user = await BzDeck.collections.users.get(value.name, { name: value.name });

          value = user.name;
        } else if (field === 'starred') {
          value = bug.starred;
        } else if (field === 'unread') {
          value = value === true;
        } else {
          // Simply use the value in String or Number as-is
        }

        row.data[field] = value;
      }));

      row.data = new Proxy(row.data, {
        set: (obj, prop, value) => {
          if (prop === 'starred') {
            bug.starred = value;
          }

          obj[prop] = value;

          return true;
        }
      });

      return row;
    }));

    this.$$grid.build_body(rows);
  }

  /**
   * Filter the thread with the specified bugs.
   * @param {Map.<Number, Proxy>} bugs - List of bugs to show.
   * @returns {undefined}
   */
  filter (bugs) {
    this.$$grid.filter([...bugs.keys()]);
  }

  /**
   * Called whenever a bug annotation is updated. Update the bug row on the thread.
   * @listens BugModel#AnnotationUpdated
   * @param {Proxy} bug - Changed bug.
   * @param {String} type - Annotation type such as 'starred'.
   * @param {Boolean} value - New annotation value.
   * @returns {undefined}
   */
  on_annotation_updated ({ bug, type, value } = {}) {
    const $row = this.$$grid.view.$body.querySelector(`[role="row"][data-id="${bug.id}"]`);

    if ($row) {
      $row.setAttribute(`data-${type}`, value);

      if (type === 'starred') {
        $row.querySelector('[data-id="starred"] [role="checkbox"]').setAttribute('aria-checked', value);
      }
    }
  }
}

/**
 * Define the Vertical Thread View that represents a modern linear thread.
 * @extends BzDeck.ThreadView
 */
BzDeck.VerticalThreadView = class VerticalThreadView extends BzDeck.ThreadView {
  /**
   * Get a VerticalThreadView instance.
   * @constructor
   * @param {Object} consumer - View that contains the thread.
   * @param {String} name - Identifier for the thread.
   * @param {HTMLElement} $container - Element that contains a child element with the listbox role.
   * @param {Object} options - Extra options for display.
   * @param {Object} options.sort_conditions - Thread sorting conditions.
   * @returns {Object} view - New VerticalThreadView instance.
   */
  constructor (consumer, name, $container, options) {
    super(); // Assign this.id

    this.consumer = consumer;
    this.name = name;
    this.options = options;
    this.bugs = [];
    this.properties = ['id', 'summary', 'extract', 'status', 'resolution', 'last_change_time', 'contributor', 'starred'];

    this.$container = $container;
    this.$header = this.$container.querySelector('header');
    this.$listbox_outer = this.$container.querySelector('.scrollable');
    this.$listbox = this.$container.querySelector('[role="listbox"]');
    this.$$listbox = new FlareTail.widgets.ListBox(this.$listbox, []);
    this.$option = this.get_template('vertical-thread-item');

    new FlareTail.widgets.ScrollBar(this.$listbox_outer);

    this.$$listbox.bind('Selected', event => this.onselect(event));
    this.$$listbox.bind('dblclick', event => this.ondblclick(event, '[role="option"]'));

    this.$$listbox.assign_key_bindings({
      // Show previous bug, an alias of UP
      B: event => FlareTail.helpers.kbd.dispatch(this.$listbox, 'ArrowUp'),
      // Show next bug, an alias of DOWN
      F: event => FlareTail.helpers.kbd.dispatch(this.$listbox, 'ArrowDown'),
      // Toggle star
      S: event => {
        for (const $item of this.$$listbox.view.selected) {
          (async () => {
            const bug = await BzDeck.collections.bugs.get(Number($item.dataset.id));

            bug.starred = $item.querySelector('[itemprop="starred"]').matches('[aria-checked="false"]');
          })();
        }
      },
      // Open the bug in a new tab
      'O|Enter': event => {
        this.open_bug(this.consumer.presenter.data.preview_id);
      },
    });

    this.init_filter();
    this.init_sorter();

    this.on('BugModel#CacheUpdated', data => this.on_bug_updated(data), true);
    this.subscribe_safe('BugModel#AnnotationUpdated', true);

    // Lazy bug loading while scrolling
    this.$listbox_outer.addEventListener('scroll', event => {
      if (this.unrendered_bugs.length && event.target.scrollTop === event.target.scrollTopMax) {
        (async () => this.render(true))();
      }
    });

    // Lazy avatar loading while scrolling
    this.image_loader = new IntersectionObserver(entries => entries.forEach(entry => {
      const $option = entry.target;
      const $avatar = $option.querySelector('[itemprop="contributor"] [itemprop="image"]');
      const $image = new Image();

      if (entry.intersectionRatio > 0 && !$avatar.src) {
        this.image_loader.unobserve($option);
        // Preload the image so that CSS transition works smoothly
        $image.addEventListener('load', event => $avatar.src = $image.src);
        $image.src = $avatar.dataset.src;
      }
    }), { root: this.$listbox_outer });
  }

  /**
   * Initialize the filter function.
   * @param {undefined}
   * @returns {Promise.<undefined>}
   */
  async init_filter () {
    const pref_name = 'ui.home.filter';
    let pref_value = this.options.filter_condition = await BzDeck.prefs.get(pref_name) || 'open';

    this.$filter = this.$header.querySelector('.filter');
    this.$filter.querySelector(`[data-value="${pref_value}"]`).setAttribute('aria-checked', 'true');
    this.$$filter = new FlareTail.widgets.RadioGroup(this.$filter);
    this.filter_radio = {};

    for (const value of ['open', 'closed', 'all']) {
      this.filter_radio[value] = this.$filter.querySelector(`[data-value="${value}"`);
    }

    this.$$filter.bind('Selected', event => {
      pref_value = this.options.filter_condition = event.detail.items[0].dataset.value;
      this.update(this.bugs);
      BzDeck.prefs.set(pref_name, pref_value);
    });
  }

  /**
   * Initialize the sorting function.
   * @param {undefined}
   * @returns {Promise.<undefined>}
   */
  async init_sorter () {
    const pref_name = 'home.list.sort_conditions';
    let pref_value = this.options.sort_conditions = await BzDeck.prefs.get(pref_name) || {};

    this.$sorter = this.$header.querySelector('[data-command="sort"]');
    this.$sorter.setAttribute('aria-pressed', pref_value.order === 'ascending');
    this.$$sorter = new FlareTail.widgets.Button(this.$sorter);

    this.$$sorter.bind('Pressed', event => {
      const order = event.detail.pressed ? 'ascending' : 'descending';

      pref_value = this.options.sort_conditions = { key: 'last_change_time', type: 'time', order };
      this.update(this.bugs);
      BzDeck.prefs.set(pref_name, pref_value);
    });
  }

  /**
   * Update the thread with the specified bugs.
   * @param {Map.<Number, Proxy>} bugs - List of bugs to render.
   * @returns {undefined}
   */
  update (bugs) {
    let _bugs = [...bugs.values()];
    const filter_condition = this.options.filter_condition || 'open';
    const sort_conditions = this.options.sort_conditions;
    const statuses = BzDeck.host.data.config.field.status;
    const filtered_bugs = {
      open: _bugs.filter(bug => statuses.open.includes(bug.status)),
      closed: _bugs.filter(bug => statuses.closed.includes(bug.status)),
    };

    // Update the filter radio button labels
    this.filter_radio.open.textContent = `Open (${filtered_bugs.open.length})`;
    this.filter_radio.closed.textContent = `Closed (${filtered_bugs.closed.length})`;

    // Filter & sort bugs
    _bugs = filter_condition === 'all' ? _bugs : filtered_bugs[filter_condition];
    _bugs = sort_conditions ? FlareTail.helpers.array.sort(_bugs, sort_conditions) : _bugs;

    this.bugs = bugs;
    this.unrendered_bugs = _bugs;

    (async () => {
      await this.render();
      this.$listbox.dispatchEvent(new CustomEvent('Updated'));
      this.$listbox_outer.scrollTop = 0;
    })();
  }

  /**
   * Render thread items using a custom template.
   * @param {Boolean} [addition=false] - Whether the bugs will be appended to the thread.
   * @returns {Promise.<undefined>}
   */
  async render (addition = false) {
    const bugs = this.unrendered_bugs.splice(0, 50);
    const unloaded_bugs = bugs.filter(bug => !bug.comments);
    const $fragment = new DocumentFragment();

    const contributors = await Promise.all(bugs.map(bug => {
      // TODO: combine primary participants' avatars/initials (#124)
      const contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator;

      return BzDeck.collections.users.get(contributor, { name: contributor });
    }));

    this.$listbox.setAttribute('aria-busy', 'true');

    bugs.forEach((bug, index) => {
      // Reuse items whenever possible
      const option_id = `${this.name}-vertical-thread-bug-${bug.id}`;
      let $option = document.getElementById(option_id);

      if (!$option) {
        const props = {};

        for (const key of this.properties) {
          props[key] = key === 'contributor' ? contributors[index].properties : bug[key];
        }

        $option = this.fill(this.$option.cloneNode(true), props, {
          id: option_id,
          'data-id': bug.id,
          'data-unread': !!bug.unread,
        });
      }

      const $avatar = $option.querySelector('[itemprop="contributor"] [itemprop="image"]');

      // Lazy avatar loading while scrolling
      if (!$avatar.dataset.src) {
        $avatar.dataset.src = $avatar.src;
        $avatar.removeAttribute('src');
        this.image_loader.observe($option);
      }

      $fragment.appendChild($option);
    });

    if (!addition) {
      this.$listbox.innerHTML = '';
    }

    this.$listbox.appendChild($fragment);
    this.$listbox.removeAttribute('aria-busy');
    this.$listbox.dispatchEvent(new CustomEvent('Rendered'));
    this.$$listbox.update_members();

    // Fetch unloaded bug details
    if (unloaded_bugs.length) {
      BzDeck.collections.bugs.fetch(unloaded_bugs.map(bug => bug.id), false, true);
    }
  }

  /**
   * Called whenever a bug's cached is updated. Update the view if the bug ID matches.
   * @listens BugModel#CacheUpdated
   * @param {Number} bug_id - Changed bug's ID.
   * @returns {Promise.<undefined>}
   */
  async on_bug_updated ({ bug_id } = {}) {
    const $option = this.$listbox.querySelector(`[role="option"][data-id="${bug_id}"]`);

    if (!$option) {
      return;
    }

    const bug = await BzDeck.collections.bugs.get(bug_id);
    const _contributor = bug.comments ? bug.comments[bug.comments.length - 1].creator : bug.creator;
    const contributor = await BzDeck.collections.users.get(_contributor, { name: _contributor });
    const props = {};

    for (const key of this.properties) {
      props[key] = key === 'contributor' ? contributor.properties : bug[key];
    }

    this.fill($option, props);
  }

  /**
   * Called whenever a bug annotation is updated. Update the bug item on the thread.
   * @listens BugModel#AnnotationUpdated
   * @param {Proxy} bug - Changed bug.
   * @param {String} type - Annotation type such as 'starred' or 'unread'.
   * @param {Boolean} value - New annotation value.
   * @returns {undefined}
   */
  on_annotation_updated ({ bug, type, value } = {}) {
    const $option = this.$listbox.querySelector(`[role="option"][data-id="${bug.id}"]`);

    if ($option) {
      $option.setAttribute(`data-${type}`, value);

      if (type === 'starred') {
        const $checkbox = $option.querySelector('[itemprop="starred"]');

        $checkbox.setAttribute('aria-checked', value);
        $checkbox.setAttribute('content', value);
      }
    }
  }
}
