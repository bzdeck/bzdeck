/**
 * BzDeck Users Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.Users = function UsersController () {
  this.model = BzDeck.models.users;
  this.cache = new Map();
};

BzDeck.controllers.Users.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Users.prototype.constructor = BzDeck.controllers.Users;

BzDeck.controllers.Users.prototype.get = function (name, options = {}) {
  let user = this.cache.get(name);

  if (name && (!user || options.refresh)) {
    user = new BzDeck.controllers.User(name, undefined, options);
    this.cache.set(name, user);
  }

  return user;
};

BzDeck.controllers.Users.prototype.add = function (name, profile) {
  if (name && !this.cache.has(name) && !this.model.has(name)) {
    this.cache.set(name, new BzDeck.controllers.User(name, profile));
  }
};

BzDeck.controllers.Users.prototype.add_from_bug = function (bug) {
  let people = new Set([bug.creator_detail, bug.assigned_to_detail, bug.qa_contact_detail,
                        ...bug.cc_detail, ...bug.mentors_detail],
                        // The following fields are emails only
                        ...[for (c of bug.comments || []) c.creator],
                        ...[for (h of bug.history || []) h.who],
                        ...[for (a of bug.attachments || []) a.creator]);

  for (let person of people) {
    let profile = typeof person === 'object' ? person : { 'name': person };

    this.add(profile.name, { 'bugzilla': profile });
  }
};
