/**
 * BzDeck Users Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.users = {};

BzDeck.controllers.users.fetch_user = function (email, api_key = undefined) {
  let params = new URLSearchParams();

  params.append('names', email);

  if (api_key) {
    params.append('api_key', api_key);
  }

  return new Promise((resolve, reject) => {
    BzDeck.controllers.core.request('GET', 'user', params).then(result => {
      result.error ? reject(new Error(result.message || 'User Not Found')) : resolve(result.users[0]);
    }).catch(event => {
      reject(new Error('Network Error')); // l10n
    });
  });
};

BzDeck.controllers.users.get_name = function (person, remove_comment = false) {
  let name = person.real_name;

  if (name) {
    return remove_comment ? name.replace(/\s[\[\(<‹].*[›>\)\]]/g, '') : name; // Remove bracketed strings if needed
  }

  return person.email.split('@')[0];
};

BzDeck.controllers.users.get_color = function (person) {
  return '#' + String(person.real_name ? person.real_name.length : 0).substr(-1, 1)
             + String(person.name.length).substr(-1, 1) + String(person.name.length).substr(0, 1);
};

/* ------------------------------------------------------------------------------------------------------------------
 * Gravatar
 * ------------------------------------------------------------------------------------------------------------------ */

BzDeck.controllers.Gravatar = function Gravatar (email) {
  this.hash = md5(email);
  this.avatar_url = this.endpoint + '/avatar/' + this.hash + '?s=160&d=mm';
  this.profile_url = this.endpoint + '/' + this.hash + '.json';
};

BzDeck.controllers.Gravatar.prototype.endpoint = 'https://secure.gravatar.com';

BzDeck.controllers.Gravatar.prototype.get_profile = function () {
  return new Promise(resolve => FlareTail.util.network.jsonp(this.profile_url).then(data => resolve(data.entry[0])));
};
