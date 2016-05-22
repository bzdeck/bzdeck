/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Session View that handles the app session-related UI.
 * @extends BzDeck.BaseView
 */
BzDeck.SessionView = class SessionView extends BzDeck.BaseView {
  /**
   * Get a SessionView instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} view - New SessionView instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.on('P#Login', () => this.login());
    this.on('P#Logout', () => this.logout());
  }

  /**
   * Called once the application is ready and the user is signed in. Hide the sign-in page and show the main application
   * page instead.
   * @listens SessionPresenter#Login
   * @param {undefined}
   * @returns {undefined}
   * @todo Focus handling.
   */
  login () {
    this.$app_login = document.querySelector('#app-login');
    this.$app_body = document.querySelector('#app-body');

    this.$app_login.setAttribute('aria-hidden', 'true');
    this.$app_body.removeAttribute('aria-hidden');

    BzDeck.views.statusbar.$statusbar = this.$app_body.querySelector('.statusbar');
  }

  /**
   * Called once the user is signed out from the app. Hide the main application page and show the sign-in page instead.
   * @listens SessionPresenter#Logout
   * @param {undefined}
   * @returns {undefined}
   */
  logout () {
    BzDeck.views.statusbar.$statusbar = this.$app_login.querySelector('.statusbar');
    BzDeck.views.statusbar.show('You have logged out.'); // l10n

    this.$app_login.removeAttribute('aria-hidden');
    this.$app_body.setAttribute('aria-hidden', 'true');
  }
}
