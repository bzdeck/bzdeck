/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers.ProfilePage = function ProfilePageController (email) {
  this.id = email;
  this.user = BzDeck.collections.users.get(email, { name: email });

  let server = BzDeck.models.server,
      self = email === BzDeck.models.account.data.name;

  BzDeck.views.toolbar.open_tab({
    page_category: 'profile',
    page_id: email,
    page_constructor: BzDeck.views.ProfilePage,
    page_constructor_args: [email, self],
    tab_label: 'Profile', // l10n
    tab_desc: 'User Profile', // l10n
  }, this);

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
        'bugzilla-profile': server.url + '/user_profile?login=' + encodeURI(email),
        'bugzilla-activity': server.url + '/page.cgi?id=user_activity.html&action=run&who=' + encodeURI(email),
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

BzDeck.controllers.ProfilePage.route = '/profile/(.+)';

BzDeck.controllers.ProfilePage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.ProfilePage.prototype.constructor = BzDeck.controllers.ProfilePage;
