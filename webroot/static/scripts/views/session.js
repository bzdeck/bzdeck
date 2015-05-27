/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.Session = function SessionView () {
  this.on('C:Login', () => this.login());
  this.on('C:Logout', () => this.logout());
};

BzDeck.views.Session.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Session.prototype.constructor = BzDeck.views.Session;

BzDeck.views.Session.prototype.login = function () {
  BzDeck.views.statusbar.$statusbar = document.querySelector('#statusbar');

  this.$app_login = document.querySelector('#app-login');
  this.$app_body = document.querySelector('#app-body');

  this.$app_login.setAttribute('aria-hidden', 'true');
  this.$app_body.removeAttribute('aria-hidden');

  // TODO: focus handling
};

BzDeck.views.Session.prototype.logout = function () {
  BzDeck.views.statusbar.$statusbar = this.$app_login.querySelector('[role="status"]');
  BzDeck.views.statusbar.show('You have logged out.'); // l10n

  this.$app_login.removeAttribute('aria-hidden');
  this.$app_body.setAttribute('aria-hidden', 'true');
};
