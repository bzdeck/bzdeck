/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Settings Page View that represents the Settings tabpanel content.
 *
 * @constructor
 * @extends BaseView
 * @argument {Map.<String, Object>} prefs - User preference Map.
 * @argument {String} [tab_id] - Optional tab ID to select. If not specified, the first tab will be selected.
 * @return {Object} view - New SettingsPageView instance.
 */
BzDeck.views.SettingsPage = function SettingsPageView (prefs, tab_id) {
  if (this.helpers.env.device.mobile) {
    document.querySelector('#settings-tab-account').setAttribute('aria-disabled', 'true');
    document.querySelector('#settings-tab-account').setAttribute('aria-selected', 'false');
    document.querySelector('#settings-tabpanel-account').setAttribute('aria-hidden', 'true');
    document.querySelector('#settings-tab-design').setAttribute('aria-selected', 'true');
    document.querySelector('#settings-tabpanel-design').setAttribute('aria-hidden', 'false');
  } else {
    this.show_qrcode();
  }

  // Activate tabs
  this.$$tablist = new this.widgets.TabList(document.querySelector('#settings-tablist'));

  if (tab_id) {
    this.$$tablist.view.selected = this.$$tablist.view.$focused = document.querySelector(`#settings-tab-${tab_id}`);
  }

  // Currently the radiogroup/radio widget is not data driven.
  // A modern preference system is needed.
  for (let [name, value] of prefs) {
    this.activate_radiogroup(name, value);
  }
};

BzDeck.views.SettingsPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.SettingsPage.prototype.constructor = BzDeck.views.SettingsPage;

/**
 * Activate each radiogroup on the Settings page.
 *
 * @argument {String} name - Preference name.
 * @argument {Object} _value - Preference value.
 * @argument {*}      _value.user - User-defined value.
 * @argument {*}      _value.default - Default value.
 * @argument {String} _value.type - Type of the value: boolean, integer or string.
 * @return {undefined}
 */
BzDeck.views.SettingsPage.prototype.activate_radiogroup = function (name, _value) {
  let $root = document.documentElement,
      $rgroup = document.querySelector(`#tabpanel-settings [data-pref="${name}"]`),
      value = _value.user !== undefined ? _value.user : _value.default,
      attr = 'data-' + name.replace(/[\._]/g, '-');

  for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
    $radio.tabIndex = 0;
    $radio.setAttribute('aria-checked', $radio.dataset.value === String(value));
  }

  (new this.widgets.RadioGroup($rgroup)).bind('Selected', event => {
    value = event.detail.items[0].dataset.value;
    value = _value.type === 'boolean' ? value === 'true' : value;
    this.trigger(':PrefValueChanged', { name, value });

    if ($root.hasAttribute(attr)) {
      $root.setAttribute(attr, String(value));
    }
  });
};

/**
 * Generate and display the mobile authentication QR code on the Account tabpanel. The code encodes the user's Bugzilla
 * account name and API key.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.views.SettingsPage.prototype.show_qrcode = function () {
  let $outer = document.querySelector('#settings-qrcode-outer');

  // Because the QRCode library doesn't support the strict mode, load the script in an iframe
  $outer.querySelector('iframe').addEventListener('load', event => {
    let QRCode = event.target.contentWindow.QRCode,
        { name, api_key } = BzDeck.models.account.data;

    new QRCode($outer.querySelector('div'), { text: [name, api_key].join('|'), width: 192, height: 192 });
  });
};
