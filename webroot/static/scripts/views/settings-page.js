/**
 * BzDeck Settings Page View
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

BzDeck.views.SettingsPage = function SettingsPageView (tab_id, token, prefs) {
  // Activate tabs
  this.$$tablist = new this.widget.TabList(document.querySelector('#settings-tablist'));

  if (tab_id) {
    this.$$tablist.view.selected = this.$$tablist.view.$focused = document.querySelector(`#settings-tab-${tab_id}`);
  }

  // Activate token input
  this.activate_token_input(token);

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.
  for (let [name, value] of prefs) {
    this.activate_radiogroup(name, value);
  }
};

BzDeck.views.SettingsPage.prototype = Object.create(BzDeck.views.BaseView.prototype);
BzDeck.views.SettingsPage.prototype.constructor = BzDeck.views.SettingsPage;

BzDeck.views.SettingsPage.prototype.activate_token_input = function (token) {
  let $input = document.querySelector('#tabpanel-settings-account-token'),
      $output = $input.nextElementSibling;

  if (token) {
    $input.value = token;
    $output.textContent = 'Verified'; // l10n
  }

  $input.addEventListener('input', event => {
    if ($input.value.length === 10) {
      this.trigger(':AuthTokenProvided', { 'token': $input.value })
      $output.textContent = 'Verifying...'; // l10n
    } else {
      $output.textContent = '';
    }
  });

  this.on('C:AuthTokenVerified', data => {
    $input.setAttribute('aria-invalid', 'false');
    $output.textContent = 'Verified'; // l10n
  });

  this.on('C:AuthTokenInvalid', data => {
    $input.setAttribute('aria-invalid', 'true');
    $output.textContent = 'Invalid, try again'; // l10n
  });

  this.on('C:AuthTokenVerificationError', data => {
    BzDeck.views.statusbar.show(data.error.message);
  });
};

BzDeck.views.SettingsPage.prototype.activate_radiogroup = function (name, value) {
  let $root = document.documentElement,
      $rgroup = document.querySelector(`#tabpanel-settings [data-pref="${name}"]`),
      _value = value.user !== undefined ? value.user : value.default,
      attr = 'data-' + name.replace(/[\._]/g, '-');

  for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
    $radio.tabIndex = 0;
    $radio.setAttribute('aria-checked', $radio.dataset.value === String(_value));
  }

  (new this.widget.RadioGroup($rgroup)).bind('Selected', event => {
    _value = event.detail.items[0].dataset.value;
    _value = value.type === 'boolean' ? _value === 'true' : _value;
    this.trigger(':PrefValueChanged', { name, _value });

    if ($root.hasAttribute(attr)) {
      $root.setAttribute(attr, String(value));
    }
  });
};
