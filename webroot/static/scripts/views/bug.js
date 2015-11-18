/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Bug View that represents the Preview Pane content on the Home page or Advanced Search page. The Bug
 * Details page uses BugDetailsView instead.
 *
 * @constructor
 * @extends BaseView
 * @argument {String} view_id - Instance identifier. It should be the same as the BugController instance, otherwise the
 *  relevant notification events won't work.
 * @argument {Proxy} bug - Proxified BugModel instance.
 * @argument {HTMLElement} $bug - Outer element to display the content.
 * @return {Object} view - New BugView instance.
 */
BzDeck.views.Bug = function BugView (view_id, bug, $bug) {
  this.id = view_id;
  this.bug = bug;
  this.$bug = $bug;

  this.init();
};

BzDeck.views.Bug.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Bug.prototype.constructor = BzDeck.views.Bug;

/**
 * Start rendering the content, activate the widgets and event listeners.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.init = function () {
  this.render();

  // Custom scrollbars
  this.scrollbars = new Set([...this.$bug.querySelectorAll('[role="region"]')]
                                .map($area => new this.widgets.ScrollBar($area)));

  this.subscribe('BugModel:AnnotationUpdated', true); // Enable the global option
  this.subscribe('BugModel:Updated', true); // Cannot be 'M:Updated' because it doesn't work in BugDetailsView
  this.subscribe('BugView:FilesSelected');
};

/**
 * Set up menu items on the toolbar.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.setup_toolbar = function () {
  let $button = this.$bug.querySelector('[data-command="show-menu"]');

  if (!$button) {
    return;
  }

  new this.widgets.Button($button);

  let $timeline = this.$bug.querySelector('.bug-timeline'),
      $menu = document.getElementById($button.getAttribute('aria-owns')),
      $toggle_comments = $menu.querySelector('[id$="--toggle-comments"]'),
      $toggle_cc = $menu.querySelector('[id$="--toggle-cc"]'),
      $copy_link = $menu.querySelector('[data-command="copy-link"]'),
      $bugzilla_link = $menu.querySelector('[data-command="open-bugzilla"]'),
      $tweet_link = $menu.querySelector('[data-command="tweet"]');

  let toggle_cc = value => {
    BzDeck.prefs.set('ui.timeline.show_cc_changes', value);
    document.documentElement.setAttribute('data-ui-timeline-show-cc-changes', String(value));
  };

  let handlers = {
    'show-cc': () => toggle_cc(true),
    'hide-cc': () => toggle_cc(false),
    'expand-comments': () => this.timeline.expand_comments(),
    'collapse-comments': () => this.timeline.collapse_comments(),
  };

  $menu.addEventListener('MenuOpened', event => {
    let collapsed = !!$timeline.querySelectorAll('.read-comments-expander, \
                                                  [itemprop="comment"][aria-expanded="false"]').length,
        cc_shown = !!BzDeck.prefs.get('ui.timeline.show_cc_changes');

    $toggle_comments.setAttribute('aria-disabled', !this.timeline);
    $toggle_comments.setAttribute('data-command', collapsed ? 'expand-comments' : 'collapse-comments');
    $toggle_comments.firstElementChild.textContent = collapsed ? 'Expand All Comments' : 'Collapse All Comments';
    $toggle_cc.setAttribute('aria-disabled', !this.timeline);
    $toggle_cc.setAttribute('data-command', cc_shown ? 'hide-cc': 'show-cc');
    $toggle_cc.firstElementChild.textContent = cc_shown ? 'Hide CC Changes' : 'Show CC Changes';
  });

  $menu.addEventListener('MenuItemSelected', event => (handlers[event.detail.command] || (() => {}))());

  if ($copy_link) {
    $copy_link.addEventListener('mousedown', event => event.stopPropagation());
    $copy_link.addEventListener('click', event => document.execCommand('copy'));
    $copy_link.addEventListener('copy', event => {
      let url = `${location.origin}/bug/${this.bug.id}`;

      // Modify the clipboard
      event.clipboardData.setData('text/uri-list', url);
      event.clipboardData.setData('text/plain', url);
      event.preventDefault();
      // Close the menu
      $button.click();
    });

    // Disable the link on Firefox 40 and below where click-to-copy is not supported and queryCommandEnabled throws
    try {
      document.queryCommandEnabled('copy');
    } catch (ex) {
      $copy_link.setAttribute('aria-disabled', 'true');
    }
  }

  if ($bugzilla_link) {
    $bugzilla_link.href = `${BzDeck.models.server.url}/show_bug.cgi?id=${this.bug.id}&redirect=no`;
  }

  if ($tweet_link) {
    // https://dev.twitter.com/web/tweet-button/web-intent
    let summary = this.bug.summary.substr(0, 80) + (this.bug.summary.length > 80 ? '...' : ''),
        href = 'https://twitter.com/intent/tweet?via=BzDeck'
             + '&text=' + encodeURIComponent(`Bug ${this.bug.id} - ${summary}`)
             + '&url=' + encodeURIComponent(`${location.origin}/bug/${this.bug.id}`);

    $tweet_link.href = href;
  }
};

/**
 * Render the bug and, activate the toolbar buttons and assign keyboard shortcuts.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.render = function () {
  this.$bug.dataset.id = this.bug.id;

  if (!this.bug.summary && !this.bug._update_needed) {
    // The bug is being loaded
    return;
  }

  this.setup_toolbar();

  let _bug = {};

  for (let { id: field, type } of BzDeck.config.grid.default_columns) {
    if (this.bug[field] !== undefined) {
      if (field === 'keywords') {
        _bug.keyword = this.bug.keywords;
      } else if (field === 'mentors') {
        _bug.mentor = this.bug.mentors.map(name => BzDeck.collections.users.get(name, { name }).properties);
      } else if (type === 'person') {
        if (this.bug[field] && !this.bug[field].startsWith('nobody@')) { // Is this BMO-specific?
          _bug[field] = BzDeck.collections.users.get(this.bug[field], { name: this.bug[field] }).properties;
        }
      } else {
        _bug[field] = this.bug[field] || '';
      }
    }
  }

  // Other Contributors, excluding Cc
  _bug.contributor = [...this.bug.contributors].filter(name => !this.bug.cc.includes(name))
                                               .map(name => BzDeck.collections.users.get(name, { name }).properties);

  this.fill(this.$bug, _bug);

  this.set_product_tooltips();

  let can_editbugs = BzDeck.models.account.permissions.includes('editbugs'),
      $edit_button = this.$bug.querySelector('[role="button"][data-command="edit"]'),
      $star_button = this.$bug.querySelector('[role="button"][data-command="star"]'),
      $timeline = this.$bug.querySelector('.bug-timeline');

  if ($edit_button) {
    $edit_button.setAttribute('aria-disabled', !can_editbugs);
    (new this.widgets.Button($edit_button)).bind('Pressed', event =>
        this.trigger('BugView:EditModeChanged', { enabled: event.detail.pressed }));
  }

  if ($star_button) {
    $star_button.setAttribute('aria-pressed', this.bug.starred);
    (new this.widgets.Button($star_button)).bind('Pressed', event => this.bug.starred = event.detail.pressed);
  }

  if (!$timeline) {
    return;
  }

  $timeline.setAttribute('aria-busy', 'true');
  BzDeck.views.statusbar.show('Loading...'); // l10n

  // Empty timeline while keeping the scrollbar
  for (let $comment of $timeline.querySelectorAll('article, [role="form"], .read-comments-expander')) {
    $comment.remove();
  }

  if (this.bug.comments && !this.bug._update_needed) {
    this.helpers.event.async(() => this.fill_details(false));
  } else {
    // Load comments, history, flags and attachments' metadata; Exclude metadata
    this.bug.fetch(false).then(bug => {
      this.bug = bug;
      this.helpers.event.async(() => this.fill_details(true));
    });
  }

  // Focus management
  let set_focus = shift => {
    let ascending = BzDeck.prefs.get('ui.timeline.sort.order') !== 'descending',
        entries = [...$timeline.querySelectorAll('[itemprop="comment"]')];

    entries = ascending && shift || !ascending && !shift ? entries.reverse() : entries;

    // Focus the first (or last) visible entry
    for (let $_entry of entries) if ($_entry.clientHeight) {
      $_entry.focus();
      $_entry.scrollIntoView({ block: ascending ? 'start' : 'end', behavior: 'smooth' });

      break;
    }
  };

  // Assign keyboard shortcuts
  if (!$timeline.hasAttribute('keyboard-shortcuts-enabled')) {
    this.helpers.kbd.assign($timeline, {
      // Toggle read
      M: event => this.bug.unread = !this.bug.unread,
      // Toggle star
      S: event => this.bug.starred = !this.bug.starred,
      // Reply
      R: event => document.querySelector(`#${this.id}-comment-form [role="textbox"]`).focus(),
      // Focus management
      'PageUp|Shift+Space': event => set_focus(true),
      'PageDown|Space': event => set_focus(false),
    });

    $timeline.setAttribute('keyboard-shortcuts-enabled', 'true');
  }
};

/**
 * Render the bug data on the view.
 *
 * @argument {Boolean} delayed - Whether the bug details including comments and attachments will be rendered later.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.fill_details = function (delayed) {
  // When the comments and history are loaded async, the template can be removed
  // or replaced at the time of call, if other bug is selected by user
  if (!this.$bug || Number.parseInt(this.$bug.dataset.id) !== this.bug.id) {
    return;
  }

  let get_person = name => BzDeck.collections.users.get(name, { name }).properties;

  let _bug = {
    cc: this.bug.cc.map(name => get_person(name)),
    depends_on: this.bug.depends_on,
    blocks: this.bug.blocks,
    see_also: this.bug.see_also,
    dupe_of: this.bug.dupe_of || undefined,
    duplicate: this.bug.duplicates,
  };

  this.fill(this.$bug, _bug);

  // Depends on, Blocks and Duplicates
  for (let $li of this.$bug.querySelectorAll('[itemprop="depends_on"], [itemprop="blocks"], [itemprop="duplicate"]')) {
    $li.setAttribute('data-bug-id', $li.textContent);

    (new this.widgets.Button($li)).bind('Pressed', event => {
      this.trigger('GlobalView:OpenBug', { id: Number(event.target.textContent) });
    });
  }

  // See Also
  for (let $link of this.$bug.querySelectorAll('[itemprop="see_also"]')) {
    let re = new RegExp(`^${BzDeck.models.server.url}/show_bug.cgi\\?id=(\\d+)$`.replace(/\./g, '\\.')),
        match = $link.href.match(re);

    if (match) {
      $link.text = match[1];
      $link.setAttribute('data-bug-id', match[1]);
      $link.setAttribute('role', 'button');
    } else {
      $link.text = $link.href;
    }
  }

  // Flags, only on the details tabs
  if (this.render_tracking_flags) {
    new BzDeck.views.BugFlags(this.bug).render(this.$bug.querySelector('[data-category="flags"]'));

    this.render_tracking_flags();
  }

  // Prepare the timeline and comment form
  this.timeline = new BzDeck.views.BugTimeline(this.id, this.bug, this.$bug, delayed);
  this.comment_form = new BzDeck.views.BugCommentForm(this.id, this.bug, this.$bug),
  this.activate_widgets();

  this.helpers.event.async(() => {
    // Number badge on tabs, only on the details tabs
    if (this.add_tab_badges) {
      this.add_tab_badges();
    }

    // Attachments, only on the details tabs
    if (this.render_attachments) {
      this.render_attachments();
    }

    // History, only on the details tabs
    if (this.render_history) {
      this.render_history();
    }

    // Add tooltips to the related bugs
    this.set_bug_tooltips();

    // Force updating the scrollbars because sometimes those are not automatically updated
    this.scrollbars.forEach($$scrollbar => $$scrollbar.set_height());
  });

  BzDeck.views.statusbar.show('');
};

/**
 * Activate the UI widgets such as textboxes and comboboxes.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.activate_widgets = function () {
  this.comboboxes = new WeakMap();
  this.subscribe('BugController:FieldEdited');

  let can_editbugs = BzDeck.models.account.permissions.includes('editbugs'),
      is_closed = value => BzDeck.models.server.data.config.field.status.closed.includes(value);

  // Iterate over the fields except the Flags secion which is activated by BugFlagsView
  for (let $section of this.$bug.querySelectorAll('[data-field]:not([itemtype$="/Flag"])')) {
    let name = $section.dataset.field,
        $combobox = $section.querySelector('[role="combobox"][aria-readonly="true"]'),
        $textbox = $section.querySelector('.blurred[role="textbox"]'),
        $next_field = $section.nextElementSibling;

    // Activate comboboxes
    if ($combobox) {
      let $$combobox = new this.widgets.ComboBox($combobox);

      this.comboboxes.set($combobox, $$combobox);
      $combobox.setAttribute('aria-disabled', !can_editbugs);
      $$combobox.build(this.get_field_values(name).map(value => ({ value, selected: value === this.bug[name] })));
      $$combobox.bind('Change', event => {
        let value = event.detail.value;

        this.trigger('BugView:EditField', { name, value });

        if (name === 'status' && is_closed(value) && $next_field.matches('[data-field="resolution"]') ||
            name === 'resolution' && value === 'DUPLICATE' && $next_field.matches('[data-field="dupe_of"]')) {
          window.setTimeout(() => $next_field.querySelector('[role="textbox"], [role="searchbox"]').focus(), 100);
        }
      });
    }

    // Activate textboxes
    if ($textbox) {
      let $$textbox = new this.widgets.TextBox($textbox);

      $textbox.tabIndex = 0;
      $textbox.spellcheck = false;
      $textbox.contentEditable = can_editbugs;
      $textbox.setAttribute('aria-readonly', !can_editbugs);
      $$textbox.bind('focus', event => $textbox.spellcheck = true);
      $$textbox.bind('blur', event => $textbox.spellcheck = false);
      $$textbox.bind('input', event => this.trigger('BugView:EditField', { name, value: $$textbox.value }));
      $$textbox.bind('cut', event => this.trigger('BugView:EditField', { name, value: $$textbox.value }));
      $$textbox.bind('paste', event => this.trigger('BugView:EditField', { name, value: $$textbox.value }));
    }

    if (name === 'dupe_of') {
      // Activate bug finder
    }

    // Multiple value fields, including alias, keywords, see_also, depends_on, blocks

    // Activate Participants UI
    if (['assigned_to', 'qa_contact', 'mentor', 'cc'].includes(name)) {
      new BzDeck.views.BugParticipantList(this.id, this.bug, $section);
    }
  }

  {
    let $participants = this.$bug.querySelector('.bug-participants');

    if ($participants) {
      // Add a tooltop for each person; should be replaced by a rich tooltip (#80)
      $participants.addEventListener('mouseover', event => {
        let $target = event.target;

        if ($target.matches('[itemprop][itemtype$="User"]') && !$target.title) {
          $target.title = $target.querySelector('[itemprop="description"]').textContent + '\n'
                        + $target.querySelector('[itemprop="email"]').content;
        }
      });
    }
  }

  this.update_resolution_ui(this.bug.resolution);
};

/**
 * Get product-dependent field values that will be displayed in a combobox.
 *
 * @argument {String} field_name - One of the following bug field names: product, component, version, target_milestone
 *  and status.
 * @argument {String} [product_name] - The default is the bug's product name, but it could be different when the user
 *  attempts to change the product.
 * @return {Array} values - Field values.
 */
