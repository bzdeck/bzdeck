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
   * @argument {undefined}
   * @return {Object} view - New SessionView instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.on('C:Login', () => this.login());
    this.on('C:Logout', () => this.logout());
  }

  /**
   * Called once the application is ready and the user is signed in. Hide the sign-in page and show the main application
   * page instead.
   * @argument {undefined}
   * @return {undefined}
   * @todo Focus handling.
   */
  login () {
    BzDeck.views.statusbar.$statusbar = document.querySelector('#statusbar');

    this.$app_login = document.querySelector('#app-login');
    this.$app_body = document.querySelector('#app-body');

    this.$app_login.setAttribute('aria-hidden', 'true');
    this.$app_body.removeAttribute('aria-hidden');
  }

  /**
   * Called once the user is signed out from the app. Hide the main application page and show the sign-in page instead.
   * @argument {undefined}
   * @return {undefined}
   */
  logout () {
    BzDeck.views.statusbar.$statusbar = this.$app_login.querySelector('[role="status"]');
    BzDeck.views.statusbar.show('You have logged out.'); // l10n

    this.$app_login.removeAttribute('aria-hidden');
    this.$app_body.setAttribute('aria-hidden', 'true');
  }
}
