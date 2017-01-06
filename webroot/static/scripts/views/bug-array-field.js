/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the BugArrayFieldView that represents a common array-type field on the Bug Details page.
 * @extends BzDeck.BaseView
 */
BzDeck.BugArrayFieldView = class BugArrayFieldView extends BzDeck.BaseView {
  /**
   * Get a BugArrayFieldView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Proxy} bug - BugModel instance.
   * @param {HTMLElement} $section - Outer <section> element of the field.
   * @returns {BugArrayFieldView} New BugArrayFieldView instance.
   */
  constructor (id, bug, $section) {
    super(id); // Assign this.id

    this.bug = bug;
    this.field = $section.dataset.field;
    this.$section = $section;
    this.$list = $section.querySelector('.list');

    // Subscribe to events
    this.subscribe('BugModel#FieldValueAdded', true);
    this.subscribe('BugModel#FieldValueRemoved', true);
  }

  /**
   * Activate the button and combobox widgets.
   */
  activate () {
    for (const $button of this.$list.querySelectorAll('[role="button"]')) {
      this.activate_button($button);
    }

    this.activate_combobox(this.$section.querySelector('[role="combobox"]'));
  }

  /**
   * Show a menu when each button is clicked.
   * @param {HTMLElement} $button - A button.
   * @fires BugView#RemoveFieldValue
   */
  activate_button ($button) {
    const value = $button.textContent;
    const $$button = new FlareTail.widgets.Button($button);
    let $$menu;

    $button.dataset.value = value;

    $$button.bind('Pressed', event => {
      if (!$$menu) {
        $$menu = $$button.view.$$menu = this.build_menu();

        const $menu = $$menu.view.$container;

        $button.appendChild($menu);
        $button.setAttribute('aria-haspopup', 'menu');
        $button.setAttribute('aria-owns', $menu.id);

        $$menu.bind('MenuItemSelected', event => {
          const func = {
            remove: () => this.trigger('BugView#RemoveFieldValue', { field: this.field, value }),
          }[event.detail.command]();
        });
      }

      if (event.detail.pressed) {
        $$menu.open();
      } else {
        $$menu.close();
      }
    });
  }

  /**
   * Create a menu for a button which allows the value to be removed.
   * @returns {Menu} Menu widget.
   */
  build_menu () {
    const $menu = document.createElement('div');

    $menu.id = FlareTail.util.Misc.hash(7, true);
    $menu.setAttribute('role', 'menu');
    $menu.setAttribute('aria-expanded', 'false');

    return new FlareTail.widgets.Menu($menu, [
      { id: `${$menu.id}-remove`, label: 'Remove', data: { command: 'remove' }},
    ]);
  }

  /**
   * Allow adding new values with a combobox.
   * @param {HTMLElement} $combobox - A combobox element.
   * @fires BugView#AddFieldValue
   */
  activate_combobox ($combobox) {
    const build_dropdown = async input => {
      this.$$combobox.build_dropdown((await this.filter_values(input)).map(value => ({ value })));
    };

    $combobox.setAttribute('aria-disabled', !BzDeck.account.permissions.includes('editbugs'));

    this.$$combobox = new FlareTail.widgets.ComboBox($combobox);
    build_dropdown();

    this.$$combobox.on('Input', async event => {
      const input = event.detail.value.trim().toLowerCase();

      await build_dropdown(input);
      this.$$combobox.show_dropdown();
    });

    this.$$combobox.on('Change', event => {
      this.trigger('BugView#AddFieldValue', { field: this.field, value: event.detail.value }),
      this.$$combobox.clear_input();
    });
  }

  /**
   * Filter all available values for the drop down list. Should be implemented in the subclasses.
   * @abstract
   * @param {String} [input] - User-provided search term.
   * @returns {Promise.<Array.<String>>} - Filtered values.
   */
  async filter_values (input = '') {
    return [];
  }

  /**
   * Called whenever the user added a value to any multiple-value field. Add a new button for the new value.
   * @listens BugModel#FieldValueAdded
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} field - Field name.
   * @param {String|Number} value - Field value.
   */
  on_field_value_added ({ bug_id, field, value } = {}) {
    if (bug_id !== this.bug.id || field !== this.field) {
      return;
    }

    let $button = this.get_button(value);

    if (!$button) {
      $button = this.$button_template.cloneNode(true);
      $button.textContent = value;
      this.$list.appendChild($button);
      this.activate_button($button);
    }
  }

  /**
   * Called whenever the user removed a value from any multiple-value field. Remove the corresponding button.
   * @listens BugModel#FieldValueRemoved
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} field - Field name.
   * @param {String|Number} value - Field value.
   */
  on_field_value_removed ({ bug_id, field, value } = {}) {
    if (bug_id !== this.bug.id || field !== this.field) {
      return;
    }

    const $button = this.get_button(value);

    if ($button) {
      $button.remove();
    }
  }

  /**
   * Find a button element by value.
   * @param {String} value - Button's value/label.
   * @returns {HTMLElement} Button.
   */
  get_button (value) {
    return this.$list.querySelector(`[role="button"][data-value="${value}"]`);
  }
}

/**
 * Define the BugKeywordsView that represents the editable Keywords field on the Bug Details page.
 * @extends BzDeck.BugArrayFieldView
 */
BzDeck.BugKeywordsView = class BugKeywordsView extends BzDeck.BugArrayFieldView {
  /**
   * Get a BugKeywordsView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {Proxy} bug - BugModel instance.
   * @param {HTMLElement} $section - Outer <section> element of the field.
   * @returns {BugKeywordsView} New BugKeywordsView instance.
   */
  constructor (id, bug, $section) {
    super(id, bug, $section);

    this.config = BzDeck.host.data.config.fields.filter(f => f.name === this.field)[0];
    this.all_keywords = this.config.values.map(v => v.name);
    this.$button_template = this.get_template('bug-keyword-button');
  }

  /**
   * Filter all available keywords with the bug's current keywords, changes and an arbitrary search term.
   * @param {String} [input] - User-provided search term, like `dev`.
   * @returns {Promise.<Array.<String>>} - Filtered keywords.
   */
  async filter_values (input = '') {
    const changes = this.bug.changes.keywords;
    const regex = new RegExp(`\\b${FlareTail.util.RegExp.escape(input)}`, 'i');

    return this.all_keywords.filter(keyword => {
      if (changes && changes.add && changes.add.includes(keyword)) {
        return false;
      }

      if (changes && changes.remove && changes.remove.includes(keyword)) {
        return true;
      }

      if (this.bug.keywords.includes(keyword)) {
        return false;
      }

      if (input) {
        return !!keyword.match(regex);
      }

      return true;
    });
  }
}
