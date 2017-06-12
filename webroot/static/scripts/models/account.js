/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Account Model that represents the user's Bugzilla account. Available through the AccountCollection.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 */
BzDeck.AccountModel = class AccountModel extends BzDeck.BaseModel {
  /**
   * Get an AccountModel instance.
   * @param {Object} data - User account data including Bugzilla account info.
   * @returns {AccountModel} New AccountModel instance.
   */
  constructor (data) {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'accounts';
    this.data = data;

    Object.defineProperties(this, {
      permissions: {
        enumerable: true,
        value: data.bugzilla && data.bugzilla.groups ? data.bugzilla.groups.map(group => group.name) : [],
      },
    });
  }
}
