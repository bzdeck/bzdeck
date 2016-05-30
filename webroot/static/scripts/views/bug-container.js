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
   * @param {String} id - Unique instance identifier shared with the parent view.
   * @param {HTMLElement} $container - The outer element.
   * @returns {Object} view - New BugContainerView instance.
   */
  constructor (id, $container) {
    super(id); // Assign this.id

    this.$container = $container;

    // Subscribe to events
    this.subscribe('P#AddingBugRequested');
    this.subscribe('BugView#RenderingComplete', true);

    // Initiate the corresponding presenter and sub-view
    this.presenter = new BzDeck.BugContainerPresenter(this.id);
  }

  /**
   * Add a new bug to the container.
   * @listens BugContainerPresenter#AddingBugRequested
   * @param {Number} bug_id - Bug ID to show.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {undefined}
   */
  on_adding_bug_requested ({ bug_id, siblings } = {}) {
    let $existing_bug = this.$container.querySelector(`article[data-bug-id="${bug_id}"]`);

    if ($existing_bug) {
      if (this.$bug) {
        this.$bug.setAttribute('aria-hidden', 'true');
      }

      this.bug_id = bug_id;
      this.$bug = $existing_bug;
      this.$bug.removeAttribute('aria-hidden');
      BzDeck.views.banner.tab_path_map.set(`tab-details-${this.id}`, `/bug/${this.bug_id}`);

      return;
    }

    let bug_view = new BzDeck.BugDetailsView(this.id, bug_id, siblings);

    this.loading_bug_id = bug_id;
    this.$loading_bug = this.$container.appendChild(bug_view.$bug);

    BzDeck.views.statusbar.start_loading();
  }

  /**
   * Called when loading a bug is finished in the container regardless of the success or failure. Hide the currently
   * displayed bug in the container if any.
   * @listens BugView#RenderingComplete
   * @param {String} container_id - Container ID of the bug.
   * @param {Number} bug_id - Bug ID to show.
   * @returns {undefined}
   */
  on_rendering_complete ({ container_id, bug_id } = {}) {
    if (container_id !== this.id) {
      return;
    }

    if (this.$bug) {
      this.$bug.setAttribute('aria-hidden', 'true');
    }

    this.bug_id = this.loading_bug_id;
    this.$bug = this.$loading_bug;
    BzDeck.views.banner.tab_path_map.set(`tab-details-${this.id}`, `/bug/${this.bug_id}`);

    delete this.loading_bug_id;
    delete this.$loading_bug;

    BzDeck.views.statusbar.stop_loading();
  }
}
