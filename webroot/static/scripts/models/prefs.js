/**
 * BzDeck Prefs Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Prefs = function PrefsModel () {
  Object.defineProperties(this, {
    'store': { 'enumerable': true, 'get': () => this.get_store('account', 'prefs') },
  });
};

BzDeck.models.Prefs.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Prefs.prototype.constructor = BzDeck.models.Prefs;

BzDeck.models.Prefs.prototype.load = function () {
  let prefs = {};

  return new Promise(resolve => {
    this.store.get_all().then(result => {
      for (let pref of result) {
        prefs[pref.name] = pref.value;
      }

      this.data = new Proxy(prefs, {
        'set': (obj, key, value) => {
          obj[key] = value;
          this.store.save({ 'name': key, value });
        }
      });

      resolve();
    });
  });
};
