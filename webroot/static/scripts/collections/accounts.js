/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Account Collection that represents the user's Bugzilla accounts. Each account is an AccountModel.
 * @extends BzDeck.BaseCollection
 * @todo Move this to the worker thread.
 */
BzDeck.AccountCollection = class AccountCollection extends BzDeck.BaseCollection {
  /**
   * Get an AccountCollection instance.
   * @returns {AccountCollection} New AccountCollection instance.
   */
  constructor () {
    super(); // Assign this.id

    this.datasource = BzDeck.datasources.global;
    this.store_name = 'accounts';
    this.model = BzDeck.AccountModel;
  }

  /**
   * Get the currently signed-in user account if any.
   * @returns {Promise.<Object>} AccountModel instance.
   */
  async get_current () {
    const accounts = await this.get_all();

    return [...accounts.values()].find(account => account.data.active);
  }
}
