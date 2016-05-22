/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Details Page View that represents the Bug Details page's tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.DetailsPageView = class DetailsPageView extends BzDeck.BaseView {
  /**
   * Get a DetailsPageView instance.
   * @constructor
   * @listens BugContainerController#BugDataAvailable
   * @param {Number} instance_id - 13-digit identifier for a new instance, generated with Date.now().
   * @param {Number} bug_id - ID of the bug to display.
   * @returns {Object} view - New DetailsPageView instance.
   */
  constructor (instance_id, bug_id) {
    super(); // This does nothing but is required before using `this`

    this.id = instance_id;
    this.bug_id = bug_id;
    this.$tab = document.querySelector(`#tab-details-${this.id}`);
    this.$tabpanel = document.querySelector(`#tabpanel-details-${this.id}`);
    this.container = new BzDeck.BugContainerView(this.id, this.$tabpanel);

    this.on('BugContainerController#BugDataAvailable', data => {
      if (data.bug.id === this.bug_id) {
        this.$tab.title = `Bug ${data.bug.id}\n${data.bug.summary || 'Loading...'}`; // l10n
        BzDeck.views.global.update_window_title(this.$tab);
      }
    });
  }
}
