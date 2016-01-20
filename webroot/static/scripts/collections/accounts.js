/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Account Collection that represents the user's Bugzilla accounts. Each account is an AccountModel.
 * @extends BzDeck.BaseCollection
 */
BzDeck.AccountCollection = class AccountCollection extends BzDeck.BaseCollection {
  /**
   * Get an AccountCollection instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} accounts - New AccountCollection instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'accounts';
    this.model = BzDeck.models.Account;
  }

  /**
   * Get the currently signed-in user account if any.
   * @argument {undefined}
   * @return {Promise.<Object>} account - Promise to be resolved in AccountModel instance.
   */
  get_current () {
    return this.get_all().then(accounts => [...accounts.values()].find(account => account.data.active));
  }
}
