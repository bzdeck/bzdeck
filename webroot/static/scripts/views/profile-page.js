/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Profile Page View that represents the User Profile tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.ProfilePageView = class ProfilePageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Profile Page View. If the specified profile has an existing tab, switch
   * to it. Otherwise, open a new tab and try to load the user profile.
   * @constructor
   * @param {String} email - Person's Bugzilla account name.
   * @fires ProfilePageView#ProfileRequested
   * @returns {ProfilePageView} New ProfilePageView instance.
   */
  constructor (email) {
    super(); // Assign this.id

    this.email = email;

    // Subscribe to events
    this.subscribe('P#GravatarProfileFound');
    this.subscribe('P#BugzillaProfileFound');
    this.subscribe('P#BugzillaProfileFetchingError');
    this.subscribe('P#BugzillaProfileFetchingComplete');

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.ProfilePagePresenter(this.id, this.email);

    this.activate();
    this.trigger('#ProfileRequested');

    this.$tab = document.querySelector(`#tab-profile-${this.id}`),
    this.$tabpanel = document.querySelector(`#tabpanel-profile-${this.id}`),
    this.$profile = this.$tabpanel.querySelector('article'),
    this.$header = this.$profile.querySelector('header'),
    this.$status = this.$tabpanel.querySelector('footer [role="status"]');

    this.$tabpanel.setAttribute('aria-busy', 'true');
    this.$status.textContent = 'Loading...'; // l10n

    // Display the links to Gravatar if this is the user's self profile
    if (this.email === BzDeck.account.data.name) {
      this.$profile.classList.add('self');
    }
  }

  /**
   * Called by the app router to reuse the view.
   * @param {String} email - Person's Bugzilla account name.
   */
  reactivate (email) {
    this.activate();
  }

  /**
   * Activate to the view.
   */
  activate () {
    BzDeck.views.main.open_tab({
      label: 'Profile', // l10n
      description: 'User Profile', // l10n
      category: 'profile',
    }, this);
  }

  /**
   * Called when the User's Gravatar profile is retrieved. Apply the background image.
   * @listens ProfilePagePresenter#GravatarProfileFound
   * @param {Object} style - CSS style rules including the background image.
   * @todo Add more info such as the location and social accounts.
   */
  on_gravatar_profile_found ({ style } = {}) {
    if (!this.$header) {
      return;
    }

    this.$header.style['background-image'] = style['background-image'];
  }

  /**
   * Called when the User's Bugzilla profile is retrieved. Render the profile details.
   * @listens ProfilePagePresenter#BugzillaProfileFound
   * @param {Object} profile - Profile info.
   * @param {Object} links - Related links.
   * @param {Object} style - CSS style rules including the user's generated color.
   */
  on_bugzilla_profile_found ({ profile, links, style } = {}) {
    if (!this.$tab || !this.$profile || !this.$header) {
      return;
    }

    document.title = this.$tab.title = `User Profile: ${profile.name}`;
    this.fill(this.$profile, profile);
    this.$profile.id = 'profile-' + profile.id;
    this.$profile.querySelector('[data-id="bugzilla-profile"] a').href = links['bugzilla-profile'];
    this.$profile.querySelector('[data-id="bugzilla-activity"] a').href = links['bugzilla-activity'];
    this.$header.style['background-color'] = style['background-color'];
  }

  /**
   * Called when the User's Bugzilla profile could not be retrieved. Show the error message.
   * @listens ProfilePagePresenter#BugzillaProfileFetchingError
   * @param {String} message - Error message.
   */
  on_bugzilla_profile_fetching_error ({ message } = {}) {
    if (!this.$status) {
      return;
    }

    this.$status.textContent = message;
  }

  /**
   * Called when fetching the User's Bugzilla profile is complete. Remove the throbber.
   * @listens ProfilePagePresenter#BugzillaProfileFetchingComplete
   */
  on_bugzilla_profile_fetching_complete () {
    if (!this.$tabpanel || !this.$status) {
      return;
    }

    this.$tabpanel.removeAttribute('aria-busy');
    this.$status.textContent = '';
  }
}
