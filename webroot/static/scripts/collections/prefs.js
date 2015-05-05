/**
 * BzDeck Pref Collection
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

/*
 * Initialize the Pref Collection.
 *
 * [argument] none
 * [return] bugs (Object) new instance of the PrefCollection object, when called with `new`
 */
BzDeck.collections.Prefs = function PrefCollection () {
  this.datasource = BzDeck.datasources.account;
  this.store_name = 'prefs';
};

BzDeck.collections.Prefs.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Prefs.prototype.constructor = BzDeck.collections.Prefs;

/*
 * Load the all preference data from local IndexedDB, create a new model instance for each item, then cache them in a
 * new Map for faster access. This method overrides FlareTail.app.Collection.prototype.load.
 *
 * [argument] none
 * [return] items (Promise -> Map(String or Number, Proxy)) new instances of the model object
 */
BzDeck.collections.Prefs.prototype.load = function () {
  // Get IDBRequest instead of the result array
  return this.datasource.get_store(this.store_name, true).get_all().then(request => {
    this.map = new Map([for (item of request.result) [item[request.source.keyPath], item.value]]);

    return Promise.resolve(this.map);
  });
};

/*
 * Save the specified preference key/value. This method overrides FlareTail.app.Collection.prototype.set.
 *
 * [argument] key (String) preference name
 * [argument] value (Mixed) preference value
 * [return] value (Mixed) preference value
 */
BzDeck.collections.Prefs.prototype.set = function (key, value) {
  this.datasource.get_store(this.store_name).save({ 'name': key, value });
  this.map.set(key, value);

  return value;
};
