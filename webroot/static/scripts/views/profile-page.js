/**
 * BzDeck User Profile Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.ProfilePage = function ProfilePageView (email, self) {
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

  this.subscribe('C:GravatarDataFound:' + email, data => {
    if ($header) {
      // TODO: Add location and social accounts if provided
      $header.style['background-image'] = data.style['background-image'];
    }
  });

  this.subscribe('C:BugzillaDataFound:' + email, data => {
    if ($tab && $profile && $header) {
      document.title = $tab.title = `User Profile: ${data.profile.name}`;
      this.fill($profile, data.profile);
      $profile.id = 'profile-' + data.profile.id;
      $profile.querySelector('[data-id="bugzilla-profile"] a').href = data.links['bugzilla-profile'];
      $profile.querySelector('[data-id="bugzilla-activity"] a').href = data.links['bugzilla-activity'];
      $header.style['background-color'] = data.style['background-color'];
    }
  });

  this.subscribe('C:BugzillaDataFetchingError:' + email, data => {
    if ($status) {
      $status.textContent = data.error.message;
    }
  });

  this.subscribe('C:BugzillaDataFetchingComplete:' + email, data => {
    if ($tabpanel && $status) {
      $tabpanel.removeAttribute('aria-busy');
      $status.textContent = '';
    }
  });
};

BzDeck.views.ProfilePage.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.ProfilePage.prototype.constructor = BzDeck.views.ProfilePage;
