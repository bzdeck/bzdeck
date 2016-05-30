/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Settings Page Presenter.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.SettingsPagePresenter = class SettingsPagePresenter extends BzDeck.BasePresenter {
  /**
   * Get a SettingsPagePresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New SettingsPagePresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    // Subscribe to events
    this.subscribe('V#PrefChangeRequested');
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
      FlareTail.helpers.theme.selected = value;
    }

    if (name === 'ui.date.timezone') {
      FlareTail.helpers.datetime.options.timezone = value;
    }

    if (name === 'ui.date.relative') {
      FlareTail.helpers.datetime.options.relative = value
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
