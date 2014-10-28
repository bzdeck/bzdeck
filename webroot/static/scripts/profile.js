/**
 * BzDeck User Profile Page
 * Copyright © 2014 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.ProfilePage = function ProfilePage (name) {
  let server = BzDeck.model.data.server,
      id_suffix = this.id = name,
      $$tablist = BzDeck.toolbar.$$tablist,
      $tabpanel = FlareTail.util.content.get_fragment('tabpanel-profile-template', id_suffix).firstElementChild,
      $profile = $tabpanel.querySelector('article'),
      $status = $tabpanel.querySelector('footer [role="status"]');

  let $tab = $$tablist.view.selected = $$tablist.view.$focused = $$tablist.add_tab(
    `profile-${id_suffix}`,
    'Profile', // l10n
    'User Profile', // l10n
    $tabpanel
  );

  $tabpanel.focus();
  $tabpanel.setAttribute('aria-busy', 'true');
  $status.textContent = 'Loading...'; // l10n

  BzDeck.model.fetch_user(name).then(user => {
    let name = user.real_name || user.name;

    document.title = $tab.title = $tabpanel.querySelector('h2').textContent = `User Profile: ${name}`;

    FlareTail.util.content.fill($profile, {
      'id': user.id,
      'email': user.name,
      'emailLink': 'mailto:' + user.name,
      'name': name,
      'image': 'https://www.gravatar.com/avatar/' + md5(user.name) + '?s=160&d=mm',
    });

    $profile.querySelector('[data-id="bugzilla-profile"] a').href
        = server.url + '/user_profile?login=' + encodeURI(user.name);
    $profile.querySelector('[data-id="bugzilla-activity"] a').href
        = server.url + '/page.cgi?id=user_activity.html&action=run&who=' + encodeURI(user.name);
  }).catch(error => {
    $status.textContent = error.message;
  }).then(() => {
    $tabpanel.removeAttribute('aria-busy');
    $status.textContent = '';
  });
};

BzDeck.ProfilePage.open = function (name) {
  let pages = BzDeck.pages.profile_list ? BzDeck.pages.profile_list : BzDeck.pages.profile_list = new Map(),
      page,
      $$tablist = BzDeck.toolbar.$$tablist,
      $tab = document.querySelector(`#tab-profile-${CSS.escape(name)}`);

  if ($tab) {
    page = pages.get(name),
    $$tablist.view.selected = $$tablist.view.$focused = $tab;
  } else {
    page = new BzDeck.ProfilePage(name);
    pages.set(name, page);
  }

  return BzDeck.pages.profile = page;
};
