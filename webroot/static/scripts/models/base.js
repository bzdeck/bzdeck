/**
 * BzDeck Base Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models = BzDeck.models || {};

BzDeck.models.Base = function BaseModel () {};
BzDeck.models.Base.prototype = Object.create(FlareTail.app.Model.prototype);
BzDeck.models.Base.prototype.constructor = BzDeck.models.Base;

BzDeck.models.Base.prototype.get_transaction = function (db_name, store_name) {
  return BzDeck.models[db_name].database.transaction(store_name, 'readwrite');
};

BzDeck.models.Base.prototype.get_store = function (db_name, store_name) {
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

BzDeck.models.Base.prototype.open_database = function (req) {
  return new Promise((resolve, reject) => {
    req.addEventListener('success', event => resolve(event.target.result));
    req.addEventListener('error', event => reject(new Error('Failed to open the database. Make sure you’re not using \
                                                             private browsing mode or IndexedDB doesn’t work.')));
  });
};

/*
 * Get a proxified 'this' object, so consumers can access data seamlessly using obj.prop instead of obj.data.prop
 *
 * [argument] none
 * [return] this (Proxy) proxified 'this' object
 */
BzDeck.models.Base.prototype.proxy = function (data) {
  return new Proxy(this, {
    'get': (obj, prop) => prop in this ? this[prop] : this.data[prop],
    'set': (obj, prop, value) => {
      prop in this ? this[prop] = value : this.data[prop] = value;

      return true; // The set trap must return true (Bug 1132522)
    },
  });
};

/*
 * Cache data as a new Proxy, so the object is automatically saved when a property is modifled.
 *
 * [argument] data (Object) raw data object
 * [return] data (Proxy) proxified data object
 */
BzDeck.models.Base.prototype.cache = function (data) {
  // Deproxify the object just in case
  data = Object.assign({}, data);

  return this.data = new Proxy(data, {
    'get': (obj, prop) => obj[prop], // Always require the get trap (Bug 895223)
    'set': (obj, prop, value) => {
      obj[prop] = value;
      this.store.save(obj);

      return true; // The set trap must return true (Bug 1132522)
    },
  });
};

/*
 * Save data in the local IndexedDB storage.
 *
 * [argument] data (Object, optional) raw data object
 * [return] item (Promise -> Proxy) proxified instance of the model object
 */
BzDeck.models.Base.prototype.save = function (data = undefined) {
  if (data) {
    this.cache(data);
  }

  return this.store.save(this.data).then(() => Promise.resolve(this.proxy()));
};
