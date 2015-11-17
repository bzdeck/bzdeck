/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Statusbar View that represents the global application statusbar.
 *
 * @constructor
 * @extends BaseView
 * @argument {undefined}
 * @return {Object} view - New StatusbarView instance.
 */
BzDeck.views.Statusbar = function StatusbarView () {
  this.$statusbar = document.querySelector('#app-login [role="status"]');
};

BzDeck.views.Statusbar.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.Statusbar.prototype.constructor = BzDeck.views.Statusbar;

/**
 * Show a message on the statusbar.
 *
 * @argument {String} message
 * @return {undefined}
 */
BzDeck.views.Statusbar.prototype.show = function (message) {
  if (this.$statusbar) {
    this.$statusbar.textContent = message;
  }
};
