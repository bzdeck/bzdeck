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
