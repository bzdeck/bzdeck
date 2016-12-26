/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the BugDetailsView that represents the Info tabpanel content in the Bug Details page.
 * @extends BzDeck.BaseView
 */
BzDeck.BugDetailsView = class BugDetailsView extends BzDeck.BaseView {
  /**
   * Get a BugDetailsView instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {HTMLElement} $bug - Bug container element.
   * @returns {BugDetailsView} New BugDetailsView instance.
   */
  constructor (id, $bug) {
    super(id); // Assign this.id

    this.$bug = $bug;
    this.$container = this.$bug.querySelector('.bug-details');
  }

  /**
   * Render the details once bug data is ready.
   * @param {Proxy} bug - Proxified BugModel instance.
   */
  async render (bug) {
    if (!bug.summary && !bug._update_needed) {
      // The bug is being loaded
      return;
    }

    this.bug = bug;

    const get_user = name => BzDeck.collections.users.get(name, { name }); // Promise
    const _bug = {
      cc: (await Promise.all(this.bug.cc.map(get_user))).map(person => person.properties),
      depends_on: this.bug.depends_on,
      blocks: this.bug.blocks,
      see_also: this.bug.see_also,
      dupe_of: this.bug.dupe_of || undefined,
      duplicate: this.bug.duplicates,
    };

    await Promise.all(BzDeck.config.grid.default_columns.map(async ({ id: field, type } = {}) => {
      if (this.bug[field] !== undefined) {
        if (field === 'keywords') {
          _bug.keyword = this.bug.keywords;
        } else if (field === 'mentors') {
          const mentors = await Promise.all(this.bug.mentors.map(name => get_user(name)));

          _bug.mentor = mentors.map(mentor => mentor.properties);
        } else if (type === 'person') {
          if (this.bug[field] && !this.bug[field].startsWith('nobody@')) { // Is this BMO-specific?
            const user = await get_user(this.bug[field]);

            _bug[field] = user.properties;
          }
        } else {
          _bug[field] = this.bug[field] || '';
        }
      }
    }));

    // Use `this.$bug` instead of `this.$container` due to the scope limitation. This can also fills in the bug summary
    // at the top of the timeline, which is outside of the info tabpanel.
    this.fill(this.$bug, _bug);

    // Depends on, Blocks and Duplicates
    for (const $li of this.$container.querySelectorAll('[itemprop="depends_on"], [itemprop="blocks"], \
                                                        [itemprop="duplicate"]')) {
      $li.setAttribute('data-bug-id', $li.textContent);

      (new FlareTail.widgets.Button($li)).bind('Pressed', event => {
        this.trigger('AnyView#OpeningBugRequested', { id: Number(event.target.textContent) });
      });
    }

    // See Also
    for (const $link of this.$container.querySelectorAll('[itemprop="see_also"]')) {
      const re = new RegExp(`^${BzDeck.host.origin}/show_bug.cgi\\?id=(\\d+)$`.replace(/\./g, '\\.'));
      const match = $link.href.match(re);

      if (match) {
        $link.text = match[1];
        $link.setAttribute('data-bug-id', match[1]);
        $link.setAttribute('role', 'button');
      } else {
        $link.text = $link.href;
      }
    }

    this.activate_widgets();

    new BzDeck.BugFlagsView(this.id, this.bug).render(this.$container.querySelector('[data-category="flags"]'));
    this.render_tracking_flags();
  }

  /**
   * Get product-dependent field values that will be displayed in a combobox.
   * @param {String} field_name - One of the following bug field names: product, component, version, target_milestone
   *  and status.
   * @param {String} [product_name] - The default is the bug's product name, but it could be different when the user
   *  attempts to change the product.
   * @returns {Array.<Object>} Field values.
   */
  get_field_values (field_name, product_name = this.bug.product) {
    const { field, product } = BzDeck.host.data.config;
    const { component, version_detail, target_milestone_detail } = product[product_name];
    const values = {
      product: Object.keys(product).filter(name => product[name].is_active).sort(),
      component: Object.keys(component).filter(name => component[name].is_active).sort(),
      version: version_detail.filter(version => version.is_active).map(version => version.name),
      target_milestone: target_milestone_detail.filter(ms => ms.is_active).map(ms => ms.name),
      status: field.status.transitions[this.bug.status], // The order matters
    };

    return values[field_name] || field[field_name].values;
  }

  /**
   * Activate the UI widgets such as textboxes and comboboxes.
   * @fires BugView#EditField
   */
  activate_widgets () {
    this.comboboxes = new WeakMap();
    this.subscribe('M#FieldEdited', true);

    const can_editbugs = BzDeck.account.permissions.includes('editbugs');
    const is_closed = value => BzDeck.host.data.config.field.status.closed.includes(value);

    // Iterate over the fields except the Flags section which is activated by BugFlagsView
    for (const $section of this.$container.querySelectorAll('[data-field]:not([itemtype$="/Flag"])')) {
      const name = $section.dataset.field;
      const $combobox = $section.querySelector('[role="combobox"][aria-readonly="true"]');
      const $textbox = $section.querySelector('[role="textbox"]');
      const $next_field = $section.nextElementSibling;

      // Activate comboboxes
      if ($combobox) {
        const $$combobox = new FlareTail.widgets.ComboBox($combobox);

        this.comboboxes.set($combobox, $$combobox);
        $combobox.setAttribute('aria-readonly', !can_editbugs);

        $$combobox.build_dropdown(this.get_field_values(name)
            .map(value => ({ value, selected: value === this.bug[name] })));
        $$combobox.bind('Change', event => {
          const value = event.detail.value;

          this.trigger('#EditField', { name, value });

          if (name === 'status' && is_closed(value) && $next_field.matches('[data-field="resolution"]') ||
              name === 'resolution' && value === 'DUPLICATE' && $next_field.matches('[data-field="dupe_of"]')) {
            window.setTimeout(() => $next_field.querySelector('[role="textbox"], [role="searchbox"]').focus(), 100);
          }
        });
      }

      // Activate textboxes
      if ($textbox) {
        const $$textbox = new FlareTail.widgets.TextBox($textbox);

        $textbox.tabIndex = 0;
        $textbox.contentEditable = $textbox.spellcheck = can_editbugs;
        $textbox.setAttribute('aria-readonly', !can_editbugs);
        $$textbox.bind('focusin', event => $textbox.spellcheck = true);
        $$textbox.bind('focusout', event => $textbox.spellcheck = false);
        $$textbox.bind('input', event => this.trigger('#EditField', { name, value: $$textbox.value }));
        $$textbox.bind('cut', event => this.trigger('#EditField', { name, value: $$textbox.value }));
        $$textbox.bind('paste', event => this.trigger('#EditField', { name, value: $$textbox.value }));
      }

      // URL
      if (name === 'url') {
        this.activate_url_widget($section);
      }

      if (name === 'dupe_of') {
        // Activate bug finder
      }

      // Multiple value fields, including alias, keywords, see_also, depends_on, blocks

      // Activate Participants UI
      if (['assigned_to', 'qa_contact', 'mentor', 'cc'].includes(name)) {
        new BzDeck.BugParticipantListView(this.id, this.bug, $section);
      }
    }

    {
      const $participants = this.$container.querySelector('.bug-participants');

      if ($participants) {
        // Add a tooltop for each person; should be replaced by a rich tooltip (#80)
        $participants.addEventListener('mouseover', event => {
          const $target = event.target;

          if ($target.matches('[itemprop][itemtype$="User"]') && !$target.title) {
            $target.title = $target.querySelector('[itemprop="description"]').content + '\n'
                          + $target.querySelector('[itemprop="email"]').content;
          }
        });
      }
    }

    this.update_resolution_ui(this.bug.resolution);
  }

  /**
   * Activate the URL widget.
   * @param {HTMLElement} $section - Outer element.
   * @fires BugView#EditField
   */
  activate_url_widget ($section) {
    let $textbox = $section.querySelector('input');

    if ($textbox) {
      return;
    }

    const $link = $section.querySelector('a');
    const orignal_value = $link ? $link.getAttribute('href') : this.bug.url;

    $textbox = document.createElement('input');
    $textbox.className = 'distinct';
    $textbox.type = 'url';
    $textbox.value = orignal_value;
    $textbox.setAttribute('role', 'textbox');
    $textbox.setAttribute('itemprop', 'url');

    if ($link) {
      $section.replaceChild($textbox, $link);
    } else {
      $section.appendChild($textbox);
    }

    $textbox.addEventListener('input', event => this.trigger('#EditField', {
      name: 'url', value: $textbox.validity.valid ? $textbox.value : orignal_value
    }));
  }

  /**
   * Update the Resolution field UI when the Status is changed.
   * @param {String} resolution - FIXED, DUPLICATE, etc.
   */
  update_resolution_ui (resolution) {
    const is_open = resolution === '';
    const is_dupe = resolution === 'DUPLICATE';
    const can_editbugs = BzDeck.account.permissions.includes('editbugs');
    const $resolution = this.$container.querySelector('[data-field="resolution"]');
    const $combobox = $resolution.querySelector('[role="combobox"]');
    const $dupe_of = this.$container.querySelector('[data-field="dupe_of"]');
    const $dupe_of_prop = $dupe_of.querySelector('[itemprop="dupe_of"]');

    $resolution.hidden = is_open;
    $resolution.querySelector('[role="option"][data-value=""]').setAttribute('aria-hidden', !is_open);
    $combobox.setAttribute('aria-disabled', !can_editbugs && is_open);
    this.comboboxes.get($combobox).selected = resolution;

    $dupe_of.hidden = !is_dupe;

    if ($dupe_of_prop) {
      $dupe_of_prop.setAttribute('aria-disabled', !is_dupe);
    }
  }

  /**
   * Render the Tracking Flags section on the bug info pane.
   */
  render_tracking_flags () {
    const config = BzDeck.host.data.config;
    const $outer = this.$container.querySelector('[data-category="tracking-flags"]');
    const $flag = this.get_template('details-tracking-flag');
    const $fragment = new DocumentFragment();

    for (const name of Object.keys(this.bug.data).sort()) {
      const field = config.field[name];
      const value = this.bug.data[name];

      // Check the flag type, 99 is for project flags or tracking flags on bugzilla.mozilla.org
      if (!name.startsWith('cf_') || !field || !field.is_active || field.type !== 99) {
        continue;
      }

      $fragment.appendChild(this.fill($flag.cloneNode(true), {
        name: field.description,
        value,
      }, {
        'aria-label': field.description,
        'data-field': name,
        'data-has-value': value !== '---',
      }));
    }

    $outer.appendChild($fragment);
  }

  /**
   * Called whenever any field is edited by the user. Update the relevante widget accordingly.
   * @listens BugModel#FieldEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} name - Field name.
   * @param {String} value - Field value.
   */
  on_field_edited ({ bug_id, name, value } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    if (name === 'product') {
      const product_name = value;

      // When the Product is updated, the Version, Component, Target Milestone have to be updated as well
      for (const field_name of ['version', 'component', 'target_milestone']) {
        this.comboboxes.get(this.$container.querySelector(`[data-field="${field_name}"] [role="combobox"]`))
            .build_dropdown(this.get_field_values(field_name, product_name).map(value => ({ value, selected: false })));
      }
    }

    const $field = this.$container.querySelector(`[data-field="${name}"]`);
    const $combobox = $field ? $field.querySelector('[role="combobox"][aria-readonly="true"]') : undefined;
    const $textbox = $field ? $field.querySelector('[role="textbox"]') : undefined;

    if ($combobox) {
      this.comboboxes.get($combobox).selected = value;
    }

    if ($textbox && $textbox.textContent !== String(value)) {
      $textbox.textContent = value;
    }

    if (name === 'resolution') {
      this.update_resolution_ui(value);
    }
  }
}
