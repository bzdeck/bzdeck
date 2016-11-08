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
   * @param {Array.<Number>} [siblings=[]] - Optional bug ID list that can be navigated with the Back and Forward buttons
   *  or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Object} view - New BugContainerPresenter instance.
   */
  constructor (id, siblings = []) {
    super(id); // Assign this.id

    this.siblings = siblings;

    // Subscribe to events
    this.subscribe('V#BugAdded');
    this.subscribe('BugView#NavigationRequested', true);
  }

  /**
   * Called whenever navigating to other bug within the same tabpanel is requested.
   * @listens BugView#NavigationRequested
   * @param {String} container_id - Container ID to be checked.
   * @param {Number} old_id - Old bug ID to be replaced.
   * @param {Number} new_id - New bug ID to navigate.
   * @fires BugContainerPresenter#navigated
   * @returns {undefined}
   */
  on_navigation_requested ({ container_id, old_id, new_id } = {}) {
    if (container_id !== this.id) {
      return;
    }

    this.add_bug(new_id);
    this.trigger('#navigated', { old_id, new_id });
    BzDeck.router.navigate(location.pathname, { preview_id: new_id, siblings: this.siblings, previous: `/bug/${old_id}` }, true);
  }

  /**
   * Notify the view of a new bug ID to be added.
   * @param {Number} bug_id - Bug ID to show.
   * @fires BugContainerPresenter#AddingBugRequested
   * @returns {undefined}
   */
  add_bug (bug_id) {
    this.trigger('#AddingBugRequested', { bug_id, siblings: this.siblings });
  }

  /**
   * Called once a bug is added to the container. Mark the bug read at this time.
   * @listens BugContainerView#BugAdded
   * @param {Number} id - Added bug's ID.
   * @returns {Promise.<undefined>}
   */
  async on_bug_added ({ id } = {}) {
    this.bug = await BzDeck.collections.bugs.get(id);
    this.bug.mark_as_read();
  }
}
