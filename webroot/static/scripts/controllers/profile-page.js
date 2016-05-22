/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Profile Page Controller.
 * @extends BzDeck.BaseController
 */
BzDeck.ProfilePageController = class ProfilePageController extends BzDeck.BaseController {
  /**
   * Called by the app router and initialize the Profile Page Controller. If the specified profile has an existing tab,
   * switch to it. Otherwise, open a new tab and try to load the user profile.
   * @constructor
   * @param {String} email - Person's Bugzilla account name.
   * @returns {Object} controller - New ProfilePageController instance.
   */
  constructor (email) {
    super(); // This does nothing but is required before using `this`

    this.id = email;

    this.connect();
  }

  /**
   * Called by the app router to reuse the controller.
   * @param {String} email - Person's Bugzilla account name.
   * @returns {undefined}
   */
  reconnect (email) {
    this.connect();
  }

  /**
   * Connect to the view.
   * @param {undefined}
   * @returns {undefined}
   */
  connect () {
    BzDeck.views.banner.open_tab({
      label: 'Profile', // l10n
      description: 'User Profile', // l10n
      page: {
        category: 'profile',
        id: this.id,
        constructor: BzDeck.ProfilePageView,
        constructor_args: [this.id, this.id === BzDeck.account.data.name],
      },
    }, this);

    BzDeck.collections.users.get(this.id, { name: this.id }).then(user => this.on_user_retrieved(user));
  }

  /**
   * Called once the user is retrieved. Get the Gravatar and Bugzilla profiles.
   * @param {Proxy} user - UserModel instance.
   * @returns {undefined}
   * @fires ProfilePageController:GravatarProfileFound
   * @fires ProfilePageController:BugzillaProfileFound
   * @fires ProfilePageController:BugzillaProfileFetchingError
   * @fires ProfilePageController:BugzillaProfileFetchingComplete
   */
  on_user_retrieved (user) {
    let email = this.id;

    this.user = user;

    this.user.get_gravatar_profile().then(profile => {
      this.trigger(':GravatarProfileFound', {
        style: { 'background-image': this.user.background_image ? `url(${this.user.background_image})` : 'none' },
      });
    });

    this.user.get_bugzilla_profile().then(profile => {
      this.trigger(':BugzillaProfileFound', {
        profile: {
          id: profile.id,
          email: email,
          emailLink: 'mailto:' + email,
          name: this.user.original_name || this.user.name,
          image: this.user.image,
        },
        links: {
          'bugzilla-profile': BzDeck.host.origin + '/user_profile?login=' + encodeURI(email),
          'bugzilla-activity': BzDeck.host.origin + '/page.cgi?id=user_activity.html&action=run&who=' + encodeURI(email),
        },
        style: {
          'background-color': this.user.color,
        },
      });
    }).catch(error => {
      this.trigger(':BugzillaProfileFetchingError', { message: error.message });
    }).then(() => {
      this.trigger(':BugzillaProfileFetchingComplete');
    });
  }
}
