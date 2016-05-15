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

    this.data = new Proxy({}, {
      set: (obj, prop, value) => {
        obj[prop] = value;

        if (prop === 'progress') {
          this.update_progressbar();

          if (value === 0 || value >= 95) {
            window.clearInterval(this.progress_updater);
          }
        }

        return true;
      },
    });
  }

  /**
   * Show a message on the statusbar.
   * @argument {String} message
   * @return {undefined}
   */
  show (message) {
    if (this.$statusbar) {
      this.$statusbar.querySelector('p').textContent = message;
    }
  }

  /**
   * Start showing the current loading progress.
   * @argument {Boolean} [auto_increment=true] - Periodically update the progressbar rather than reflecting the actual
   *  loading state.
   * @return {undefined}
   */
  start_loading (auto_increment = true) {
    this.$progressbar = this.$statusbar.querySelector('[role="progressbar"]');

    if (this.$progressbar) {
      this.data.progress = 0;

      if (auto_increment) {
        this.progress_updater = window.setInterval(() => this.data.progress += 6, 500);
      }
    }
  }

  /**
   * Stop showing the current loading progress.
   * @argument {undefined}
   * @return {undefined}
   */
  stop_loading () {
    if (this.$progressbar) {
      this.data.progress = 100;
    }
  }

  /**
   * Update the progressbar UI.
   * @argument {undefined}
   * @return {undefined}
   */
  update_progressbar () {
    let percentage = this.data.progress;

    this.$progressbar.setAttribute('aria-valuenow', percentage);
    this.$progressbar.setAttribute('aria-valuetext', `${percentage}% Loaded`); // l10n
    this.$progressbar.style.setProperty('width', `${percentage}%`);
  }
}
