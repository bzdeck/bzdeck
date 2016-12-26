/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug View that represents the content displayed on the Bug Details page.
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
   * @fires BugView#Initialized
   * @returns {BugView} New BugView instance.
   */
  constructor (container_id, bug_id, siblings = []) {
    super(); // Assign this.id

    this.container_id = container_id;
    this.bug_id = bug_id;
    this.siblings = siblings;
    this.$bug = this.get_template('bug-details-template', `${this.bug_id}-${this.id}`);

    this.$bug.setAttribute('data-bug-id', this.bug_id);
    this.$bug.setAttribute('aria-busy', 'true');
    this.$bug.setAttribute('aria-hidden', 'true');

    // Subscribe to events
    this.subscribe('P#BugDataAvailable');
    this.subscribe('P#BugDataUnavailable');

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.BugPresenter(this.id, this.container_id, this.bug_id, this.siblings);

    // Load the bug
    this.trigger('BugView#Initialized');
  }

  /**
   * Called when the bug data is found. Prepare the newly opened tabpanel.
   * @listens BugPresenter#BugDataAvailable
   * @param {Number} id - Bug ID.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   */
  async on_bug_data_available ({ id, siblings = [] } = {}) {
    this.bug = await BzDeck.collections.bugs.get(id);

    this.init_tablist();
    this.add_mobile_tweaks();
    this.render();
    this.init_att_drop_target();

    // Custom scrollbars
    this.scrollbars = new Set([...this.$bug.querySelectorAll('.scrollable')]
                                  .map($area => new FlareTail.widgets.ScrollBar($area)));

    this.subscribe('M#AnnotationUpdated', true);
    this.subscribe('M#Updated', true);
    this.subscribe('M#BugEdited', true);
    this.subscribe('M#CommentEdited', true);
    this.subscribe('M#Submit', true);
    this.subscribe('M#SubmitProgress', true);
    this.subscribe('M#SubmitSuccess', true);
    this.subscribe('M#SubmitError', true);
    this.subscribe('M#SubmitComplete', true);
    this.subscribe('P#HistoryUpdated');
  }

  /**
   * Called when an error was encountered while fetching the bug data. Show the error message.
   * @listens BugContainerPresenter#BugDataUnavailable
   * @param {Number} code - Error code usually defined by Bugzilla.
   * @param {String} message - Error message text.
   * @returns {Boolean} Whether the view is updated.
   */
  on_bug_data_unavailable ({ code, message } = {}) {
    const $error = this.fill(this.get_template('bug-details-error-template', `${this.bug_id}-${this.id}`), {
      id: this.bug_id,
      status: message,
    }, {
      'data-error-code': code,
    });

    this.$bug.parentElement.replaceChild($error, this.$bug);
  }

  /**
   * Set up menu items on the toolbar.
   */
  setup_toolbar () {
    const $button = this.$bug.querySelector('[data-command="show-menu"]');

    if (!$button) {
      return;
    }

    new FlareTail.widgets.Button($button);

    const $timeline = this.$bug.querySelector('.bug-timeline');
    const $star_button = this.$bug.querySelector('[role="button"][data-command="star"]');
    const $menu = document.getElementById($button.getAttribute('aria-owns'));
    const $toggle_comments = $menu.querySelector('[id$="-toggle-comments"]');
    const $toggle_cc = $menu.querySelector('[id$="-toggle-cc"]');
    const $copy_link = $menu.querySelector('[data-command="copy-link"]');
    const $bugzilla_link = $menu.querySelector('[data-command="open-bugzilla"]');
    const $tweet_link = $menu.querySelector('[data-command="tweet"]');

    const toggle_cc = value => {
      BzDeck.prefs.set('ui.timeline.show_cc_changes', value);
      document.documentElement.setAttribute('data-ui-timeline-show-cc-changes', String(value));
    };

    const handlers = {
      'show-cc': () => toggle_cc(true),
      'hide-cc': () => toggle_cc(false),
      'expand-comments': () => this.$$timeline.expand_comments(),
      'collapse-comments': () => this.$$timeline.collapse_comments(),
    };

    $star_button.setAttribute('aria-pressed', this.bug.starred);
    (new FlareTail.widgets.Button($star_button)).bind('Pressed', event => this.bug.starred = event.detail.pressed);

    $menu.addEventListener('MenuOpened', async event => {
      const collapsed = !!$timeline.querySelectorAll('.read-comments-expander, \
                                                      [itemprop="comment"][aria-expanded="false"]').length;

      const show_cc_changes = await BzDeck.prefs.get('ui.timeline.show_cc_changes');
      const cc_shown = !!show_cc_changes;

      $toggle_comments.setAttribute('aria-disabled', !this.$$timeline);
      $toggle_comments.setAttribute('data-command', collapsed ? 'expand-comments' : 'collapse-comments');
      $toggle_comments.firstElementChild.textContent = collapsed ? 'Expand All Comments' : 'Collapse All Comments';
      $toggle_cc.setAttribute('aria-disabled', !this.$$timeline);
      $toggle_cc.setAttribute('data-command', cc_shown ? 'hide-cc': 'show-cc');
      $toggle_cc.firstElementChild.textContent = cc_shown ? 'Hide CC Changes' : 'Show CC Changes';
    });

    $menu.addEventListener('MenuItemSelected', event => (handlers[event.detail.command] || (() => {}))());

    if ($copy_link) {
      $copy_link.addEventListener('mousedown', event => event.stopPropagation());
      $copy_link.addEventListener('click', event => document.execCommand('copy'));
      $copy_link.addEventListener('copy', event => {
        const url = `${location.origin}/bug/${this.bug.id}`;

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
      const summary = this.bug.summary.substr(0, 80) + (this.bug.summary.length > 80 ? '...' : '');
      const href = 'https://twitter.com/intent/tweet?via=BzDeck'
                 + '&text=' + encodeURIComponent(`Bug ${this.bug.id} - ${summary}`)
                 + '&url=' + encodeURIComponent(`${location.origin}/bug/${this.bug.id}`);

      $tweet_link.href = href;
    }

    // Set Back & Forward navigation
    if (this.siblings.length) {
      this.setup_navigation();
    }

    // Activate footer widgets
    this.$submit_button = this.$bug.querySelector('footer [data-command="submit"]');
    (new FlareTail.widgets.Button(this.$submit_button)).bind('Pressed', event => this.trigger('#Submit'));
    this.$statusbar = this.$bug.querySelector('footer [role="status"]');
  }

  /**
   * Set up the Back and Forward navigation when applicable, including the toolbar buttons and keyboard shortcuts.
   */
  setup_navigation () {
    const Button = FlareTail.widgets.Button;
    const $toolbar = this.$bug.querySelector('[role="toolbar"]');
    const $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]'));
    const $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]'));
    const index = this.siblings.indexOf(this.bug_id);
    const prev = this.siblings[index - 1];
    const next = this.siblings[index + 1];
    const assign_key_binding = (key, command) => FlareTail.util.Keybind.assign(this.$bug, { [key]: command });

    const set_button_tooltip = async (id, $$button) => {
      const bug = await BzDeck.collections.bugs.get(id);

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
    BzDeck.views.global.add_back_button(this.$bug);
  }

  /**
   * Switch to another bug within the same tab through the Back and Forward navigation.
   * @param {Number} new_id - ID of the bug to show next.
   * @fires BugContainerView#NavigationRequested
   */
  navigate (new_id) {
    this.trigger('#NavigationRequested', { container_id: this.container_id, old_id: this.bug_id, new_id });
  }

  /**
   * Start rendering the bug.
   * @fires BugView#OpeningTabRequested
   * @fires AnyView#TogglingPreviewRequested
   */
  async render () {
    if (!this.bug.summary && !this.bug._update_needed) {
      // The bug is being loaded
      return;
    }

    this.setup_toolbar();

    (async () => {
      if (this.bug.comments && !this.bug._update_needed) {
        this.fill_details(false);
      } else {
        // Load comments, history, flags and attachments' metadata; Exclude metadata
        this.bug = await this.bug.fetch(false);
        this.fill_details(true);
      }
    })();
  }

  /**
   * Render the bug data on the view.
   * @param {Boolean} delayed - Whether the bug details including comments and attachments will be rendered later.
   * @fires AnyView#OpeningBugRequested
   * @fires BugView#RenderingComplete
   */
  async fill_details (delayed) {
    // When the comments and history are loaded async, the template can be removed
    // or replaced at the time of call, if other bug is selected by user
    if (!this.$bug) {
      return;
    }

    // Prepare the timeline and comment form
    this.$$timeline = new BzDeck.BugTimelineView(this.id, this.$bug, delayed);
    this.$$timeline.render(this.bug);
    this.$$comment_form = new BzDeck.BugCommentFormView(this.id, this.bug, this.$bug),

    // Render the Info tab content
    this.$$info = new BzDeck.BugInfoView(this.id, this.$bug);
    this.$$info.render(this.bug);

    this.render_attachments();
    this.render_history();
    this.add_tab_badges();
    this.set_product_tooltips();
    this.set_bug_tooltips();

    if (this.$tablist.querySelector('[id$="history"]')) {
      this.$tablist.querySelector('[id$="history"]').setAttribute('aria-disabled', !(this.bug.history || []).length);
    }

    this.$bug.removeAttribute('aria-busy');
    this.trigger('#RenderingComplete', { container_id: this.container_id, bug_id: this.bug_id });
  }

  /**
   * Initialize the attachment drag & drop support.
   * @fires BugView#AttachText
   * @returns {Boolean} Whether the attachment drop target is found and initialized.
   */
  init_att_drop_target () {
    const $target = this.$bug.querySelector('.att-drop-target');
    let timer;

    if (!$target) {
      return false;
    }

    // Listen custom events to get files
    this.$bug.addEventListener('FilesSelected', event => this.on_files_selected(event.detail.input));

    this.$bug.addEventListener('dragover', event => {
      const dt = event.dataTransfer;

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
      const dt = event.dataTransfer;

      event.preventDefault();

      // Ignore Blob
      if (dt.getData('text/uri-list').startsWith('blob:')) {
        return false;
      }

      if (dt.types.includes('Files')) {
        this.on_files_selected(dt);
      } else if (dt.types.includes('text/plain')) {
        this.trigger('#AttachText', { text: dt.getData('text/plain') });
      }

      return true;
    });

    return true;
  }

  /**
   * Called when the user selected files to attach through an input form control or drag and drop operation. If the
   * browser supports the new FileSystem API, look for the files and directories recursively. Otherwise, utilize the
   * traditional File API to identify the files. In any case, notify the selected files to the presenter.
   * @param {(HTMLInputElement|DataTransfer)} input - Data source.
   * @fires BugView#AttachFiles
   */
  on_files_selected (input) {
    const iterate = items => {
      for (const item of items) if (typeof item.getFilesAndDirectories === 'function') {
        (async () => iterate(await item.getFilesAndDirectories()))();
      } else {
        this.trigger('#AttachFiles', { files: [item] });
      }
    };

    if (typeof input.getFilesAndDirectories === 'function') {
      (async () => iterate(await input.getFilesAndDirectories()))();
    } else {
      this.trigger('#AttachFiles', { files: [...input.files] });
    }
  }

  /**
   * Set a tooltip on each product name that shows the Bugzilla-defined description of that product.
   */
  set_product_tooltips () {
    const config = BzDeck.host.data.config;
    const strip_tags = str => FlareTail.util.String.strip_tags(str).replace(/\s*\(more\ info\)$/i, '');
    const classification = config.classification[this.bug.classification];
    const product = config.product[this.bug.product];
    const $classification = this.$bug.querySelector('[itemprop="classification"]');
    const $product = this.$bug.querySelector('[itemprop="product"]');

    if ($classification && classification) {
      $classification.title = strip_tags(classification.description);
    }

    if (!product) {
      return;
    }

    if ($product) {
      $product.title = strip_tags(product.description);
    }

    const component = product.component[this.bug.component];
    const $component = this.$bug.querySelector('[itemprop="component"]');

    if ($component && component) {
      $component.title = strip_tags(component.description);
    }
  }

  /**
   * Set a tooptip on each bug ID that shows the summary and status of that bug.
   */
  async set_bug_tooltips () {
    const related_ids = [...this.$bug.querySelectorAll('[data-bug-id]')]
                                     .map($element => Number.parseInt($element.getAttribute('data-bug-id')));

    if (!related_ids.length) {
      return;
    }

    const set_tooltops = bugs => bugs.forEach(bug => {
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

      for (const $element of this.$bug.querySelectorAll(`[data-bug-id="${bug.id}"]`)) {
        $element.title = title;
        $element.dataset.status = bug.status;
        $element.dataset.resolution = bug.resolution || '';
      }
    });

    let bugs = await BzDeck.collections.bugs.get_some(related_ids);
    const lookup_ids = new Set(related_ids.filter(id => !bugs.get(id)));

    set_tooltops(bugs);

    if (lookup_ids.size) {
      bugs = await BzDeck.collections.bugs.fetch(lookup_ids, true, false);
      set_tooltops(bugs);
    }
  }

  /**
   * Initialize the tablist that switches bug detail tabs.
   */
  init_tablist () {
    const mql = window.matchMedia('(max-width: 1023px)');

    this.$tablist = this.$bug.querySelector('[role="tablist"]');
    this.$att_tab = this.$tablist.querySelector('[id$="-tab-attachments"]');
    this.$$tablist = new FlareTail.widgets.TabList(this.$tablist);
    this.$outline = this.$bug.querySelector('.bug-outline');

    this.$$tablist.bind('Selected', event => {
      const $selected = event.detail.items[0];
      const $tabpanel = this.$bug.querySelector(`#${$selected.getAttribute('aria-controls')}`);

      // Scroll a tabpanel to top when the tab is selected
      $tabpanel.querySelector('.scrollable').scrollTop = 0;

      // Desktop: Show the outline pane only when the timeline tab is selected
      if (!mql.matches && FlareTail.env.device.desktop) {
        this.$outline.setAttribute('aria-hidden', !$selected.matches('[id$="tab-timeline"]'));
      }
    });
  }

  /**
   * Add a UI gimmick for mobile that hides the tabs when scrolled down.
   */
  add_mobile_tweaks () {
    if (!FlareTail.env.device.mobile) {
      return;
    }

    const mql = window.matchMedia('(max-width: 1023px)');

    for (const $content of this.$bug.querySelectorAll('.scrollable')) {
      const info = $content.matches('.bug-info');
      let top = 0;
      let hidden = false;

      $content.addEventListener('scroll', event => {
        if (!mql.matches && info) {
          return;
        }

        const _top = event.target.scrollTop;
        const _hidden = top < _top;

        if (hidden !== _hidden) {
          hidden = _hidden;
          this.$tablist.setAttribute('aria-hidden', hidden);
        }

        top = _top;
      });
    }
  }

  /**
   * Add the number of the comments, attachments and history entries to the each relevant tab as a small badge.
   */
  add_tab_badges () {
    for (const prop of ['comments', 'attachments', 'history']) {
      const tab_name = prop === 'comments' ? 'timeline' : prop;
      const number = (this.bug[prop] || []).length;

      this.$tablist.querySelector(`[id$="tab-${tab_name}"] label`).dataset.badge = number;
    }
  }

  /**
   * Render the Attachments tabpanel content with BugAttachmentsView.
   */
  render_attachments () {
    const mobile = FlareTail.env.device.mobile;
    const mql = window.matchMedia('(max-width: 1023px)');
    const $field = this.$bug.querySelector('[data-field="attachments"]');

    this.$$attachments = new BzDeck.BugAttachmentsView(this.id, this.bug.id, $field);

    if ((this.bug.attachments || []).length) {
      (async () => {
        this.$$attachments.render(await Promise.all(this.bug.attachments.map(att => {
          return BzDeck.collections.attachments.get(att.id);
        })));
      })();
    }

    // Select the first non-obsolete attachment when the Attachment tab is selected for the first time
    this.$$tablist.bind('Selected', event => {
      if (mobile || mql.matches || event.detail.items[0] !== this.$att_tab ||
          this.$$attachments.$listbox.querySelector('[role="option"][aria-selected="true"]')) { // Already selected
        return;
      }

      const $first = this.$$attachments.$listbox.querySelector('[role="option"][aria-disabled="false"]');

      if ($first) {
        this.$$attachments.$$listbox.view.selected = $first;
      }
    });
  }

  /**
   * Render the History tabpanel content with BugHistoryView.
   */
  render_history () {
    const $tab = this.$tablist.querySelector('[id$="-tab-history"]');

    this.$$history = new BzDeck.BugHistoryView(this.id, this.$bug.querySelector('[data-field="history"]'));

    if ((this.bug.history || []).length) {
      this.$$history.render(this.bug.history);
      $tab.setAttribute('aria-disabled', 'false');
    }
  }

  /**
   * Called whenever the location fragment or history state is updated. Switch the tabs when an attachment is selected
   * on the timeline or comment form.
   * @listens BugPresenter#HistoryUpdated
   * @param {Object} [state] - Current history state.
   * @param {String} [state.att_id] - Attachment ID or hash.
   */
  on_history_updated ({ state } = {}) {
    if (state && state.att_id) {
      this.$$tablist.view.selected = this.$$tablist.view.$focused = this.$att_tab;
    }
  }

  /**
   * Called whenever any bug field is updated on the remote Bugzilla instance. This may be called as part of the
   * periodic fetches or Bugzfeed push notifications.
   * @param {Proxy} bug - Updated BugModel instance.
   * @param {Map.<String, Object>} changes - Change details.
   */
  update (bug, changes) {
    this.bug = bug;

    // Update the tab badges
    this.add_tab_badges();

    if (changes.has('attachment')) {
      this.$$attachments.render([changes.get('attachment')]);
    }

    if (changes.has('history')) {
      const _bug = { id: this.bug.id, _update_needed: true };

      // Prep partial data
      for (const { field_name: prop } in changes.get('history').changes) {
        const value = _bug[prop] = this.bug[prop];

        // TEMP: the current fill method doesn't update combobox items, so update manually
        {
          const $combobox = this.$bug.querySelector(`[data-field="${prop}"] [role="combobox"][aria-readonly="true"]`);

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
   * @param {Number} bug_id - Updated bug ID.
   * @param {String} type - Annotation type such as 'starred' or 'unread'.
   * @param {Boolean} value - New annotation value.
   */
  on_annotation_updated ({ bug_id, type, value } = {}) {
    if (this.$bug && bug_id === this.bug.id && type === 'starred') {
      this.$bug.querySelector('header [role="button"][data-command="star"]').setAttribute('aria-pressed', value);
    }
  }

  /**
   * Called whenever any field of a bug is updated. Update the view if the bug ID matches.
   * @listens BugModel#Updated
   * @param {Number} bug_id - Changed bug ID.
   * @param {Map} changes - Change details.
   */
  async on_updated ({ bug_id, changes } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.update(await BzDeck.collections.bugs.get(bug_id), changes);
  }

  /**
   * Called whenever any of the fields, comments or attachments are edited by the user. If there is any change, enable
   * the Submit button. Otherwise, disable it.
   * @listens BugModel#BugEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {Boolean} can_submit - Whether the changes can be submitted immediately.
   */
  on_bug_edited ({ bug_id, can_submit } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$submit_button.setAttribute('aria-disabled', !can_submit);
  }

  /**
   * Called whenever the a comment text is added or removed by the user. Clear the status text.
   * @listens BugModel#CommentEdited
   * @param {Number} bug_id - Changed bug ID.
   * @param {Boolean} has_comment - Whether the comment is empty.
   */
  on_comment_edited ({ bug_id, has_comment } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$statusbar.textContent = '';
  }

  /**
   * Called whenever the changes are about to be submitted to Bugzilla. Disable the Submit button and update the
   * statusbar message.
   * @listens BugModel#Submit
   * @param {Number} bug_id - Changed bug ID.
   */
  on_submit ({ bug_id } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$statusbar.textContent = 'Submitting...';
    this.$submit_button.setAttribute('aria-disabled', 'true');
  }

  /**
   * Called whenever the upload of a new attachment is in progress. Show the current status on the statusbar.
   * @listens BugModel#SubmitProgress
   * @param {Number} bug_id - Changed bug ID.
   * @param {Number} total - Total size of attachments.
   * @param {Number} uploaded - Uploaded size of attachments.
   * @param {Number} percentage - Uploaded percentage.
   * @todo Use a progressbar (#159)
   */
  on_submit_progress ({ bug_id, total, uploaded, percentage } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$statusbar.textContent = `${percentage}% uploaded`;
  }

  /**
   * Called whenever all the changes are submitted successfully. Clear the status text.
   * @listens BugModel#SubmitSuccess
   * @param {Number} bug_id - Changed bug ID.
   */
  on_submit_success ({ bug_id } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$statusbar.textContent = '';
  }

  /**
   * Called whenever any error is detected while submitting the changes. Show the error message on the statusbar.
   * @listens BugModel#SubmitError
   * @param {Number} bug_id - Changed bug ID.
   * @param {String} error - Error message.
   * @param {Boolean} button_disabled - Whether the submit button should be disabled.
   */
  on_submit_error ({ bug_id, error, button_disabled } = {}) {
    if (bug_id !== this.bug.id) {
      return;
    }

    this.$statusbar.textContent = error || 'There was an error while submitting your changes. Please try again.';
    this.$submit_button.setAttribute('aria-disabled', button_disabled);
  }

  /**
   * Called once a submission is complete, regardless of errors. Move to the next bug if possible.
   * @listens BugModel#SubmitComplete
   * @param {Number} bug_id - Changed bug ID.
   */
  async on_submit_complete ({ bug_id } = {}) {
    if (bug_id !== this.bug_id) {
      return;
    }

    const pref = await BzDeck.prefs.get('editing.move_next_once_submitted');
    const next = this.siblings[this.siblings.indexOf(this.bug_id) + 1];

    if (pref === true && next) {
      this.navigate(next);
    }
  }
}
