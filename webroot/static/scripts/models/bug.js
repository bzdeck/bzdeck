/**
 * BzDeck Bug Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.models.Bug = function BugModel () {};

BzDeck.models.Bug.prototype = Object.create(BzDeck.models.BaseModel.prototype);
BzDeck.models.Bug.prototype.constructor = BzDeck.models.Bug;

BzDeck.models.Bug.prototype.get = function (id, record_time = true) {
  let cache = this.data,
      store = this.get_store('bugs');

  return new Promise(resolve => {
    if (cache) {
      let bug = cache.get(id);

      if (bug) {
        resolve(bug);

        if (record_time) {
          bug._last_viewed = Date.now();
          cache.set(id, bug);
          store.save(bug);
        }

        return;
      }
    }

    store.get(id).then(bug => {
      resolve(bug);

      if (bug && record_time) {
        bug._last_viewed = Date.now();

        if (cache) {
          cache.set(id, bug);
        }

        store.save(bug);
      }
    });
  });
};

BzDeck.models.Bug.prototype.get_bugs = function (ids) {
  let cache = this.data;

  ids = [...ids]; // Accept both an Array and a Set as the first argument

  return new Promise(resolve => {
    if (cache) {
      resolve([for (c of [...cache]) if (ids.includes(c[0])) c[1]]);

      return;
    }

    this.get_store('bugs').get_all().then(bugs => {
      resolve([for (bug of bugs) if (ids.includes(bug.id)) bug]);
    });
  });
};

BzDeck.models.Bug.prototype.get_all = function () {
  let cache = this.data;

  return new Promise(resolve => {
    if (cache) {
      resolve([for (c of [...cache]) c[1]]); // Convert Map to Array

      return;
    }

    this.get_store('bugs').get_all().then(bugs => {
      resolve(bugs || []);

      if (bugs && !cache) {
        this.data = new Map([for (bug of bugs) [bug.id, bug]]);
      }
    });
  });
};

BzDeck.models.Bug.prototype.save = function (bug) {
  return new Promise(resolve => this.save_bugs([bug]).then(bugs => resolve(bug)));
};

BzDeck.models.Bug.prototype.save_bugs = function (bugs) {
  let cache = this.data,
      transaction = BzDeck.models.databases.account.transaction('bugs', 'readwrite'),
      store = transaction.objectStore('bugs');

  return new Promise(resolve => {
    transaction.addEventListener('complete', event => resolve(bugs));

    if (!cache) {
      cache = this.data = new Map();
    }

    for (let bug of bugs) if (bug.id) {
      cache.set(bug.id, bug);
      store.put(bug);
    }
  });
};

BzDeck.models.Bug.prototype.get_subscription = function (id) {
  let email = BzDeck.models.account.data.name;

  return new Promise(resolve => {
    this.get_all().then(bugs => {
      if (id === 'watching') {
        resolve([for (bug of bugs) if (bug.cc.includes(email)) bug]);
      }

      if (id === 'reported') {
        resolve([for (bug of bugs) if (bug.creator === email) bug]);
      }

      if (id === 'assigned') {
        resolve([for (bug of bugs) if (bug.assigned_to === email) bug]);
      }

      if (id === 'mentor') {
        resolve([for (bug of bugs) if (bug.mentors.includes(email)) bug]);
      }

      if (id === 'qa') {
        resolve([for (bug of bugs) if (bug.qa_contact === email) bug]);
      }

      if (id === 'requests') {
        resolve([for (bug of bugs) if (bug.flags) for (flag of bug.flags) if (flag.requestee === email) bug]);
      }
    });
  });
};

BzDeck.models.Bug.prototype.get_subscribed_bugs = function () {
  let email = BzDeck.models.account.data.name;

  return new Promise(resolve => {
    this.get_all().then(bugs => {
       resolve([for (bug of bugs) 
                 if (bug.cc.includes(email) || bug.creator === email || bug.assigned_to === email ||
                     bug.mentors.includes(email) || bug.qa_contact === email ||
                     [for (flag of bug.flags || []) if (flag.requestee === email) flag].length) bug]);
    });
  });
};
