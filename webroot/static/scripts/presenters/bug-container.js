/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Container Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.BugContainerPresenter = class BugContainerPresenter extends BzDeck.BasePresenter {
  /**
   * Get a BugContainerPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Object} view - New BugContainerPresenter instance.
   */
  constructor (id, siblings) {
    super(id); // Assign this.id

    this.siblings = siblings || [];

    // Subscribe to events
    this.subscribe('V#NavigationRequested');
  }

  /**
   * Called whenever navigating to other bug within the same tabpanel is requested.
   * @listens BugContainerView#NavigationRequested
   * @param {Number} old_id - Old bug ID to be replaced.
   * @param {Number} new_id - New bug ID to navigate.
   * @returns {undefined}
   */
  on_navigation_requested ({ old_id, new_id } = {}) {
    window.history.replaceState({ siblings: this.siblings, previous: `/bug/${old_id}` }, '', `/bug/${new_id}`);
    this.add_bug(new_id);
  }

  /**
   * Notify the view of a new bug ID to be added.
   * @param {Number} bug_id - Bug ID to show.
   * @param {Array.<Number>} [siblings] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {undefined}
   * @fires BugContainerPresenter#AddingBugRequested
   */
  add_bug (bug_id, siblings = []) {
    this.trigger('#AddingBugRequested', { bug_id, siblings });
  }
}
