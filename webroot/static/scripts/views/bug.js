/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Bug = function BugView (view_id, bug, $bug) {
  this.id = view_id;
  this.bug = bug;
  this.$bug = $bug;

  this.init();
};

BzDeck.views.Bug.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Bug.prototype.constructor = BzDeck.views.Bug;

BzDeck.views.Bug.prototype.init = function () {
  this.render();

  // Custom scrollbars
  this.scrollbars = new Set([for ($area of this.$bug.querySelectorAll('[role="region"]'))
                                  new this.widgets.ScrollBar($area)]);

  this.on('M:AnnotationUpdated', data => {
    if (this.$bug && data.type === 'starred') {
      this.$bug.querySelector('header [role="button"][data-command="star"]').setAttribute('aria-pressed', data.value);
    }
  });

  this.on('BugModel:Updated', data => { // Cannot be 'M:Updated' because it doesn't work in BugDetailsView
    if (data.bug.id === this.bug.id) {
      this.update(data.bug, data.changes);
    }
  }, true); // Enable the global option
};

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
        _bug.mentor = [for (name of this.bug.mentors) BzDeck.collections.users.get(name, { name }).properties];
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
  _bug.contributor = [for (name of this.bug.contributors) if (!this.bug.cc.includes(name))
                        BzDeck.collections.users.get(name, { name }).properties];

  this.fill(this.$bug, _bug);

  this.set_product_tooltips();

  let $button = this.$bug.querySelector('[role="button"][data-command="star"]'),
      $timeline = this.$bug.querySelector('.bug-timeline');

  // Star on the header
  if ($button) {
    $button.setAttribute('aria-pressed', this.bug.starred);
    (new this.widgets.Button($button)).bind('Pressed', event => this.bug.starred = event.detail.pressed);
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

BzDeck.views.Bug.prototype.fill_details = function (delayed) {
  // When the comments and history are loaded async, the template can be removed
  // or replaced at the time of call, if other bug is selected by user
  if (!this.$bug || Number.parseInt(this.$bug.dataset.id) !== this.bug.id) {
    return;
  }

  let get_person = name => BzDeck.collections.users.get(name, { name }).properties;

  let _bug = {
    cc: [for (name of this.bug.cc) get_person(name)],
    depends_on: this.bug.depends_on,
    blocks: this.bug.blocks,
    see_also: this.bug.see_also,
    dupe_of: this.bug.dupe_of || [],
    duplicate: this.bug.duplicates,
    flag: [for (flag of this.bug.flags) {
      creator: get_person(flag.setter),
      name: flag.name,
      status: flag.status,
      requestee: flag.requestee ? get_person(flag.requestee) : {},
    }]
  };

  this.fill(this.$bug, _bug);

  // Depends on, Blocks and Duplicates
  for (let $li of this.$bug.querySelectorAll('[itemprop="depends_on"], [itemprop="blocks"], [itemprop="duplicate"]')) {
    $li.setAttribute('data-bug-id', $li.itemValue);

    (new this.widgets.Button($li)).bind('Pressed', event =>
      BzDeck.router.navigate('/bug/' + event.target.textContent));
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

  // Flags
  let $flags = this.$bug.querySelector('[data-field="flags"]');

  if ($flags) {
    $flags.setAttribute('aria-hidden', !this.bug.flags.length);
  }

  // TODO: Show Project Flags and Tracking Flags

  // Prepare the timeline and comment form
  this.timeline = new BzDeck.views.BugTimeline(this.id, this.bug, this.$bug, delayed);
  this.comment_form = new BzDeck.views.BugCommentForm(this.id, this.bug, this.$bug),
  this.activate_widgets();

  this.helpers.event.async(() => {
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

BzDeck.views.Bug.prototype.activate_widgets = function () {
  this.comboboxes = new WeakMap();
  this.on('BugController:FieldEdited', data => this.on_field_edited(data.name, data.value));

  let can_editbugs = BzDeck.models.account.permissions.includes('editbugs'),
      is_closed = value => BzDeck.models.server.data.config.field.status.closed.includes(value);

  for (let $fieldset of this.$bug.querySelectorAll('.bug-fieldset')) {
    let category = $fieldset.dataset.category,
        $edit_button = $fieldset.querySelector('h3 + [role="button"][data-command="edit"]');

    if ($edit_button) {
      $edit_button.setAttribute('aria-disabled', !can_editbugs);

      new this.widgets.Button($edit_button).bind('Pressed', event =>
          this.trigger('BugView:EditModeChanged', { category, enabled: event.detail.pressed }));
    }
  }

  for (let $section of this.$bug.querySelectorAll('[data-field]')) {
    let name = $section.dataset.field,
        $combobox = $section.querySelector('[role="combobox"][aria-readonly="true"]'),
        $textbox = $section.querySelector(':not([role="combobox"]) > [contenteditable]'),
        $next_field = $section.nextElementSibling;

    // Activate comboboxes
    if ($combobox) {
      let $$combobox = new this.widgets.ComboBox($combobox);

      this.comboboxes.set($combobox, $$combobox);
      $combobox.setAttribute('aria-disabled', !can_editbugs);
      $$combobox.build([for (value of this.get_field_values(name)) { value, selected: value === this.bug[name] }]);
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

        if ($target.matches('[itemprop][itemtype$="Person"]') && !$target.title) {
          $target.title = $target.properties.description[0].itemValue + '\n' + $target.properties.email[0].itemValue;
        }
      });
    }
  }

  this.update_resolution_ui(this.bug.resolution);
};

BzDeck.views.Bug.prototype.get_field_values = function (field_name, product_name = this.bug.product) {
  let { field, product } = BzDeck.models.server.data.config,
      { component, version_detail, target_milestone_detail } = product[product_name];

  let values = {
    product: [for (name of Object.keys(product).sort()) if (product[name].is_active) name],
    component: [for (name of Object.keys(component).sort()) if (component[name].is_active) name],
    version: [for (version of version_detail) if (version.is_active) version.name],
    target_milestone: [for (milestone of target_milestone_detail) if (milestone.is_active) milestone.name],
    status: field.status.transitions[this.bug.status], // The order matters
  };

  return values[field_name] || field[field_name].values;
};

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

BzDeck.views.Bug.prototype.on_field_edited = function (name, value) {
  if (name === 'product') {
    let product_name = value;

    // When the Product is updated, the Version, Component, Target Milestone have to be updated as well
    for (let field_name of ['version', 'component', 'target_milestone']) {
      this.comboboxes.get(this.$bug.querySelector(`[data-field="${field_name}"] [role="combobox"]`))
          .build([for (value of this.get_field_values(field_name, product_name)) { value, selected: false }]);
    }
  }

  let $field = this.$bug.querySelector(`[data-field="${name}"]`),
      $combobox = $field ? $field.querySelector('[role="combobox"][aria-readonly="true"]') : undefined,
      $textbox = $field ? $field.querySelector(':not([role="combobox"]) > [contenteditable]') : undefined;

  if ($combobox) {
    this.comboboxes.get($combobox).selected = value;
  }

  if ($textbox && $textbox.itemValue !== String(value)) {
    $textbox.itemValue = value;
  }

  if (name === 'resolution') {
    this.update_resolution_ui(value);
  }
};

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

BzDeck.views.Bug.prototype.set_bug_tooltips = function () {
  let related_ids = new Set([for ($element of this.$bug.querySelectorAll('[data-bug-id]'))
                             Number.parseInt($element.getAttribute('data-bug-id'))]);

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

  if (related_ids.size) {
    let bugs = BzDeck.collections.bugs.get_some(related_ids),
        lookup_ids = new Set([for (id of related_ids) if (!bugs.get(id)) id]);

    bugs.forEach(bug => set_tooltops(bug));

    // BzDeck.collections.bugs.fetch() fails when one or more bugs in the result are private, so retrieve each bug
    // individually (Bug 1169040)
    for (let id of lookup_ids) {
      BzDeck.collections.bugs.get(id, { id, _unread: true }).fetch(true, false).then(bug => set_tooltops(bug));
    }
  }
};

BzDeck.views.Bug.prototype.update = function (bug, changes) {
  this.bug = bug;

  let $timeline = this.$bug.querySelector('.bug-timeline');

  if ($timeline) {
    $timeline.querySelector('.comments-wrapper')
             .appendChild(new BzDeck.views.BugTimelineEntry(this.id, this.bug, changes));
    $timeline.querySelector('.comments-wrapper > article:last-of-type')
             .scrollIntoView({ block: 'start', behavior: 'smooth' });
  }

  if (changes.has('attachment') && this.render_attachments) {
    this.$$attachments.render([changes.get('attachment')]);
    this.$tablist.querySelector('[id$="-tab-attachments"]').setAttribute('aria-disabled', 'false');
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
