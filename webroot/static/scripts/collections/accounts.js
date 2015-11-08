/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Account Collection.
 *
 * [argument] none
 * [return] bugs (Object) new instance of the AccountCollection object, when called with `new`
 */
BzDeck.collections.Accounts = function AccountCollection () {
  this.datasource = BzDeck.datasources.global;
  this.store_name = 'accounts';
  this.model = BzDeck.models.Account;
};

BzDeck.collections.Accounts.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Accounts.prototype.constructor = BzDeck.collections.Accounts;

/*
 * Get the currently signed-in account if any.
 *
 * [argument] none
 * [return] account (Object) AccountModel instance
 */
BzDeck.collections.Accounts.prototype.get_current = function () {
  return [...this.get_all().values()].find(account => account.data.active);
};
