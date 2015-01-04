/**
 * BzDeck Bugs Model
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 */

'use strict';

let BzDeck = BzDeck || {};

BzDeck.models = BzDeck.models || {};

/* ------------------------------------------------------------------------------------------------------------------
 * Bugs
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.models.bugs = {};

BzDeck.models.bugs.get_bug_by_id = function (id, record_time = true) {
  let cache = BzDeck.models.data.bugs,
      store = BzDeck.models.get_store('bugs');

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

BzDeck.models.bugs.get_bugs_by_ids = function (ids) {
  let cache = BzDeck.models.data.bugs;

  ids = [...ids]; // Accept both an Array and a Set as the first argument

  return new Promise(resolve => {
    if (cache) {
      resolve([for (c of [...cache]) if (ids.includes(c[0])) c[1]]);

      return;
    }

    BzDeck.models.get_store('bugs').get_all().then(bugs => {
      resolve([for (bug of bugs) if (ids.includes(bug.id)) bug]);
    });
  });
};

BzDeck.models.bugs.get_all = function () {
  let cache = BzDeck.models.data.bugs;

  return new Promise(resolve => {
    if (cache) {
      resolve([for (c of [...cache]) c[1]]); // Convert Map to Array

      return;
    }

    BzDeck.models.get_store('bugs').get_all().then(bugs => {
      resolve(bugs || []);

      if (bugs && !cache) {
        BzDeck.models.data.bugs = new Map([for (bug of bugs) [bug.id, bug]]);
      }
    });
  });
};

BzDeck.models.bugs.save_bug = function (bug) {
  return new Promise(resolve => this.save_bugs([bug]).then(bugs => resolve(bug)));
};

BzDeck.models.bugs.save_bugs = function (bugs) {
  let cache = BzDeck.models.data.bugs,
      transaction = BzDeck.models.databases.account.transaction('bugs', 'readwrite'),
      store = transaction.objectStore('bugs');

  return new Promise(resolve => {
    transaction.addEventListener('complete', event => resolve(bugs));

    if (!cache) {
      cache = BzDeck.models.data.bugs = new Map();
    }

    for (let bug of bugs) if (bug.id) {
      cache.set(bug.id, bug);
      store.put(bug);
    }
  });
};

BzDeck.models.bugs.get_subscription_by_id = function (id) {
  let email = BzDeck.models.data.account.name;

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

BzDeck.models.bugs.get_subscribed_bugs = function () {
  let email = BzDeck.models.data.account.name;

  return new Promise(resolve => {
    this.get_all().then(bugs => {
       resolve([for (bug of bugs) 
                 if (bug.cc.includes(email) || bug.creator === email || bug.assigned_to === email ||
                     bug.mentors.includes(email) || bug.qa_contact === email ||
                     [for (flag of bug.flags || []) if (flag.requestee === email) flag].length) bug]);
    });
  });
};
