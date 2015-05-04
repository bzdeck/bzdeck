/**
 * BzDeck Account Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Account Model.
 *
 * [argument] data (Object) user account data
 * [return] account (Proxy) instance of the AccountModel object, when called with `new`
 */
BzDeck.models.Account = function AccountModel (data) {
  this.datasource = BzDeck.datasources.global;
  this.store_name = 'accounts';
  this.data = data;
};

BzDeck.models.Account.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Account.prototype.constructor = BzDeck.models.Account;
