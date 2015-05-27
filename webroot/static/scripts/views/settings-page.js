/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.SettingsPage = function SettingsPageView (tab_id, api_key, api_key_link, prefs) {
  // Activate tabs
  this.$$tablist = new this.widget.TabList(document.querySelector('#settings-tablist'));

  if (tab_id) {
    this.$$tablist.view.selected = this.$$tablist.view.$focused = document.querySelector(`#settings-tab-${tab_id}`);
  }

  // Activate the API Key input widget
  this.activate_api_key_input(api_key, api_key_link);

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.
  for (let [name, value] of prefs) {
    this.activate_radiogroup(name, value);
  }
};

BzDeck.views.SettingsPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.SettingsPage.prototype.constructor = BzDeck.views.SettingsPage;

BzDeck.views.SettingsPage.prototype.activate_api_key_input = function (api_key, api_key_link) {
  let $input = document.querySelector('#settings-tabpanel-account input'),
      $output = document.querySelector('#settings-tabpanel-account output'),
      $link = document.querySelector('#settings-tabpanel-account a');

  if (api_key) {
    $input.value = api_key;
    $output.value = 'Verified'; // l10n
  }

  $link.href = api_key_link;

  $input.addEventListener('input', event => {
    if ($input.value.length === $input.maxLength) {
      this.trigger(':APIKeyProvided', { 'api_key': $input.value })
      $output.value = 'Verifying...'; // l10n
    } else {
      $output.value = '';
    }
  });

  this.on('C:APIKeyVerified', data => {
    $input.setAttribute('aria-invalid', 'false');
    $output.value = 'Verified'; // l10n
  });

  this.on('C:APIKeyInvalid', data => {
    $input.setAttribute('aria-invalid', 'true');
    $output.value = 'Invalid, try again'; // l10n
  });

  this.on('C:APIKeyVerificationError', data => {
    BzDeck.views.statusbar.show(data.error.message);
  });
};

BzDeck.views.SettingsPage.prototype.activate_radiogroup = function (name, _value) {
  let $root = document.documentElement,
      $rgroup = document.querySelector(`#tabpanel-settings [data-pref="${name}"]`),
      value = _value.user !== undefined ? _value.user : _value.default,
      attr = 'data-' + name.replace(/[\._]/g, '-');

  for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
    $radio.tabIndex = 0;
    $radio.setAttribute('aria-checked', $radio.dataset.value === String(value));
  }

  (new this.widget.RadioGroup($rgroup)).bind('Selected', event => {
    value = event.detail.items[0].dataset.value;
    value = _value.type === 'boolean' ? value === 'true' : value;
    this.trigger(':PrefValueChanged', { name, value });

    if ($root.hasAttribute(attr)) {
      $root.setAttribute(attr, String(value));
    }
  });
};
