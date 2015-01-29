/**
 * BzDeck Profile Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.controllers.ProfilePage = function ProfilePageController (email) {
  this.id = email;

  let server = BzDeck.models.data.server,
      gravatar = new BzDeck.controllers.Gravatar(email),
      self = email === BzDeck.models.data.account.name;

  BzDeck.views.toolbar.open_tab({
    'page_category': 'profile',
    'page_id': email,
    'page_constructor': BzDeck.views.ProfilePage,
    'page_constructor_args': [email, self],
    'tab_label': 'Profile', // l10n
    'tab_desc': 'User Profile', // l10n
  }, this);

  gravatar.get_profile().then(entry => {
    if (entry.profileBackground && entry.profileBackground.url) {
      this.trigger(':GravatarDataFound', {
        'style': { 'background-image': `url(${entry.profileBackground.url})` }
      });
    }
  });

  BzDeck.controllers.users.fetch_user(email).then(user => {
    this.trigger(':BugzillaDataFound', {
      'profile': {
        'id': user.id,
        'email': email,
        'emailLink': 'mailto:' + email,
        'name': user.real_name || email,
        'image': gravatar.avatar_url,
      },
      'links': {
        'bugzilla-profile': server.url + '/user_profile?login=' + encodeURI(email),
        'bugzilla-activity': server.url + '/page.cgi?id=user_activity.html&action=run&who=' + encodeURI(email),
      },
      'style': {
        'background-color': BzDeck.controllers.users.get_color(user),
      },
    });
  }).catch(error => {
    this.trigger(':BugzillaDataFetchingError', { error });
  }).then(() => {
    this.trigger(':BugzillaDataFetchingComplete');
  });
};

BzDeck.controllers.ProfilePage.route = '/profile/(.+)';

BzDeck.controllers.ProfilePage.prototype = Object.create(BzDeck.controllers.BaseController.prototype);
BzDeck.controllers.ProfilePage.prototype.constructor = BzDeck.controllers.ProfilePage;
