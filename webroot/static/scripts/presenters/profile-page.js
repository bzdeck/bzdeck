/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Profile Page Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.ProfilePagePresenter = class ProfilePagePresenter extends BzDeck.BasePresenter {
  /**
   * Get a ProfilePagePresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @param {String} email - Person's Bugzilla account name.
   * @returns {Object} presenter - New ProfilePagePresenter instance.
   */
  constructor (id, email) {
    super(id); // Assign this.id

    this.email = email;

    // Subscribe to events
    this.subscribe('V#ProfileRequested');
  }

  /**
   * Called once the user is retrieved. Get the Gravatar and Bugzilla profiles.
   * @listens ProfilePageView#ProfileRequested
   * @param {undefined}
   * @returns {undefined}
   * @fires ProfilePagePresenter#GravatarProfileFound
   * @fires ProfilePagePresenter#BugzillaProfileFound
   * @fires ProfilePagePresenter#BugzillaProfileFetchingError
   * @fires ProfilePagePresenter#BugzillaProfileFetchingComplete
   */
  on_profile_requested (user) {
    let origin = BzDeck.host.origin;
    let email = encodeURI(this.email);

    BzDeck.collections.users.get(this.email, { name: this.email }).then(user => {
      this.user = user;

      this.user.get_gravatar_profile().then(profile => {
        this.trigger('#GravatarProfileFound', {
          style: { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
        });
      });

      this.user.get_bugzilla_profile().then(profile => {
        this.trigger('#BugzillaProfileFound', {
          profile: {
            id: profile.id,
            email: this.email,
            emailLink: 'mailto:' + this.email,
            name: this.user.original_name || this.user.name,
            image: this.user.image,
          },
          links: {
            'bugzilla-profile': `${origin}/user_profile?login=${email}`,
            'bugzilla-activity': `${origin}/page.cgi?id=user_activity.html&action=run&who=${email}`,
          },
          style: {
            'background-color': this.user.color,
          },
        });
      }).catch(error => {
        this.trigger('#BugzillaProfileFetchingError', { message: error.message });
      }).then(() => {
        this.trigger('#BugzillaProfileFetchingComplete');
      });
    });
  }
}
