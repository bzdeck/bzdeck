/**
 * BzDeck User Profile Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.views = BzDeck.views || {};

BzDeck.views.ProfilePage = function ProfilePageView (name) {
  let server = BzDeck.models.data.server,
      $tab = document.querySelector(`#tab-profile-${CSS.escape(name)}`),
      $tabpanel = document.querySelector(`#tabpanel-profile-${CSS.escape(name)}`),
      $profile = $tabpanel.querySelector('article'),
      $header = $profile.querySelector('header'),
      $status = $tabpanel.querySelector('footer [role="status"]');

  $tabpanel.setAttribute('aria-busy', 'true');
  $status.textContent = 'Loading...'; // l10n

  // Display the links to Gravatar if this is the user's self profile
  if (name === BzDeck.models.data.account.name) {
    $profile.classList.add('self');
  }

  BzDeck.controllers.users.fetch_user(name).then(user => {
    let name = user.real_name || user.name,
        gravatar = new BzDeck.controllers.Gravatar(user.name);

    document.title = $tab.title = `User Profile: ${name}`;

    this.render($profile, {
      'id': user.id,
      'email': user.name,
      'emailLink': 'mailto:' + user.name,
      'name': name,
      'image': gravatar.avatar_url,
    });

    gravatar.get_profile().then(entry => {
      if (entry.profileBackground && entry.profileBackground.url) {
        $header.style.backgroundImage = `url(${entry.profileBackground.url})`;
      }

      // TODO: Add location and social accounts if provided
    });

    $profile.id = 'profile-' + user.id;
    $profile.querySelector('[data-id="bugzilla-profile"] a').href
        = server.url + '/user_profile?login=' + encodeURI(user.name);
    $profile.querySelector('[data-id="bugzilla-activity"] a').href
        = server.url + '/page.cgi?id=user_activity.html&action=run&who=' + encodeURI(user.name);
    $header.style.backgroundColor = BzDeck.controllers.users.get_color(user);
  }).catch(error => {
    $status.textContent = error.message;
  }).then(() => {
    $tabpanel.removeAttribute('aria-busy');
    $status.textContent = '';
  });
};

BzDeck.views.ProfilePage.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.ProfilePage.prototype.constructor = BzDeck.views.ProfilePage;
