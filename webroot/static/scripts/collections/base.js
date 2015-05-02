/**
 * BzDeck Base Collection
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.collections = BzDeck.collections || {};

BzDeck.collections.Base = function BaseCollection () {};
BzDeck.collections.Base.prototype = Object.create(FlareTail.app.Collection.prototype);
BzDeck.collections.Base.prototype.constructor = BzDeck.collections.Base;

BzDeck.collections.Base.prototype.key_name = 'id';
BzDeck.collections.Base.prototype.map = new Map();

BzDeck.collections.Base.prototype.get_transaction = function (db_name, store_name) {
  return BzDeck.models[db_name].database.transaction(store_name, 'readwrite');
};

BzDeck.collections.Base.prototype.get_store = function (db_name, store_name) {
  let store = this.get_transaction(db_name, store_name).objectStore(store_name),
      send = request => new Promise((resolve, reject) => {
        request.addEventListener('success', event => resolve(event.target.result));
        request.addEventListener('error', event => reject(event.target.error));
      });

  return {
    'save': obj => send(store.put(Object.assign({}, obj))), // Deproxify the object before saving
    'get': key => send(store.get(key)),
    'get_all': () => send(store.mozGetAll()),
    'delete': key => send(store.delete(key)),
    'clear': () => send(store.clear()),
  };
};

BzDeck.collections.Base.prototype.open_database = function (req) {
  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Failed to open the database. Make sure you’re not using \
                                                             private browsing mode or IndexedDB doesn’t work.')));
  });
};

/*
 * Load the all data from local IndexedDB, create a new model instance for each item, then cache them in a new Map for
 * faster access.
 *
 * [argument] none
 * [return] items (Promise -> Map(String or Number, Proxy)) new instances of the model object
 */
BzDeck.collections.Base.prototype.load = function () {
  return this.get_store(this.db_name, this.store_name).get_all().then(items => {
    this.map = new Map([for (item of items) [item[this.key_name], new this.model(item)]]);

    return Promise.resolve(this.map);
  });
};

/*
 * Add an item data to the database.
 *
 * [argument] data (Object) raw data object
 * [return] item (Proxy) new instance of the model object
 */
BzDeck.collections.Base.prototype.add = function (data) {
  let item = new this.model(data);

  item.save();
  this.map.set(item[this.key_name], item);

  return item;
};

/*
 * Check if an item with a specific key is in the database.
 *
 * [argument] key (Number or String) key of the item
 * [return] result (Boolean) whether the item exists
 */
BzDeck.collections.Base.prototype.has = function (key) {
  key = Number.isNaN(key) ? key : Number.parseInt(key);

  return this.map.has(key);
};

/*
 * Get an item by a specific key.
 *
 * [argument] key (Number or String) key of the item
 * [argument] fallback_data (Object, optional) if an item is not found, create a new model object with this data
 * [return] item (Proxy or undefined) new instance of the model object
 */
BzDeck.collections.Base.prototype.get = function (key, fallback_data = undefined) {
  key = Number.isNaN(key) ? key : Number.parseInt(key);

  if (this.has(key)) {
    return this.map.get(key);
  }

  if (fallback_data) {
    fallback_data[this.key_name] = key;

    return this.add(fallback_data);
  }

  return undefined;
};

/*
 * Get items by specific keys.
 *
 * [argument] keys (Array(String or Number) or Set(String or Number)) key list
 * [return] items (Map(String or Number, Proxy)) new instances of the model object
 */
BzDeck.collections.Base.prototype.get_some = function (keys) {
  return new Map([for (key of keys) [key, this.get(key)]]);
};

/*
 * Get all items locally-stored in IndexedDB.
 *
 * [argument] none
 * [return] items (Map(String or Number, Proxy)) new instances of the model object
 */
BzDeck.collections.Base.prototype.get_all = function () {
  return this.map;
};
