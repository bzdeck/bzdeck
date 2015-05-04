/**
 * BzDeck Accounts Collection
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Accounts Collection.
 *
 * [argument] none
 * [return] bugs (Object) new instance of the AccountsCollection object, when called with `new`
 */
BzDeck.collections.Accounts = function AccountsCollection () {
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
  return [for (account of this.get_all().values()) if (account.data.active) account][0];
};
