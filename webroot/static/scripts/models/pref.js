/**
 * BzDeck Pref Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Pref = function PrefsModel () {};

BzDeck.models.Pref.prototype = Object.create(BzDeck.models.BaseModel.prototype);
BzDeck.models.Pref.prototype.constructor = BzDeck.models.Pref;

BzDeck.models.Pref.prototype.load = function () {
  let prefs = {};

  return new Promise(resolve => {
    this.get_store('prefs').get_all().then(result => {
      for (let pref of result) {
        prefs[pref.name] = pref.value;
      }

      this.data = new Proxy(prefs, {
        'set': (obj, key, value) => {
          obj[key] = value;
          this.get_store('prefs').save({ 'name': key, value });
        }
      });

      resolve();
    });
  });
};
