/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.ProfilePage = function ProfilePageView (email, self) {
  this.id = email;

  let $tab = document.querySelector(`#tab-profile-${CSS.escape(email)}`),
      $tabpanel = document.querySelector(`#tabpanel-profile-${CSS.escape(email)}`),
      $profile = $tabpanel.querySelector('article'),
      $header = $profile.querySelector('header'),
      $status = $tabpanel.querySelector('footer [role="status"]');

  $tabpanel.setAttribute('aria-busy', 'true');
  $status.textContent = 'Loading...'; // l10n

  // Display the links to Gravatar if this is the user's self profile
  if (self) {
    $profile.classList.add('self');
  }

  this.on('C:GravatarProfileFound', data => {
    if ($header) {
      // TODO: Add location and social accounts if provided
      $header.style['background-image'] = data.style['background-image'];
    }
  });

  this.on('C:BugzillaProfileFound', data => {
    if ($tab && $profile && $header) {
      document.title = $tab.title = `User Profile: ${data.profile.name}`;
      this.fill($profile, data.profile);
      $profile.id = 'profile-' + data.profile.id;
      $profile.querySelector('[data-id="bugzilla-profile"] a').href = data.links['bugzilla-profile'];
      $profile.querySelector('[data-id="bugzilla-activity"] a').href = data.links['bugzilla-activity'];
      $header.style['background-color'] = data.style['background-color'];
    }
  });

  this.on('C:BugzillaProfileFetchingError', data => {
    if ($status) {
      $status.textContent = data.error.message;
    }
  });

  this.on('C:BugzillaProfileFetchingComplete', data => {
    if ($tabpanel && $status) {
      $tabpanel.removeAttribute('aria-busy');
      $status.textContent = '';
    }
  });
};

BzDeck.views.ProfilePage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.ProfilePage.prototype.constructor = BzDeck.views.ProfilePage;
