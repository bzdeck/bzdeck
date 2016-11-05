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
   * @fires ProfilePagePresenter#GravatarProfileFound
   * @fires ProfilePagePresenter#BugzillaProfileFound
   * @fires ProfilePagePresenter#BugzillaProfileFetchingError
   * @fires ProfilePagePresenter#BugzillaProfileFetchingComplete
   * @returns {Promise.<undefined>}
   */
  async on_profile_requested () {
    const origin = BzDeck.host.origin;
    const email = encodeURI(this.email);

    this.user = await BzDeck.collections.users.get(this.email, { name: this.email });

    (async () => {
      const profile = await this.user.get_gravatar_profile();

      this.trigger('#GravatarProfileFound', {
        style: { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
      });
    })();

    (async () => {
      try {
        const profile = await this.user.get_bugzilla_profile();

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
      } catch (error) {
        this.trigger('#BugzillaProfileFetchingError', { message: error.message });
      }

      this.trigger('#BugzillaProfileFetchingComplete');
    })();
  }
}
