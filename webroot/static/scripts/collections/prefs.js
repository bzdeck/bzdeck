/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Pref Collection.
 *
 * [argument] none
 * [return] bugs (Object) new instance of the PrefCollection object, when called with `new`
 */
BzDeck.collections.Prefs = function PrefCollection () {
  this.datasource = BzDeck.datasources.account;
  this.store_name = 'prefs';
  this.store_type = 'simple';
};

BzDeck.collections.Prefs.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Prefs.prototype.constructor = BzDeck.collections.Prefs;
