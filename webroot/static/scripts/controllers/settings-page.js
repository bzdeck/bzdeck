/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Settings Page Controller.
 * @extends BzDeck.BaseController
 */
BzDeck.SettingsPageController = class SettingsPageController extends BzDeck.BaseController {
  /**
   * Called by the app router and initialize the Settings Page Controller. If the Settings has an existing tab, switch
   * to it. Otherwise, open a new tab and load the content.
   * @constructor
   * @param {undefined}
   * @returns {Object} controller - New SettingsPageController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.subscribe('V#PrefChangeRequested');

    this.connect();
  }

  /**
   * Called by the app router to reuse the controller.
   * @param {undefined}
   * @returns {undefined}
   */
  reconnect () {
    this.connect();
  }

  /**
   * Connect to the view.
   * @param {undefined}
   * @returns {undefined}
   */
  connect () {
    let tab_id = history.state ? history.state.tab_id : undefined;
    let prefs = new Map();

    Promise.all([...Object.entries(BzDeck.config.prefs)].map(entry => {
      let [name, value] = entry;

      return BzDeck.prefs.get(name).then(_value => {
        value.user = _value;
        prefs.set(name, value);
      });
    })).then(() => {
      BzDeck.views.banner.open_tab({
        label: 'Settings',
        page: {
          category: 'settings',
          constructor: BzDeck.SettingsPageView,
          constructor_args: [prefs, tab_id],
        },
      }, this);
    });
  }

  /**
   * Called whenever a preference value is changed by the user. Save it to the database and update the UI where
   * necessary.
   * @listens SettingsPageView#PrefChangeRequested
   * @param {String} name - Preference name.
   * @param {*} value - New value.
   * @returns {undefined}
   */
  on_pref_change_requested ({ name, value } = {}) {
    BzDeck.prefs.set(name, value);

    if (name === 'ui.theme.selected') {
      this.helpers.theme.selected = value;
    }

    if (name === 'ui.date.timezone') {
      this.helpers.datetime.options.timezone = value;
    }

    if (name === 'ui.date.relative') {
      this.helpers.datetime.options.relative = value
    }

    if (name === 'notifications.show_desktop_notifications' && value === true) {
      navigator.permissions.query({ name: 'notifications' }).then(result => {
        if (result.state !== 'granted') {
          Notification.requestPermission(); // Permissions.prototype.request() is not implemented yet
        }
      });
    }
  }
}
