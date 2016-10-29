/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Settings Page View that represents the Settings tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.SettingsPageView = class SettingsPageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Settings Page View. If the Settings has an existing tab, switch to it.
   * Otherwise, open a new tab and load the content.
   * @constructor
   * @param {undefined}
   * @returns {Object} view - New SettingsPageView instance.
   */
  constructor () {
    super(); // Assign this.id

    // Initiate the corresponding presenter
    this.presenter = new BzDeck.SettingsPagePresenter(this.id);

    this.activate();
  }

  /**
   * Called by the app router to reuse the view.
   * @param {undefined}
   * @returns {undefined}
   */
  reactivate () {
    this.activate();
  }

  /**
   * Activate the view.
   * @param {undefined}
   * @returns {undefined}
   */
  activate () {
    let tab_id = history.state ? history.state.tab_id : undefined;
    let prefs = new Map();

    Promise.all([...Object.entries(BzDeck.config.prefs)].map(([name, value]) => {
      return BzDeck.prefs.get(name).then(_value => {
        value.user = _value;
        prefs.set(name, value);
      });
    })).then(() => {
      BzDeck.views.banner.open_tab({
        label: 'Settings', // l10n
        category: 'settings',
      }, this);

      if (this.ui_ready) {
        return;
      }

      // Activate tabs
      this.$$tablist = new FlareTail.widgets.TabList(document.querySelector('#settings-tablist'));

      if (tab_id) {
        this.$$tablist.view.selected = this.$$tablist.view.$focused = document.querySelector(`#settings-tab-${tab_id}`);
      }

      this.fill_timezone_options();

      // Currently the radiogroup/radio widget is not data driven.
      // A modern preference system is needed.
      for (let [name, value] of prefs) {
        this.activate_radiogroup(name, value);
      }

      if (FlareTail.helpers.env.device.mobile) {
        document.querySelector('#settings-tab-account').setAttribute('aria-disabled', 'true');
        document.querySelector('#settings-tab-account').setAttribute('aria-selected', 'false');
        document.querySelector('#settings-tabpanel-account').setAttribute('aria-hidden', 'true');
        document.querySelector('#settings-tab-design').setAttribute('aria-selected', 'true');
        document.querySelector('#settings-tabpanel-design').setAttribute('aria-hidden', 'false');
      } else {
        this.prepare_qrcode();
      }

      this.ui_ready = true;
    });
  }

  /**
   * Fill the timezone radio options. Each Bugzilla instance's timezone is hardcoded in our config file because the
   * Bugzilla API doesn't provide the info.
   * @param {undefined}
   * @returns {undefined}
   * @see {@link https://bugzilla.readthedocs.io/en/latest/api/core/v1/bugzilla.html#timezone}
   */
  fill_timezone_options () {
    let $radio_local = document.querySelector('#pref-timezone-local');
    let $radio_host = document.querySelector('#pref-timezone-host');
    let timezone_local = Intl.DateTimeFormat().resolvedOptions().timeZone;
    let timezone_host = BzDeck.host.timezone;

    $radio_local.textContent = `Your local timezone (${timezone_local})`;
    $radio_host.textContent = `Bugzilla default (${timezone_host})`;
    $radio_host.dataset.value = timezone_host;
  }

  /**
   * Activate each radiogroup on the Settings page.
   * @param {String} name - Preference name.
   * @param {Object} _value - Preference value.
   * @param {*}      _value.user - User-defined value.
   * @param {*}      _value.default - Default value.
   * @param {String} _value.type - Type of the value: boolean, integer or string.
   * @fires SettingsPageView#PrefChangeRequested
   * @returns {undefined}
   */
  activate_radiogroup (name, _value) {
    let $root = document.documentElement;
    let $rgroup = document.querySelector(`[id^="tabpanel-settings"] [data-pref="${name}"]`);
    let value = _value.user !== undefined ? _value.user : _value.default;
    let attr = 'data-' + name.replace(/[\._]/g, '-');

    for (let $radio of $rgroup.querySelectorAll('[role="radio"]')) {
      $radio.tabIndex = 0;
      $radio.setAttribute('aria-checked', $radio.dataset.value === String(value));
    }

    (new FlareTail.widgets.RadioGroup($rgroup)).bind('Selected', event => {
      value = event.detail.items[0].dataset.value;
      value = _value.type === 'boolean' ? value === 'true' : value;
      this.trigger('#PrefChangeRequested', { name, value });

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