BzDeck.views.Bug.prototype.get_field_values = function (field_name, product_name = this.bug.product) {
  let { field, product } = BzDeck.models.server.data.config,
      { component, version_detail, target_milestone_detail } = product[product_name];

  let values = {
    product: Object.keys(product).filter(name => product[name].is_active).sort(),
    component: Object.keys(component).filter(name => component[name].is_active).sort(),
    version: version_detail.filter(version => version.is_active).map(version => version.name),
    target_milestone: target_milestone_detail.filter(ms => ms.is_active).map(ms => ms.name),
    status: field.status.transitions[this.bug.status], // The order matters
  };

  return values[field_name] || field[field_name].values;
};

/**
 * Update the Resolution field UI when the Status is changed.
 *
 * @argument {String} resolution - FIXED, DUPLICATE, etc.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.update_resolution_ui = function (resolution) {
  let is_open = resolution === '',
      is_dupe = resolution === 'DUPLICATE',
      can_editbugs = BzDeck.models.account.permissions.includes('editbugs'),
      $resolution = this.$bug.querySelector('[data-field="resolution"]'),
      $combobox = $resolution.querySelector('[role="combobox"]'),
      $dupe_of = this.$bug.querySelector('[data-field="dupe_of"]'),
      $dupe_of_prop = $dupe_of.querySelector('[itemprop="dupe_of"]');

  $resolution.hidden = is_open;
  $resolution.querySelector('[role="option"][data-value=""]').setAttribute('aria-hidden', !is_open);
  $combobox.setAttribute('aria-disabled', !can_editbugs && is_open);
  this.comboboxes.get($combobox).selected = resolution;

  $dupe_of.hidden = !is_dupe;

  if ($dupe_of_prop) {
    $dupe_of_prop.setAttribute('aria-disabled', !is_dupe);
  }
};

/**
 * Called whenever any field is edited by the user. Update the relevante widget accordingly.
 *
 * @argument {Object} data - Passed data.
 * @argument {String} data.name - Field name.
 * @argument {String} data.value - Field value.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.on_field_edited = function (data) {
  let { name, value } = data;

  if (name === 'product') {
    let product_name = value;

    // When the Product is updated, the Version, Component, Target Milestone have to be updated as well
    for (let field_name of ['version', 'component', 'target_milestone']) {
      this.comboboxes.get(this.$bug.querySelector(`[data-field="${field_name}"] [role="combobox"]`))
          .build(this.get_field_values(field_name, product_name).map(value => ({ value, selected: false })));
    }
  }

  let $field = this.$bug.querySelector(`[data-field="${name}"]`),
      $combobox = $field ? $field.querySelector('[role="combobox"][aria-readonly="true"]') : undefined,
      $textbox = $field ? $field.querySelector('.blurred[role="textbox"]') : undefined;

  if ($combobox) {
    this.comboboxes.get($combobox).selected = value;
  }

  if ($textbox && $textbox.textContent !== String(value)) {
    $textbox.textContent = value;
  }

  if (name === 'resolution') {
    this.update_resolution_ui(value);
  }
};

/**
 * Called when the user selected files to attach through an input form control or drag and drop operation. If the
 * browser supports the new FileSystem API, look for the files and directories recursively. Otherwise, utilize the
 * traditional File API to identify the files. In any case, notify the selected files to the controller.
 *
 * @argument {Object} data - Passed data.
 * @argument {(HTMLInputElement|DataTransfer)} data.input - Data source.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.on_files_selected = function (data) {
  let iterate = items => {
    for (let item of items) if (typeof item.getFilesAndDirectories === 'function') {
      item.getFilesAndDirectories().then(_items => iterate(_items));
    } else {
      this.trigger('BugView:AttachFiles', { files: [item] });
    }
  };

  if (typeof data.input.getFilesAndDirectories === 'function') {
    data.input.getFilesAndDirectories().then(items => iterate(items));
  } else {
    this.trigger('BugView:AttachFiles', { files: data.input.files });
  }
};

/**
 * Set a tooltip on each product name that shows the Bugzilla-defined description of that product.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.set_product_tooltips = function () {
  let config = BzDeck.models.server.data.config,
      strip_tags = str => this.helpers.string.strip_tags(str).replace(/\s*\(more\ info\)$/i, ''),
      classification = config.classification[this.bug.classification],
      product = config.product[this.bug.product],
      component,
      $classification = this.$bug.querySelector('[itemprop="classification"]'),
      $product = this.$bug.querySelector('[itemprop="product"]'),
      $component;

  if ($classification && classification) {
    $classification.title = strip_tags(classification.description);
  }

  if (!product) {
    return;
  }

  if ($product) {
    $product.title = strip_tags(product.description);
  }

  component = product.component[this.bug.component];
  $component = this.$bug.querySelector('[itemprop="component"]');

  if ($component && component) {
    $component.title = strip_tags(component.description);
  }
};

/**
 * Set a tooptip on each bug ID that shows the summary and status of that bug.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.set_bug_tooltips = function () {
  let related_ids = [...this.$bug.querySelectorAll('[data-bug-id]')]
                                .map($element => Number.parseInt($element.getAttribute('data-bug-id')));

  let set_tooltops = bug => {
    let title;

    if (!bug) {
      return;
    }

    if (bug.summary) {
      title = bug.status + (bug.resolution ? ` ${bug.resolution}` : '') + ` – ${bug.summary}`;
    }

    if (bug.error) {
      title = {
        102: 'You are not authorized to access this bug.',
      }[bug.error.code] || 'This bug data is not available.';
    }

    for (let $element of this.$bug.querySelectorAll(`[data-bug-id="${bug.id}"]`)) {
      $element.title = title;
      $element.dataset.status = bug.status;
      $element.dataset.resolution = bug.resolution || '';
    }
  };

  if (related_ids.length) {
    let bugs = BzDeck.collections.bugs.get_some(related_ids),
        lookup_ids = new Set(related_ids.filter(id => !bugs.get(id)));

    bugs.forEach(bug => set_tooltops(bug));

    // BzDeck.collections.bugs.fetch() fails when one or more bugs in the result are private, so retrieve each bug
    // individually (Bug 1169040)
    for (let id of lookup_ids) {
      BzDeck.collections.bugs.get(id, { id, _unread: true }).fetch(true, false).then(bug => set_tooltops(bug));
    }
  }
};

/**
 * Called whenever any bug field is updated on the remote Bugzilla instance. This may be called as part of the periodic
 * fetches or Bugzfeed push notifications.
 *
 * @argument {Proxy} bug - Updated BugModel instance.
 * @argument {Map.<String, Object>} changes - Change details.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.update = function (bug, changes) {
  this.bug = bug;

  let $timeline = this.$bug.querySelector('.bug-timeline');

  if ($timeline) {
    $timeline.querySelector('.comments-wrapper')
             .appendChild(new BzDeck.views.BugTimelineEntry(this.id, this.bug, changes));
    $timeline.querySelector('.comments-wrapper > article:last-of-type')
             .scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  // Update the tab badges
  if (this.add_tab_badges) {
    this.add_tab_badges();
  }

  if (changes.has('attachment') && this.render_attachments) {
    this.$$attachments.render([changes.get('attachment')]);
  }

  if (changes.has('history') && this.render_history) {
    let _bug = { id: this.bug.id, _update_needed: true };

    // Prep partial data
    for (let { field_name: prop } in changes.get('history').changes) {
      let value = _bug[prop] = this.bug[prop];

      // TEMP: the current fill method doesn't update combobox items, so update manually
      {
        let $combobox = this.$bug.querySelector(`[data-field="${prop}"] [role="combobox"][aria-readonly="true"]`);

        if ($combobox) {
          this.comboboxes.get($combobox).selected = value;
        }
      }
    }

    this.fill(this.$bug, _bug);
    this.$$history.render([changes.get('history')]);
    this.$tablist.querySelector('[id$="-tab-history"]').setAttribute('aria-disabled', 'false');
  }
};

/**
 * Called by BugModel whenever a bug annotation is updated. Update the Star button on the toolbar.
 *
 * @argument {Object} data - Annotation change details.
 * @argument {Proxy} data.bug - Changed bug.
 * @argument {String} data.type - Annotation type such as 'starred' or 'unread'.
 * @argument {Boolean} data.value - New annotation value.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.on_annotation_updated = function (data) {
  if (this.$bug && data.bug.id === this.bug.id && data.type === 'starred') {
    this.$bug.querySelector('header [role="button"][data-command="star"]').setAttribute('aria-pressed', data.value);
  }
};

/**
 * Called by BugModel whenever any field of a bug is updated. Update the view if the bug ID matches.
 *
 * @argument {Object} data - Passed data.
 * @argument {Proxy} data.bug - Changed bug.
 * @argument {Map}   data.changes - Change details.
 * @return {undefined}
 */
BzDeck.views.Bug.prototype.on_updated = function (data) {
  if (data.bug.id === this.bug.id) {
    this.update(data.bug, data.changes);
  }
};
