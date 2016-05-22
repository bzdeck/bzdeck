/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Container Controller.
 * @extends BzDeck.BaseController
 */
BzDeck.BugContainerController = class BugContainerController extends BzDeck.BaseController {
  /**
   * Get a BugContainerController instance.
   * @constructor
   * @param {Number} instance_id - 13-digit identifier for a new instance, generated with Date.now().
   * @param {Array.<Number>} [sibling_bug_ids] - Optional bug ID list that can be navigated with the Back and Forward
   *  buttons or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Object} view - New BugContainerController instance.
   */
  constructor (instance_id, sibling_bug_ids) {
    super(); // This does nothing but is required before using `this`

    this.id = instance_id;
    this.sibling_bug_ids = sibling_bug_ids || [];

    this.subscribe('V:NavigationRequested');
  }

  /**
   * Called whenever navigating to other bug within the same tabpanel is requested.
   * @listens BugContainerView:NavigationRequested
   * @param {Number} old_id - Old bug ID to be replaced.
   * @param {Number} new_id - New bug ID to navigate.
   * @param {String} old_path - Previous location path.
   * @param {String} new_path - New location path.
   * @param {Boolean} reinit - Whether there's an existing tabpanel content for the new bug.
   * @returns {undefined}
   */
  on_navigation_requested ({ old_id, new_id, old_path, new_path, reinit } = {}) {
    let data;

    window.history.replaceState({ ids: this.sibling_bug_ids, previous: old_path }, '', new_path);

    if (reinit) {
      this.add_bug(new_id);
    }
  }

  /**
   * Prepare bug data for the view. Find it from the local database or remote Bugzilla instance, then notify the result
   * regardless of the availability.
   * @param {undefined} bug_id - Bug ID to show.
   * @param {Array.<Number>} [sibling_bug_ids] - Optional bug ID list that can be navigated with the Back and Forward
   *  buttons or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @fires BugContainerController:LoadingStarted
   * @fires BugContainerController:LoadingFinished
   * @fires BugContainerController:BugDataAvailable
   * @fires BugContainerController:BugDataUnavailable
   */
  add_bug (bug_id, sibling_bug_ids) {
    this.bug_id = bug_id;
    this.sibling_bug_ids = sibling_bug_ids || this.sibling_bug_ids;

    if (!navigator.onLine) {
      this.trigger(':BugDataUnavailable', { code: 0, message: 'You have to go online to load the bug.' });

      return;
    }

    this.trigger(':LoadingStarted');

    BzDeck.collections.bugs.get(this.bug_id).then(bug => {
      if (bug && !bug.error) {
        return bug;
      }

      return BzDeck.collections.bugs.get(this.bug_id, { id: this.bug_id }).then(bug => {
        return bug.fetch();
      }).catch(error => this.trigger(':BugDataUnavailable', { code: 0, message: 'Failed to load data.' }));
    }).then(bug => new Promise((resolve, reject) => {
      if (bug.data && bug.data.summary) {
        resolve(bug);
      } else {
        let code = bug.error ? bug.error.code : 0;
        let message = {
          102: 'You are not authorized to access this bug, probably because it has sensitive information such as \
                unpublished security issues or marketing-related topics. '
        }[code] || 'This bug data is not available.';

        this.trigger(':BugDataUnavailable', { code, message });
        reject(new Error(message));
      }
    })).then(bug => {
      let sibling_bug_ids = this.sibling_bug_ids;
      let controller = new BzDeck.BugController(bug, sibling_bug_ids);

      this.trigger_safe(':BugDataAvailable', { bug, controller, sibling_bug_ids });
      bug.mark_as_read();
      BzDeck.controllers.bugzfeed._subscribe([this.bug_id]);
    }).then(() => {
      this.trigger(':LoadingFinished');
    });
  }
}
