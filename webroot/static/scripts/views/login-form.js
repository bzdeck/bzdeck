/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.LoginForm = function LoginFormView () {
  // TODO: Users will be able to choose an instance on the sign-in form; Hardcode the host for now
  let params = new URLSearchParams(location.search.substr(1)),
      host = params.get('server') === 'dev' ? 'mozilla-dev' : 'mozilla';

  this.$form = document.querySelector('#app-login form');
  this.$email = this.$form.querySelector('[name="email"]');
  this.$apikey = this.$form.querySelector('[name="apikey"]');
  this.$button = this.$form.querySelector('[role="button"]');
  this.$statusbar = document.querySelector('#app-login [role="status"]');

  this.$form.addEventListener('submit', event => {
    this.trigger(':Submit', { host, email: this.$email.value, api_key: this.$apikey.value });
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
  }, true);

  this.on('SessionController:Error', data => {
    this.show_status(data.message);
    this.$email.disabled = this.$apikey.disabled = this.$button.disabled = false;
  }, true);

  this.on('SessionController:Logout', data => {
    this.show();
  }, true);
};

BzDeck.views.LoginForm.prototype = Object.create(BzDeck.views.Base.prototype);
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
