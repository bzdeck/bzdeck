/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Bug Presenter.
 * @extends BzDeck.BasePresenter
 */
BzDeck.BugPresenter = class BugPresenter extends BzDeck.BasePresenter {
  /**
   * Get a BugPresenter instance.
   * @constructor
   * @param {Object} bug - BugModel instance.
   * @param {Array.<Number>} [sibling_bug_ids] - Optional bug ID list that can be navigated with the Back and Forward
   *  buttons or keyboard shortcuts. If the bug is on a thread, all bugs on the thread should be listed here.
   * @returns {Object} presenter - New BugPresenter instance.
   */
  constructor (bug, sibling_bug_ids = []) {
    super(); // This does nothing but is required before using `this`

    // Set the Presenter (and View) ID. Add a timestamp to avoid multiple submissions (#303) but there would be a better
    // way to solve the issue... The Presenter and View should be reused whenever possible.
    this.id = `bug-${bug.id}-${Date.now()}`;

    this.bug = bug;
    this.sibling_bug_ids = sibling_bug_ids;

    // Attachments
    this.on_safe('V#AttachFiles', data => this.bug.attach_files(data.files));
    this.on('V#AttachText', data => this.bug.attach_text(data.text));
    this.on('V#RemoveAttachment', data => this.bug.remove_attachment(data.hash));
    this.on('V#MoveUpAttachment', data => this.bug.move_up_attachment(data.hash));
    this.on('V#MoveDownAttachment', data => this.bug.move_down_attachment(data.hash));
    this.on('AttachmentView#EditAttachment', data => this.bug.edit_attachment(data));

    // Subscription
    this.on('V#Subscribe', data => this.bug.update_subscription('add'));
    this.on('V#Unsubscribe', data => this.bug.update_subscription('remove'));

    // Other changes
    this.on('V#EditComment', data => this.bug.edit_comment(data.text));
    this.on('V#EditField', data => this.bug.edit_field(data.name, data.value));
    this.on('V#EditFlag', data => this.bug.edit_flag(data.flag, data.added));
    this.on('V#AddParticipant', data => this.bug.add_participant(data.field, data.email));
    this.on('V#RemoveParticipant', data => this.bug.remove_participant(data.field, data.email));

    // Timeline
    this.subscribe('V#CommentSelected');

    // Form submission
    this.on('V#Submit', () => this.bug.submit());

    // Other actions
    this.subscribe('V#OpeningTabRequested');

    // Add the people involved in the bug to the local user database
    BzDeck.collections.users.add_from_bug(this.bug);

    // Check the fragment; use a timer to wait for the timeline rendering
    window.setTimeout(window => this.check_fragment(), 150);
    window.addEventListener('popstate', event => this.check_fragment());
    window.addEventListener('hashchange', event => this.check_fragment());
  }

  /**
   * Called whenever a comment is selected. Update the location hash to include the comment ID.
   * @listens BugView#CommentSelected
   * @param {Number} number - Comment number.
   * @returns {undefined}
   */
  on_comment_selected ({ number } = {}) {
    if (location.pathname === `/bug/${this.bug.id}`) {
      window.history.replaceState({}, document.title, `${location.pathname}#c${number}`);
    }
  }

  /**
   * Called in the constructor and whenever the location fragment or history state is updated. If the current bug is
   * still displayed, fire an event so the relevant views can do something.
   * @param {undefined}
   * @returns {undefined}
   * @fires BugPresenter#HistoryUpdated
   */
  check_fragment () {
    if (location.pathname === `/bug/${this.bug.id}`) {
      this.trigger('#HistoryUpdated', { hash: location.hash, state: history.state });
    }
  }

  /**
   * Called whenever a previewed bug is selected for details. Open the bug in a new tab with a list of the home page
   * thread so the user can easily navigate through those bugs.
   * @listens BugView#OpeningTabRequested
   * @param {undefined}
   * @returns {undefined}
   */
  on_opening_tab_requested () {
    BzDeck.router.navigate('/bug/' + this.bug.id, { ids: this.sibling_bug_ids });
  }
}
