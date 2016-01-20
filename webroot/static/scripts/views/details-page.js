/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Details Page View that represents the Bug Details page's tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.DetailsPageView = class DetailsPageView extends BzDeck.BaseView {
  /**
   * Get a DetailsPageView instance.
   * @constructor
   * @argument {Number} page_id - 13-digit identifier for a new instance, generated with Date.now().
   * @argument {Number} bug_id - ID of the bug to display.
   * @argument {Array.<Number>} [bug_ids] - Optional list of bug IDs that can be navigated with the Back and Forward
   *  buttons or keyboard shortcuts. If the selected bug is on a thread, all bugs on the thread should be listed here.
   * @return {Object} view - New DetailsPageView instance.
   */
  constructor (page_id, bug_id, bug_ids = []) {
    super(); // This does nothing but is required before using `this`

    this.id = page_id;
    this.bug_id = bug_id;
    this.bug_ids = bug_ids;

    this.$tab = document.querySelector(`#tab-details-${this.id}`);
    this.$tabpanel = document.querySelector(`#tabpanel-details-${this.id}`);
    this.$tabpanel.setAttribute('aria-busy', 'true');

    this.subscribe('C:BugDataAvailable');
    this.subscribe('C:LoadingStarted');
    this.subscribe('C:BugDataUnavailable');
  }

  /**
   * Generate a title string for the tab.
   * @argument {Proxy} bug - The displayed bug.
   * @return {String} title - Formatted label. If the bug is not available yet, just return "Loading".
   */
  get_tab_title (bug) {
    return `Bug ${bug.id}\n${bug.summary || 'Loading...'}`; // l10n
  }

  /**
   * Set up the Back and Forward navigation when applicable, including the toolbar buttons and keyboard shortcuts.
   * @argument {undefined}
   * @return {undefined}
   */
  setup_navigation () {
    let Button = this.widgets.Button,
        $toolbar = this.$bug.querySelector('header [role="toolbar"]'),
        $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]')),
        $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]')),
        index = this.bug_ids.indexOf(this.bug_id),
        prev = this.bug_ids[index - 1],
        next = this.bug_ids[index + 1],
        assign_key_binding = (key, command) => this.helpers.kbd.assign(this.$bug, { [key]: command });

    let set_button_tooltip = (id, $$button) => BzDeck.collections.bugs.get(id).then(bug => {
      $$button.view.$button.title = bug && bug.summary ? `Bug ${id}\n${bug.summary}` : `Bug ${id}`; // l10n
    });

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
   * @argument {Number} new_id - ID of the bug to show next.
   * @return {undefined}
   */
  navigate (new_id) {
    let old_id = this.bug_id,
        old_path = `/bug/${old_id}`,
        new_path = `/bug/${new_id}`,
        $existing_bug = document.querySelector(`#bug-${new_id}`);

    this.$tabpanel.setAttribute('aria-busy', 'true');

    // Copy the content from another tabpanel if available, or destroy the current content
    if ($existing_bug) {
      this.$tabpanel.replaceChild($existing_bug, this.$bug);
      this.$tabpanel.removeAttribute('aria-busy');
      this.$bug = $existing_bug;
      BzDeck.views.banner.$$tablist.close_tab($existing_bug.parentElement);
    } else {
      this.$bug.remove();
      this.$bug = undefined;
    }

    // Update relevant data
    this.bug_id = new_id;
    BzDeck.views.banner.tab_path_map.set(`tab-details-${this.id}`, new_path);

    // Notify the Controller
    this.trigger(':NavigationRequested', { id: new_id, ids: this.bug_ids, old_path, new_path, reinit: !$existing_bug });
  }

  /**
   * Called by DetailsPageController when the bug data is found. Prepare the newly opened tabpanel.
   * @argument {Object} data - Passed data.
   * @argument {Proxy}  data.bug - Bug to show.
   * @argument {Object} data.controller - New BugController instance for that bug.
   * @return {Boolean} result - Whether the view is updated.
   */
  on_bug_data_available (data) {
    if (this.$bug || !this.$tabpanel || !data.bug.summary) {
      return false;
    }

    this.$bug = this.$tabpanel.appendChild(this.get_template('bug-details-template', data.bug.id));
    this.$$bug = new BzDeck.BugDetailsView(data.controller.id, data.bug, this.$bug);
    this.$tab.title = this.get_tab_title(data.bug);
    BzDeck.views.global.update_window_title(this.$tab);

    // Set Back & Forward navigation
    if (this.bug_ids.length) {
      this.setup_navigation();
    }

    this.$tabpanel.removeAttribute('aria-busy');

    return true;
  }

  /**
   * Called by DetailsPageController when fetching the bug data is started. Update the statusbar accordingly.
   * @argument {undefined}
   * @return {undefined}
   */
  on_loading_started () {
    BzDeck.views.statusbar.show('Loading...'); // l10n
  }

  /**
   * Called by DetailsPageController when an error was encountered while fetching the bug data. Show the error message.
   * @argument {Object} data - Passed data.
   * @argument {Number} data.code - Error code usually defined by Bugzilla.
   * @argument {String} data.message - Error message text.
   * @return {Boolean} result - Whether the view is updated.
   */
  on_bug_data_unavailable (data) {
    if (this.$bug || !this.$tabpanel) {
      return false;
    }

    this.$bug = this.fill(this.get_template('bug-details-error-template', this.bug_id), {
      id: this.bug_id,
      status: data.message,
    }, {
      'data-error-code': data.code,
    });

    this.$tabpanel.appendChild(this.$bug);
    this.$tabpanel.removeAttribute('aria-busy');

    return true;
  }
}
