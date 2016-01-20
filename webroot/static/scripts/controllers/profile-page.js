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
   * @argument {String} email - Person's Bugzilla account name.
   * @return {Object} controller - New ProfilePageController instance.
   */
  constructor (email) {
    super(); // This does nothing but is required before using `this`

    let self = email === BzDeck.account.data.name;

    this.id = email;

    BzDeck.views.banner.open_tab({
      page_category: 'profile',
      page_id: email,
      page_constructor: BzDeck.ProfilePageView,
      page_constructor_args: [email, self],
      tab_label: 'Profile', // l10n
      tab_desc: 'User Profile', // l10n
    }, this);

    BzDeck.collections.users.get(email, { name: email }).then(user => this.on_user_retrieved(user));
  }

  /**
   * Called once the user is retrieved. Get the Gravatar and Bugzilla profiles.
   * @argument {Proxy} user - UserModel instance.
   * @return {undefined}
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
          'bugzilla-profile': BzDeck.server.url + '/user_profile?login=' + encodeURI(email),
          'bugzilla-activity': BzDeck.server.url + '/page.cgi?id=user_activity.html&action=run&who=' + encodeURI(email),
        },
        style: {
          'background-color': this.user.color,
        },
      });
    }).catch(error => {
      this.trigger(':BugzillaProfileFetchingError', { error });
    }).then(() => {
      this.trigger(':BugzillaProfileFetchingComplete');
    });
  };
}

BzDeck.ProfilePageController.prototype.route = '/profile/(.+)';
