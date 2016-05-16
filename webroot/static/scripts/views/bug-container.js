/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Container View that represents an outer element containing one or more bugs.
 * @extends BzDeck.BaseView
 * @todo Re-implement swipe navigation (#163)
 */
BzDeck.BugContainerView = class BugContainerView extends BzDeck.BaseView {
  /**
   * Get a BugContainerView instance.
   * @constructor
   * @param {Number} instance_id - 13-digit identifier for a new instance, generated with Date.now().
   * @param {HTMLElement} $container - The outer element.
   * @returns {Object} view - New BugContainerView instance.
   * @listens BugContainerController:BugDataAvailable
   * @listens BugContainerController:BugDataUnavailable
   * @listens BugContainerController:LoadingStarted
   * @listens BugContainerController:LoadingFinished
   */
  constructor (instance_id, $container) {
    super(); // This does nothing but is required before using `this`

    this.id = instance_id;
    this.$container = $container;

    this.subscribe('C:BugDataAvailable');
    this.subscribe('C:BugDataUnavailable');

    this.on('C:LoadingStarted', () => BzDeck.views.statusbar.start_loading());
    this.on('C:LoadingFinished', () => BzDeck.views.statusbar.stop_loading());
  }

  /**
   * Called by DetailsPageController when the bug data is found. Prepare the newly opened tabpanel.
   * @param {Object} data - Passed data.
   * @param {Proxy}  data.bug - Bug to show.
   * @param {Object} data.controller - New BugController instance for that bug.
   * @param {Array.<Number>} [data.sibling_bug_ids] - Optional bug ID list that can be navigated with the Back and
   *  Forward buttons or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bug_data_available (data) {
    if (!this.$container || !data.bug.summary) {
      return false;
    }

    this.add_bug(data);

    return true;
  }

  /**
   * Called by DetailsPageController when an error was encountered while fetching the bug data. Show the error message.
   * @param {Object} data - Passed data.
   * @param {Number} data.code - Error code usually defined by Bugzilla.
   * @param {String} data.message - Error message text.
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bug_data_unavailable (data) {
    if (this.$bug || !this.$container) {
      return false;
    }

    this.$bug = this.fill(this.get_template('bug-details-error-template', this.bug_id), {
      id: this.bug_id,
      status: data.message,
    }, {
      'data-error-code': data.code,
    });

    this.$container.appendChild(this.$bug);
    this.$container.removeAttribute('aria-busy');

    return true;
  }

  /**
   * Show the selected bug in the container.
   * @param {Object} data - Preview data.
   * @param {Proxy}  data.bug - Bug to show.
   * @param {Object} data.controller - New BugController instance for that bug.
   * @param {Array.<Number>} [data.sibling_bug_ids] - Optional bug ID list that can be navigated with the Back and
   *  Forward buttons or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {undefined}
   */
  add_bug (data) {
    this.bug_id = data.bug.id;
    this.sibling_bug_ids = data.sibling_bug_ids || [];

    this.$container.setAttribute('aria-busy', 'true');
    this.$container.innerHTML = '';
    this.$bug = this.$container.appendChild(this.get_template('bug-details-template', data.bug.id));
    this.$$bug = new BzDeck.BugDetailsView(data.controller.id, data.bug, this.$bug);
    this.$container.removeAttribute('aria-busy');

    // Set Back & Forward navigation
    if (this.sibling_bug_ids.length) {
      this.setup_navigation();
    }
  }

  /**
   * Set up the Back and Forward navigation when applicable, including the toolbar buttons and keyboard shortcuts.
   * @param {undefined}
   * @returns {undefined}
   */
  setup_navigation () {
    let Button = this.widgets.Button;
    let $toolbar = this.$bug.querySelector('[role="toolbar"]');
    let $$btn_back = new Button($toolbar.querySelector('[data-command="nav-back"]'));
    let $$btn_forward = new Button($toolbar.querySelector('[data-command="nav-forward"]'));
    let index = this.sibling_bug_ids.indexOf(this.bug_id);
    let prev = this.sibling_bug_ids[index - 1];
    let next = this.sibling_bug_ids[index + 1];
    let assign_key_binding = (key, command) => this.helpers.kbd.assign(this.$bug, { [key]: command });

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
   * @param {Number} new_id - ID of the bug to show next.
   * @returns {undefined}
   * @fires BugContainerView:NavigationRequested
   */
  navigate (new_id) {
    let old_id = this.bug_id;
    let old_path = `/bug/${old_id}`;
    let new_path = `/bug/${new_id}`;
    let $existing_bug = document.querySelector(`#bug-${new_id}`);

    // Copy the content from another tabpanel if available, or destroy the current content
    if ($existing_bug) {
      this.$container.setAttribute('aria-busy', 'true');
      this.$container.replaceChild($existing_bug, this.$bug);
      this.$container.removeAttribute('aria-busy');
      this.$bug = $existing_bug;
      BzDeck.views.banner.$$tablist.close_tab($existing_bug.parentElement);
    }

    // Update relevant data
    this.bug_id = new_id;
    BzDeck.views.banner.tab_path_map.set(`tab-details-${this.id}`, new_path);

    // Notify the Controller
    this.trigger(':NavigationRequested', { old_id, new_id, old_path, new_path, reinit: !$existing_bug });
  }
}
