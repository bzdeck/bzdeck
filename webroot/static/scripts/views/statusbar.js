/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Statusbar View that represents the global application statusbar.
 * @extends BzDeck.BaseView
 */
BzDeck.StatusbarView = class StatusbarView extends BzDeck.BaseView {
  /**
   * Get a StatusbarView instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} view - New StatusbarView instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.$statusbar = document.querySelector('#app-login [role="status"]');
  }

  /**
   * Show a message on the statusbar.
   * @argument {String} message
   * @return {undefined}
   */
  show (message) {
    if (this.$statusbar) {
      this.$statusbar.textContent = message;
    }
  }
}
