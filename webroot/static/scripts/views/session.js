/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Session View that handles the app session-related UI.
 *
 * @constructor
 * @extends BaseView
 * @argument {undefined}
 * @return {Object} view - New SessionView instance.
 */
BzDeck.views.Session = function SessionView () {
  this.on('C:Login', () => this.login());
  this.on('C:Logout', () => this.logout());
};

BzDeck.views.Session.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Session.prototype.constructor = BzDeck.views.Session;

/**
 * Called once the application is ready and the user is signed in. Hide the sign-in page and show the main application
 * page instead.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Session.prototype.login = function () {
  BzDeck.views.statusbar.$statusbar = document.querySelector('#statusbar');

  this.$app_login = document.querySelector('#app-login');
  this.$app_body = document.querySelector('#app-body');

  this.$app_login.setAttribute('aria-hidden', 'true');
  this.$app_body.removeAttribute('aria-hidden');

  // TODO: focus handling
};

/**
 * Called once the user is signed out from the app. Hide the main application page and show the sign-in page instead.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.Session.prototype.logout = function () {
  BzDeck.views.statusbar.$statusbar = this.$app_login.querySelector('[role="status"]');
  BzDeck.views.statusbar.show('You have logged out.'); // l10n

  this.$app_login.removeAttribute('aria-hidden');
  this.$app_body.setAttribute('aria-hidden', 'true');
};
