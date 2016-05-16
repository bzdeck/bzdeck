/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Profile Page View that represents the User Profile tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.ProfilePageView = class ProfilePageView extends BzDeck.BaseView {
  /**
   * Get a ProfilePageView instance.
   * @constructor
   * @param {String} email - Person's Bugzilla account name.
   * @param {Boolean} self - Whether this profile is the app user's own profile.
   * @returns {Object} view - New ProfilePageView instance.
   * @listens ProfilePageController:GravatarProfileFound
   * @listens ProfilePageController:BugzillaProfileFound
   * @listens ProfilePageController:BugzillaProfileFetchingError
   * @listens ProfilePageController:BugzillaProfileFetchingComplete
   */
  constructor (email, self) {
    super(); // This does nothing but is required before using `this`

    this.id = email;

    this.$tab = document.querySelector(`#tab-profile-${CSS.escape(email)}`),
    this.$tabpanel = document.querySelector(`#tabpanel-profile-${CSS.escape(email)}`),
    this.$profile = this.$tabpanel.querySelector('article'),
    this.$header = this.$profile.querySelector('header'),
    this.$status = this.$tabpanel.querySelector('footer [role="status"]');

    this.$tabpanel.setAttribute('aria-busy', 'true');
    this.$status.textContent = 'Loading...'; // l10n

    // Display the links to Gravatar if this is the user's self profile
    if (self) {
      this.$profile.classList.add('self');
    }

    this.subscribe('C:GravatarProfileFound');
    this.subscribe('C:BugzillaProfileFound');
    this.subscribe('C:BugzillaProfileFetchingError');
    this.subscribe('C:BugzillaProfileFetchingComplete');
  }

  /**
   * Called by ProfilePageController when the User's Gravatar profile is retrieved. Apply the background image.
   * @param {Object} data - Data passed.
   * @param {Object} data.style - CSS style rules including the background image.
   * @returns {Boolean} result - Whether the view is updated.
   * @todo Add more info such as the location and social accounts.
   */
  on_gravatar_profile_found (data) {
    if (!this.$header) {
      return false;
    }

    this.$header.style['background-image'] = data.style['background-image'];

    return true;
  }

  /**
   * Called by ProfilePageController when the User's Bugzilla profile is retrieved. Render the profile details.
   * @param {Object} data - Data passed.
   * @param {Object} data.profile - Profile info.
   * @param {Object} data.links - Related links.
   * @param {Object} data.style - CSS style rules including the user's generated color.
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bugzilla_profile_found (data) {
    if (!this.$tab || !this.$profile || !this.$header) {
      return false;
    }

    document.title = this.$tab.title = `User Profile: ${data.profile.name}`;
    this.fill(this.$profile, data.profile);
    this.$profile.id = 'profile-' + data.profile.id;
    this.$profile.querySelector('[data-id="bugzilla-profile"] a').href = data.links['bugzilla-profile'];
    this.$profile.querySelector('[data-id="bugzilla-activity"] a').href = data.links['bugzilla-activity'];
    this.$header.style['background-color'] = data.style['background-color'];

    return true;
  }

  /**
   * Called by ProfilePageController when the User's Bugzilla profile could not be retrieved. Show the error message.
   * @param {Object} data - Data passed.
   * @param {Error}  data.error - Error encountered.
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bugzilla_profile_fetching_error (data) {
    if (!this.$status) {
      return false;
    }

    this.$status.textContent = data.error.message;

    return true;
  }

  /**
   * Called by ProfilePageController when fetching the User's Bugzilla profile is complete. Remove the throbber.
   * @param {undefined}
   * @returns {Boolean} result - Whether the view is updated.
   */
  on_bugzilla_profile_fetching_complete () {
    if (!this.$tabpanel || !this.$status) {
      return false;
    }

    this.$tabpanel.removeAttribute('aria-busy');
    this.$status.textContent = '';

    return true;
  }
}
