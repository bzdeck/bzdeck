/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Settings Page View that represents the Settings tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.SettingsPageView = class SettingsPageView extends BzDeck.BaseView {
  /**
   * Get a SettingsPageView instance.
   * @constructor
   * @param {Map.<String, Object>} prefs - User preference Map.
   * @param {String} [tab_id] - Optional tab ID to select. If not specified, the first tab will be selected.
   * @returns {Object} view - New SettingsPageView instance.
   */
  constructor (prefs, tab_id) {
    super(); // This does nothing but is required before using `this`

    if (this.helpers.env.device.mobile) {
      document.querySelector('#settings-tab-account').setAttribute('aria-disabled', 'true');
      document.querySelector('#settings-tab-account').setAttribute('aria-selected', 'false');
      document.querySelector('#settings-tabpanel-account').setAttribute('aria-hidden', 'true');
      document.querySelector('#settings-tab-design').setAttribute('aria-selected', 'true');
      document.querySelector('#settings-tabpanel-design').setAttribute('aria-hidden', 'false');
    } else {
      this.prepare_qrcode();
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
  }

  /**
   * Activate each radiogroup on the Settings page.
   * @param {String} name - Preference name.
   * @param {Object} _value - Preference value.
   * @param {*}      _value.user - User-defined value.
   * @param {*}      _value.default - Default value.
   * @param {String} _value.type - Type of the value: boolean, integer or string.
   * @returns {undefined}
   * @fires SettingsPageView#PrefValueChanged
   */
  activate_radiogroup (name, _value) {
    let $root = document.documentElement;
    let $rgroup = document.querySelector(`#tabpanel-settings [data-pref="${name}"]`);
    let value = _value.user !== undefined ? _value.user : _value.default;
    let attr = 'data-' + name.replace(/[\._]/g, '-');

    for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
      $radio.tabIndex = 0;
      $radio.setAttribute('aria-checked', $radio.dataset.value === String(value));
    }

    (new this.widgets.RadioGroup($rgroup)).bind('Selected', event => {
      value = event.detail.items[0].dataset.value;
      value = _value.type === 'boolean' ? value === 'true' : value;
      this.trigger('#PrefValueChanged', { name, value });

      if ($root.hasAttribute(attr)) {
        $root.setAttribute(attr, String(value));
      }
    });
  }

  /**
   * Generate and display the mobile authentication QR code on the Account tabpanel. The code encodes the user's
   * Bugzilla account name and API key.
   * @param {undefined}
   * @returns {undefined}
   */
  prepare_qrcode () {
    let $outer = document.querySelector('#settings-qrcode-outer');
    let $placeholder = $outer.querySelector('.placeholder');
    let $iframe = $outer.querySelector('iframe');
    let $button = $outer.querySelector('[role="button"]');

    // Because the QRCode library doesn't support the strict mode, load the script in an iframe
    let generate = event => {
      let QRCode = event.target.contentWindow.QRCode;
      let { name, api_key } = BzDeck.account.data;

      new QRCode($placeholder, { text: [name, api_key].join('|'), width: 192, height: 192, });

      $iframe.removeEventListener('load', generate);
    };

    // Show the code on demand
    $button.addEventListener('click', event => {
      if ($placeholder.hidden) {
        $placeholder.hidden = false;
        $button.textContent = 'Hide QR Code'; // l10n

        if (!$iframe) {
          $iframe = document.createElement('iframe');
          $iframe.addEventListener('load', generate);
          $iframe.hidden = true;
          $iframe.src = '/integration/qrcode-encoder/';
          $outer.appendChild($iframe);
        }
      } else {
        $placeholder.hidden = true;
        $button.textContent = 'Show QR Code'; // l10n
      }
    });
  }
}
