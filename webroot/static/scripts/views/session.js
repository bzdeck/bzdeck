/**
 * BzDeck Session View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.Session = function SessionView () {};

BzDeck.views.Session.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.Session.prototype.constructor = BzDeck.views.Session;

BzDeck.views.Session.prototype.login = function () {
  BzDeck.views.statusbar.$statusbar = document.querySelector('#statusbar');

  this.$app_login = document.querySelector('#app-login'),
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

  BzDeck.views.login_form.show(false);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Log-in Form
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.LoginForm = function LoginFormView () {
  this.$form = document.querySelector('#app-login form');
  this.$input = this.$form.querySelector('[role="textbox"]');
  this.$button = this.$form.querySelector('[role="button"]');
  this.$statusbar = document.querySelector('#app-login [role="status"]');
};

BzDeck.views.LoginForm.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.LoginForm.prototype.constructor = BzDeck.views.LoginForm;

BzDeck.views.LoginForm.prototype.show = function (firstrun = true) {
  this.$form.setAttribute('aria-hidden', 'false');
  this.$input.disabled = this.$button.disabled = false;
  this.$input.focus();

  if (!firstrun) {
    return true;
  }

  return new Promise((resolve, reject) => {
    this.$form.addEventListener('submit', event => {
      if (!BzDeck.controllers.session.processing) {
        // User is trying to re-login
        BzDeck.controllers.session.relogin = true;
        BzDeck.controllers.session.processing = true;
      }

      if (navigator.onLine) {
        this.$input.disabled = this.$button.disabled = true;
        // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
        resolve({ 'host': 'mozilla', 'email': this.$input.value });
      } else {
        reject(new Error('You have to go online to sign in.')); // l10n
      }

      event.preventDefault();

      return false;
    });
  });
};

BzDeck.views.LoginForm.prototype.hide = function () {
  this.$form.setAttribute('aria-hidden', 'true');
};

BzDeck.views.LoginForm.prototype.hide_intro = function () {
  document.querySelector('#app-intro').style.display = 'none';
};

BzDeck.views.LoginForm.prototype.show_status = function (message) {
  this.$statusbar.textContent = message;
};

BzDeck.views.LoginForm.prototype.enable_input = function () {
  this.form.$input.disabled = this.form.$button.disabled = false;
};

BzDeck.views.LoginForm.prototype.disable_input = function () {
  this.form.$input.disabled = this.form.$button.disabled = true;
};
