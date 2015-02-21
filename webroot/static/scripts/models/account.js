/**
 * BzDeck Account Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Account = function AccountModel () {};

BzDeck.models.Account.prototype = Object.create(BzDeck.models.BaseModel.prototype);
BzDeck.models.Account.prototype.constructor = BzDeck.models.Account;

BzDeck.models.Account.prototype.get_all = function () {
  return new Promise((resolve, reject) => {
    this.get_store('accounts').get_all()
        .then(accounts => resolve(accounts))
        .catch(error => reject(new Error('Failed to load accounts.'))); // l10n
  });  
};

BzDeck.models.Account.prototype.get_active_account = function () {
  return new Promise((resolve, reject) => {
    this.get_all().then(accounts => {
      let account = [for (account of accounts) if (account.active) account][0];

      if (account) {
        this.data = account;
        resolve(account);
      } else {
        reject(new Error('Account Not Found'));
      }
    });
  });
};

BzDeck.models.Account.prototype.save = function (account) {
  this.data = account;

  return new Promise((resolve, reject) => {
    this.get_store('accounts').save(account)
        .then(result => resolve(result))
        .catch(error => reject(new Error('Failed to save the account.'))); // l10n
  });
};
