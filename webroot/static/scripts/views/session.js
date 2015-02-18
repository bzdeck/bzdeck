/**
 * BzDeck Session View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.views.Session = function SessionView () {
  this.on('C:Login', () => this.login());
  this.on('C:Logout', () => this.logout());
};

BzDeck.views.Session.prototype = Object.create(BzDeck.views.BaseView.prototype);
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

/* ------------------------------------------------------------------------------------------------------------------
 * Log-in Form
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.views.LoginForm = function LoginFormView () {
  this.$form = document.querySelector('#app-login form');
  this.$email = this.$form.querySelector('[name="email"]');
  this.$apikey = this.$form.querySelector('[name="apikey"]');
  this.$button = this.$form.querySelector('[role="button"]');
  this.$statusbar = document.querySelector('#app-login [role="status"]');

  this.$form.addEventListener('submit', event => {
    // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
    this.trigger(':Submit', { 'host': 'mozilla', 'email': this.$email.value, 'api_key': this.$apikey.value });
    this.$email.disabled = this.$apikey.disabled = this.$button.disabled = true;
    event.preventDefault();

    return false;
  });

  this.on('SessionController:StatusUpdate', data => {
    this.show_status(data.message);

    if (data.status === 'ForcingLogin') {
      this.show();
    }

    if (data.status === 'LoadingData') {
      this.hide();
      this.hide_intro();
    }
  });

  this.on('SessionController:Error', data => {
    this.show_status(data.message);
    this.$email.disabled = this.$apikey.disabled = this.$button.disabled = false;
  });

  this.on('SessionController:Logout', data => {
    this.show();
  });
};

BzDeck.views.LoginForm.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.LoginForm.prototype.constructor = BzDeck.views.LoginForm;

BzDeck.views.LoginForm.prototype.show = function (firstrun = true) {
  this.$form.setAttribute('aria-hidden', 'false');
  this.$email.disabled = this.$apikey.disabled = this.$button.disabled = false;
  this.$email.focus();

  if (!firstrun) {
    return true;
  }
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
