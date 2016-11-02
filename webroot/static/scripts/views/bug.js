/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug View that represents the Preview Pane content on the Advanced Search page. The Home page and Bug
 * Details page uses BugDetailsView instead.
 * @extends BzDeck.BaseView
 */
BzDeck.BugView = class BugView extends BzDeck.BaseView {
  /**
   * Get a BugView instance.
   * @constructor
   * @param {String} container_id - Unique instance identifier of the parent container view.
   * @param {Number} bug_id - Bug ID to show.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Object} view - New BugView instance.
   */
  constructor (container_id, bug_id, siblings) {
    super(); // Assign this.id

    this.container_id = container_id;
    this.bug_id = bug_id;
    this.siblings = siblings;
    this.$bug = this.get_template('bug-details-template', this.id);

    this.$bug.setAttribute('data-bug-id', this.bug_id);
    this.$bug.setAttribute('aria-busy', 'true');
    this.$bug.setAttribute('aria-hidden', 'true');

    // Subscribe to events
    this.subscribe_safe('BugPresenter#BugDataAvailable');
    this.subscribe('BugPresenter#BugDataUnavailable');

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.BugPresenter(this.id, this.container_id, this.bug_id, this.siblings);

    // Load the bug
    (async () => this.trigger('BugView#Initialized'))();
  }

  /**
   * Called when the bug data is found. Prepare the newly opened tabpanel.
   * @listens BugPresenter#BugDataAvailable
   * @param {Proxy} bug - Bug to show.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bug_data_available ({ bug, siblings } = {}) {
    this.bug = bug;
    this.render();
    this.init_att_drop_target();

    // Custom scrollbars
    this.scrollbars = new Set([...this.$bug.querySelectorAll('.scrollable')]
                                  .map($area => new FlareTail.widgets.ScrollBar($area)));

    this.subscribe_safe('BugModel#AnnotationUpdated', true); // Enable the global option
    this.subscribe_safe('BugModel#Updated', true); // Cannot be 'M#Updated' because it doesn't work in BugDetailsView
    this.subscribe_safe('BugView#FilesSelected');
  }

  /**
   * Called when an error was encountered while fetching the bug data. Show the error message.
   * @listens BugContainerPresenter#BugDataUnavailable
   * @param {Number} code - Error code usually defined by Bugzilla.
   * @param {String} message - Error message text.
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bug_data_unavailable ({ code, message } = {}) {
    let $error = this.fill(this.get_template('bug-details-error-template', this.bug_id), {
      id: this.bug_id,
      status: message,
    }, {
      'data-error-code': code,
    });

    this.$bug.parentElement.replaceChild($error, this.$bug);
  }

  /**
   * Set up menu items on the toolbar.
   * @param {undefined}
   * @returns {undefined}
   */
  setup_toolbar () {
    let $button = this.$bug.querySelector('[data-command="show-menu"]');

    if (!$button) {
      return;
    }

    new FlareTail.widgets.Button($button);

    let $timeline = this.$bug.querySelector('.bug-timeline');
    let $menu = document.getElementById($button.getAttribute('aria-owns'));
    let $toggle_comments = $menu.querySelector('[id$="--toggle-comments"]');
    let $toggle_cc = $menu.querySelector('[id$="--toggle-cc"]');
    let $copy_link = $menu.querySelector('[data-command="copy-link"]');
    let $bugzilla_link = $menu.querySelector('[data-command="open-bugzilla"]');
    let $tweet_link = $menu.querySelector('[data-command="tweet"]');

    let toggle_cc = value => {
      BzDeck.prefs.set('ui.timeline.show_cc_changes', value);
      document.documentElement.setAttribute('data-ui-timeline-show-cc-changes', String(value));
    };

    let handlers = {
      'show-cc': () => toggle_cc(true),
      'hide-cc': () => toggle_cc(false),
      'expand-comments': () => this.timeline.expand_comments(),
      'collapse-comments': () => this.timeline.collapse_comments(),
      'open-tab': () => this.trigger('BugView#OpeningTabRequested'),
    };

    $menu.addEventListener('MenuOpened', async event => {
      let collapsed = !!$timeline.querySelectorAll('.read-comments-expander, \
                                                    [itemprop="comment"][aria-expanded="false"]').length;

      let show_cc_changes = await BzDeck.prefs.get('ui.timeline.show_cc_changes');
      let cc_shown = !!show_cc_changes;

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
      $bugzilla_link.href = `${BzDeck.host.origin}/show_bug.cgi?id=${this.bug.id}&redirect=no`;
    }

    if ($tweet_link) {
      // https://dev.twitter.com/web/tweet-button/web-intent
      let summary = this.bug.summary.substr(0, 80) + (this.bug.summary.length > 80 ? '...' : '');
      let href = 'https://twitter.com/intent/tweet?via=BzDeck'
               + '&text=' + encodeURIComponent(`Bug ${this.bug.id} - ${summary}`)
               + '&url=' + encodeURIComponent(`${location.origin}/bug/${this.bug.id}`);

      $tweet_link.href = href;
    }

    // Set Back & Forward navigation
    if (this.siblings.length) {
      this.setup_navigation();
    }
  }

  /**
   * Set up the Back and Forward navigation when applicable, including the toolbar buttons and keyboard shortcuts.
   * @param {undefined}
   * @returns {undefined}
   */
  setup_navigation () {
    let Button = FlareTail.widgets.Button;
    let $toolbar = this.$bug.querySelector('[role="toolbar"]');
    let $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]'));
    let $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]'));
    let index = this.siblings.indexOf(this.bug_id);
    let prev = this.siblings[index - 1];
    let next = this.siblings[index + 1];
    let assign_key_binding = (key, command) => FlareTail.helpers.kbd.assign(this.$bug, { [key]: command });

    let set_button_tooltip = async (id, $$button) => {
      let bug = await BzDeck.collections.bugs.get(id);

      $$button.view.$button.title = bug && bug.summary ? `Bug ${id}\n${bug.summary}` : `Bug ${id}`; // l10n
    };

    if (prev) {
      set_button_tooltip(prev, $$btn_back);
      $$btn_back.data.disabled = false;
      $$btn_back.bind('Pressed', event => this.navigate(prev));
      assign_key_binding('B', event => this.navigate(prev));
    } else {
      $$btn_back.data.disabled = true;
    }

    if (next) {
      set_button_tooltip(next, $$btn_forward);
      $$btn_forward.data.disabled = false;
      $$btn_forward.bind('Pressed', event => this.navigate(next));
      assign_key_binding('F', event => this.navigate(next));
    } else {
      $$btn_forward.data.disabled = true;
    }

    // Prepare the Back button on the mobile banner
    BzDeck.views.banner.add_back_button(this.$bug);
  }

  /**
   * Switch to another bug within the same tab through the Back and Forward navigation.
   * @param {Number} new_id - ID of the bug to show next.
   * @fires BugContainerView#NavigationRequested
   * @returns {undefined}
   */
  navigate (new_id) {
    this.trigger('BugView#NavigationRequested', { container_id: this.container_id, old_id: this.bug_id, new_id });
  }

  /**
   * Render the bug and, activate the toolbar buttons and assign keyboard shortcuts.
   * @param {undefined}
   * @fires BugView#EditModeChanged
   * @fires BugView#OpeningTabRequested
   * @fires AnyView#TogglingPreviewRequested
   * @returns {undefined}
   */
  render () {
    if (!this.bug.summary && !this.bug._update_needed) {
      // The bug is being loaded
      return;
    }

    this.setup_toolbar();

    let _bug = {};
    let get_user = name => BzDeck.collections.users.get(name, { name }); // Promise

    (async () => {
      await Promise.all(BzDeck.config.grid.default_columns.map(async ({ id: field, type } = {}) => {
        if (this.bug[field] !== undefined) {
          if (field === 'keywords') {
            _bug.keyword = this.bug.keywords;
          } else if (field === 'mentors') {
            let mentors = await Promise.all(this.bug.mentors.map(name => get_user(name)));

            _bug.mentor = mentors.map(mentor => mentor.properties);
          } else if (type === 'person') {
            if (this.bug[field] && !this.bug[field].startsWith('nobody@')) { // Is this BMO-specific?
              let user = await get_user(this.bug[field]);

              _bug[field] = user.properties;
            }
          } else {
            _bug[field] = this.bug[field] || '';
          }
        }
      }));

      // Other Contributors, excluding Cc
      let contributors = await Promise.all([...this.bug.contributors]
          .filter(name => !this.bug.cc.includes(name)).map(name => get_user(name)));

      _bug.contributor = contributors.map(contributor => contributor.properties);

      this.fill(this.$bug, _bug);
      this.set_product_tooltips();
    })();

    let init_button = ($button, handler) => (new FlareTail.widgets.Button($button)).bind('Pressed', handler);
    let can_editbugs = BzDeck.account.permissions.includes('editbugs');
    let $star_button = this.$bug.querySelector('[role="button"][data-command="star"]');
    let $edit_button = this.$bug.querySelector('[role="button"][data-command="edit"]');
    let $container = this.$bug.closest('.bug-container');
    let $timeline_tab = this.$bug.querySelector('[id$="-tab-timeline"]');
    let $timeline = this.$bug.querySelector('.bug-timeline');

    if ($star_button) {
      $star_button.setAttribute('aria-pressed', this.bug.starred);
      init_button($star_button, event => this.bug.starred = event.detail.pressed);
    }

    if ($edit_button) {
      $edit_button.setAttribute('aria-disabled', !can_editbugs);

      init_button($edit_button, event => {
        this.trigger('BugView#EditModeChanged', { enabled: event.detail.pressed });

        if ($container.matches('[aria-expanded]')) {
          // Toggle the bug container
          this.trigger('AnyView#ExpandingBugContainerRequested', { container_id: this.container_id });

          // Select the Timeline tab when the bug container is collapsed
          if (this.$$tablist && $container.matches('[aria-expanded="true"]')) {
            this.$$tablist.view.selected = this.$$tablist.view.$focused = $timeline_tab;
          }
        }
      });
    }

    if (!$timeline) {
      return;
    }

    $timeline.setAttribute('aria-busy', 'true');

    // Empty timeline while keeping the scrollbar
    for (let $comment of $timeline.querySelectorAll('article, [role="form"], .read-comments-expander')) {
      $comment.remove();
    }

    (async () => {
      if (this.bug.comments && !this.bug._update_needed) {
        this.fill_details(false);
      } else {
        // Load comments, history, flags and attachments' metadata; Exclude metadata
        this.bug = await this.bug.fetch(false);
        this.fill_details(true);
      }
    })();

    // Focus management
    let set_focus = async shift => {
      let order = await BzDeck.prefs.get('ui.timeline.sort.order');
      let ascending = order !== 'descending';
      let entries = [...$timeline.querySelectorAll('[itemprop="comment"]')];

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
      FlareTail.helpers.kbd.assign($timeline, {
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

    if (this.$tablist && this.$tablist.querySelector('[id$="history"]')) {
      this.$tablist.querySelector('[id$="history"]').setAttribute('aria-disabled', !(this.bug.history || []).length);
    }
  }

  /**
   * Render the bug data on the view.
   * @param {Boolean} delayed - Whether the bug details including comments and attachments will be rendered later.
   * @fires AnyView#OpeningBugRequested
   * @fires BugView#RenderingComplete
   * @returns {Promise.<undefined>}
   */
  async fill_details (delayed) {
    // When the comments and history are loaded async, the template can be removed
    // or replaced at the time of call, if other bug is selected by user
    if (!this.$bug) {
      return;
    }

    let _cc = await Promise.all(this.bug.cc.map(name => BzDeck.collections.users.get(name, { name })));

    let _bug = {
      cc: _cc.map(person => person.properties),
      depends_on: this.bug.depends_on,
      blocks: this.bug.blocks,
      see_also: this.bug.see_also,
      dupe_of: this.bug.dupe_of || undefined,
      duplicate: this.bug.duplicates,
    };

    this.fill(this.$bug, _bug);

    // Depends on, Blocks and Duplicates
    for (let $li of this.$bug.querySelectorAll('[itemprop="depends_on"], [itemprop="blocks"], \
                                                [itemprop="duplicate"]')) {
      $li.setAttribute('data-bug-id', $li.textContent);

      (new FlareTail.widgets.Button($li)).bind('Pressed', event => {
        this.trigger('AnyView#OpeningBugRequested', { id: Number(event.target.textContent) });
      });
    }

    // See Also
    for (let $link of this.$bug.querySelectorAll('[itemprop="see_also"]')) {
      let re = new RegExp(`^${BzDeck.host.origin}/show_bug.cgi\\?id=(\\d+)$`.replace(/\./g, '\\.'));
      let match = $link.href.match(re);

      if (match) {
        $link.text = match[1];
        $link.setAttribute('data-bug-id', match[1]);
        $link.setAttribute('role', 'button');
      } else {
        $link.text = $link.href;
      }
    }

    // Prepare the timeline and comment form
    this.timeline = new BzDeck.BugTimelineView(this.id, this.bug, this.$bug, delayed);
    this.comment_form = new BzDeck.BugCommentFormView(this.id, this.bug, this.$bug),
    this.activate_widgets();

    // Add tooltips to the related bugs
    this.set_bug_tooltips();

    // Flags, only on the details tabs
    if (this.render_tracking_flags) {
      new BzDeck.BugFlagsView(this.id, this.bug).render(this.$bug.querySelector('[data-category="flags"]'));
      this.render_tracking_flags();
    }

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

    this.$bug.removeAttribute('aria-busy');
    this.trigger('BugView#RenderingComplete', { container_id: this.container_id, bug_id: this.bug_id });
  }

  /**
   * Activate the UI widgets such as textboxes and comboboxes.
   * @listens BugView#EditModeChanged
   * @param {undefined}
   * @fires BugView#EditField
   * @returns {undefined}
   */
  activate_widgets () {
    this.comboboxes = new WeakMap();
    this.subscribe('BugModel#FieldEdited', true);

    let can_editbugs = BzDeck.account.permissions.includes('editbugs');
    let is_closed = value => BzDeck.host.data.config.field.status.closed.includes(value);
    let editing = this.$bug.closest('.bug-container').matches('[aria-expanded="true"]');

    // Iterate over the fields except the Flags section which is activated by BugFlagsView
    for (let $section of this.$bug.querySelectorAll('[data-field]:not([itemtype$="/Flag"])')) {
      let name = $section.dataset.field;
      let is_status_field = ['status', 'resolution', 'dupe_of'].includes(name);
      let toggle;
      let $combobox = $section.querySelector('[role="combobox"][aria-readonly="true"]');
      let $textbox = $section.querySelector('[role="textbox"]');
      let $next_field = $section.nextElementSibling;

      // Activate comboboxes
      if ($combobox) {
        let $$combobox = new FlareTail.widgets.ComboBox($combobox);

        this.comboboxes.set($combobox, $$combobox);

        $combobox.setAttribute('aria-readonly', !can_editbugs);

        toggle = disabled => $combobox.setAttribute('aria-disabled', disabled && !is_status_field);
        toggle(!editing);
        this.on('BugView#EditModeChanged', ({ enabled } = {}) => toggle(!enabled));

        $$combobox.build_dropdown(this.get_field_values(name)
            .map(value => ({ value, selected: value === this.bug[name] })));
        $$combobox.bind('Change', event => {
          let value = event.detail.value;

          this.trigger('BugView#EditField', { name, value });

          if (name === 'status' && is_closed(value) && $next_field.matches('[data-field="resolution"]') ||
              name === 'resolution' && value === 'DUPLICATE' && $next_field.matches('[data-field="dupe_of"]')) {
            window.setTimeout(() => $next_field.querySelector('[role="textbox"], [role="searchbox"]').focus(), 100);
          }
        });
      }

      // Activate textboxes
      if ($textbox) {
        let $$textbox = new FlareTail.widgets.TextBox($textbox);

        $textbox.tabIndex = 0;
        $textbox.setAttribute('aria-readonly', !can_editbugs);
        $$textbox.bind('focus', event => $textbox.spellcheck = true);
        $$textbox.bind('blur', event => $textbox.spellcheck = false);
        $$textbox.bind('input', event => this.trigger('BugView#EditField', { name, value: $$textbox.value }));
        $$textbox.bind('cut', event => this.trigger('BugView#EditField', { name, value: $$textbox.value }));
        $$textbox.bind('paste', event => this.trigger('BugView#EditField', { name, value: $$textbox.value }));

        toggle = enabled => {
          $textbox.contentEditable = $textbox.spellcheck = enabled && can_editbugs;
          $textbox.setAttribute('aria-disabled', !enabled);
        };

        toggle(editing);
        this.on('BugView#EditModeChanged', ({ enabled } = {}) => toggle(enabled));
      }

      // URL
      if (name === 'url') {
        this.activate_url_widget($section, editing);
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
      let $participants = this.$bug.querySelector('.bug-participants');

      if ($participants) {
        // Add a tooltop for each person; should be replaced by a rich tooltip (#80)
        $participants.addEventListener('mouseover', event => {
          let $target = event.target;

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
   * @listens BugView#EditModeChanged
   * @param {HTMLElement} $section - Outer element.
   * @param {Boolean} editing - Whether the bug is in the edit mode.
   * @fires BugView#EditField
   * @returns {undefined}
   */
  activate_url_widget ($section, editing) {
    let toggle = disabled => {
      let $link = $section.querySelector('a');
      let $textbox = $section.querySelector('input');

      if (!disabled) {
        let orignal_value = $link.getAttribute('href');

        $textbox = document.createElement('input');
        $textbox.className = 'distinct';
        $textbox.type = 'url';
        $textbox.value = orignal_value;
        $textbox.setAttribute('role', 'textbox');
        $textbox.setAttribute('itemprop', 'url');
        $section.replaceChild($textbox, $link);

        $textbox.addEventListener('input', event => this.trigger('BugView#EditField', {
          name: 'url', value: $textbox.validity.valid ? $textbox.value : orignal_value
        }));
      } else if (!$link) {
        $link = document.createElement('a');
        $link.href = $link.title = $textbox.value;
        $link.text = $textbox.value.replace(/^https?:\/\//, '').replace(/\/$/, '');
        $link.setAttribute('role', 'link');
        $link.setAttribute('itemprop', 'url');
        $section.replaceChild($link, $textbox);
      }
    };

    toggle(!editing);
    this.on('BugView#EditModeChanged', ({ enabled } = {}) => toggle(!enabled));
  }

  /**
   * Initialize the attachment drag & drop support.
   * @param {undefined}
   * @fires BugView#FilesSelected
   * @fires BugView#AttachText
   * @returns {Boolean} result - Whether the attachment drop target is found and initialized.
   */
  init_att_drop_target () {
    let timer;
    let $target = this.$bug.querySelector('.att-drop-target');

    if (!$target) {
      return false;
    }

    this.$bug.addEventListener('dragover', event => {
      let dt = event.dataTransfer;

      event.preventDefault();

      // Use a timer to hide the drop target, because the dragleave event is not fired in Firefox when the mouse pointer
      // leaves the target by crossing one of the borders shared with the window. (Bug 656164)
      window.clearTimeout(timer);
      timer = window.setTimeout(() => $target.setAttribute('aria-dropeffect', 'none'), 200);

      // Ignore Blob
      if (dt.getData('text/uri-list').startsWith('blob:')) {
        return false;
      }

      if (!$target.getAttribute('aria-dropeffect') !== 'copy') {
        $target.setAttribute('aria-dropeffect', 'copy');
      }

      dt.dropEffect = dt.effectAllowed = 'copy';

      return true;
    });

    this.$bug.addEventListener('drop', event => {
      let dt = event.dataTransfer;

      event.preventDefault();

      // Ignore Blob
      if (dt.getData('text/uri-list').startsWith('blob:')) {
        return false;
      }

      if (dt.types.contains('Files')) {
        this.trigger_safe('BugView#FilesSelected', { input: dt });
      } else if (dt.types.contains('text/plain')) {
        this.trigger('BugView#AttachText', { text: dt.getData('text/plain') });
      }

      return true;
    });

    return true;
  }

  /**
   * Get product-dependent field values that will be displayed in a combobox.
   * @param {String} field_name - One of the following bug field names: product, component, version, target_milestone
   *  and status.
   * @param {String} [product_name] - The default is the bug's product name, but it could be different when the user
   *  attempts to change the product.
   * @returns {Array} values - Field values.
   */
  get_field_values (field_name, product_name = this.bug.product) {
    let { field, product } = BzDeck.host.data.config;
    let { component, version_detail, target_milestone_detail } = product[product_name];

    let values = {
      product: Object.keys(product).filter(name => product[name].is_active).sort(),
      component: Object.keys(component).filter(name => component[name].is_active).sort(),
      version: version_detail.filter(version => version.is_active).map(version => version.name),
      target_milestone: target_milestone_detail.filter(ms => ms.is_active).map(ms => ms.name),
      status: field.status.transitions[this.bug.status], // The order matters
    };

    return values[field_name] || field[field_name].values;
  }

  /**
   * Update the Resolution field UI when the Status is changed.
   * @param {String} resolution - FIXED, DUPLICATE, etc.
   * @returns {undefined}
   */
  update_resolution_ui (resolution) {
    let is_open = resolution === '';
    let is_dupe = resolution === 'DUPLICATE';
    let can_editbugs = BzDeck.account.permissions.includes('editbugs');
    let $resolution = this.$bug.querySelector('[data-field="resolution"]');
    let $combobox = $resolution.querySelector('[role="combobox"]');
    let $dupe_of = this.$bug.querySelector('[data-field="dupe_of"]');
    let $dupe_of_prop = $dupe_of.querySelector('[itemprop="dupe_of"]');

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
   * Called whenever any field is edited by the user. Update the relevante widget accordingly.
   * @listens BugModel#FieldEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} name - Field name.
   * @param {String} value - Field value.
   * @returns {undefined}
   */
  on_field_edited ({ bug_id, name, value } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    if (name === 'product') {
      let product_name = value;

      // When the Product is updated, the Version, Component, Target Milestone have to be updated as well
      for (let field_name of ['version', 'component', 'target_milestone']) {
        this.comboboxes.get(this.$bug.querySelector(`[data-field="${field_name}"] [role="combobox"]`))
            .build_dropdown(this.get_field_values(field_name, product_name).map(value => ({ value, selected: false })));
      }
    }

    let $field = this.$bug.querySelector(`[data-field="${name}"]`);
    let $combobox = $field ? $field.querySelector('[role="combobox"][aria-readonly="true"]') : undefined;
    let $textbox = $field ? $field.querySelector('[role="textbox"]') : undefined;

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

  /**
   * Called when the user selected files to attach through an input form control or drag and drop operation. If the
   * browser supports the new FileSystem API, look for the files and directories recursively. Otherwise, utilize the
   * traditional File API to identify the files. In any case, notify the selected files to the presenter.
   * @listens BugView#FilesSelected
   * @param {(HTMLInputElement|DataTransfer)} input - Data source.
   * @fires BugView#AttachFiles
   * @returns {undefined}
   */
  on_files_selected ({ input } = {}) {
    let iterate = items => {
      for (let item of items) if (typeof item.getFilesAndDirectories === 'function') {
        (async () => iterate(await item.getFilesAndDirectories()))();
      } else {
        this.trigger_safe('BugView#AttachFiles', { files: [item] });
      }
    };

    if (typeof input.getFilesAndDirectories === 'function') {
      (async () => iterate(await input.getFilesAndDirectories()))();
    } else {
      this.trigger_safe('BugView#AttachFiles', { files: input.files });
    }
  }

  /**
   * Set a tooltip on each product name that shows the Bugzilla-defined description of that product.
   * @param {undefined}
   * @returns {undefined}
   */
  set_product_tooltips () {
    let config = BzDeck.host.data.config;
    let strip_tags = str => FlareTail.helpers.string.strip_tags(str).replace(/\s*\(more\ info\)$/i, '');
    let classification = config.classification[this.bug.classification];
    let product = config.product[this.bug.product];
    let component;
    let $classification = this.$bug.querySelector('[itemprop="classification"]');
    let $product = this.$bug.querySelector('[itemprop="product"]');
    let $component;

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
  }

  /**
   * Set a tooptip on each bug ID that shows the summary and status of that bug.
   * @param {undefined}
   * @returns {Promise.<undefined>}
   */
  async set_bug_tooltips () {
    let related_ids = [...this.$bug.querySelectorAll('[data-bug-id]')]
                                  .map($element => Number.parseInt($element.getAttribute('data-bug-id')));

    if (!related_ids.length) {
      return;
    }

    let set_tooltops = bugs => bugs.forEach(bug => {
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
    });

    let bugs = await BzDeck.collections.bugs.get_some(related_ids);
    let lookup_ids = new Set(related_ids.filter(id => !bugs.get(id)));

    set_tooltops(bugs);

    if (lookup_ids.size) {
      bugs = await BzDeck.collections.bugs.fetch(lookup_ids, true, false);
      set_tooltops(bugs);
    }
  }

  /**
   * Called whenever any bug field is updated on the remote Bugzilla instance. This may be called as part of the
   * periodic fetches or Bugzfeed push notifications.
   * @param {Proxy} bug - Updated BugModel instance.
   * @param {Map.<String, Object>} changes - Change details.
   * @returns {undefined}
   */
  update (bug, changes) {
    this.bug = bug;

    let $timeline = this.$bug.querySelector('.bug-timeline');

    if ($timeline) {
      (async () => {
        let entry = await (new BzDeck.BugTimelineEntryView(this.id, this.bug, changes)).create();

        $timeline.querySelector('.comments-wrapper').appendChild(entry.$outer);
        $timeline.querySelector('.comments-wrapper > article:last-of-type')
                 .scrollIntoView({ block: 'start', behavior: 'smooth' });
      })();
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
  }

  /**
   * Called whenever a bug annotation is updated. Update the Star button on the toolbar.
   * @listens BugModel#AnnotationUpdated
   * @param {Proxy} bug - Changed bug.
   * @param {String} type - Annotation type such as 'starred' or 'unread'.
   * @param {Boolean} value - New annotation value.
   * @returns {undefined}
   */
  on_annotation_updated ({ bug, type, value } = {}) {
    if (this.$bug && bug.id === this.bug.id && type === 'starred') {
      this.$bug.querySelector('header [role="button"][data-command="star"]').setAttribute('aria-pressed', value);
    }
  }

  /**
   * Called whenever any field of a bug is updated. Update the view if the bug ID matches.
   * @listens BugModel#Updated
   * @param {Proxy} bug - Changed bug.
   * @param {Map} changes - Change details.
   * @returns {undefined}
   */
  on_updated ({ bug, changes } = {}) {
    if (bug.id === this.bug.id) {
      this.update(bug, changes);
    }
  }
}
