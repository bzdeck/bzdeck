/**
 * BzDeck User Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.User = function UserController (name, profile = undefined, options = {}) {
  this.model = BzDeck.models.user;
  this.profiles = this.model.get(name) || profile || { 'bugzilla': { name }};
  this.email = name;

  // For Gravatar requests; depending on the JavaScript-MD5 library
  this.hash = md5(name);

  // These properties should work even when the user's Bugzilla profile is still being loaded
  Object.defineProperties(this, {
    // This is not the Bugzilla user name (email address) but pretty name.
    // Replace both 'Kohei Yoshino [:Kohei]' and 'Kohei Yoshino :Kohei' with 'Kohei Yoshino'
    'name': {
      'enumerable': true,
      'get': () => this.original_name.replace(/[\[\(<‹].*?[›>\)\]]/g, '').replace(/\:[\w\-]+/, '').trim()
                      || this.email.split('@')[0]
    },
    // Other name props
    'original_name': {
      'enumerable': true,
      'get': () => this.profiles.bugzilla ? this.profiles.bugzilla.real_name || '' : ''
    },
    'first_name': {
      'enumerable': true,
      'get': () => this.name.split(/\s/)[0]
    },
    'initial': {
      'enumerable': true,
      'get': () => this.first_name.charAt(0).toUpperCase()
    },
    'nick_name': {
      'enumerable': true,
      'get': () => (this.original_name.match(/\:([\w\-]+)/) || [])[1]
    },
    // Images
    'image': {
      'enumerable': true,
      'get': () => this.profiles.image_src || ''
    },
    'background_image': {
      'enumerable': true,
      'get': () => { try { return this.profiles.gravatar.profileBackground.url; } catch (e) { return undefined; }}
    },
    // Find background color from Gravatar profile or generate one based on the user name and email
    'color': {
      'enumerable': true,
      'get': () => { try { return this.profiles.gravatar.profileBackground.color; } catch (e) {
        return '#' + String(this.original_name ? this.original_name.length : 0).substr(-1, 1)
                   + String(this.email.length).substr(-1, 1)
                   + String(this.email.length).substr(0, 1);
      }}
    },
    // Return basic info
    'properties': {
      'enumerable': true,
      'get': () => ({ 'name': this.name, 'email': this.email, 'image': this.image })
    },
  });

  // Generate avatar's object URL for this session
  if (this.profiles.image_blob) {
    this.profiles.image_src = URL.createObjectURL(this.profiles.image_blob);
  }

  // Refresh profiles if the data is older than 10 days
  if (this.profiles.updated && this.profiles.updated < Date.now() - 864000000) {
    options.refresh = true;
  }

  if (!options.init_only && (options.refresh || !this.profiles.updated)) {
    this.fetch_data(options).then(profiles => {
      // Notify the change to update the UI when necessary
      this.trigger(':UserInfoUpdated', { 'name': this.email });
    });
  }
};

BzDeck.controllers.User.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.User.prototype.constructor = BzDeck.controllers.User;

BzDeck.controllers.User.prototype.save = function () {
  this.model.save(this.profiles);
};

BzDeck.controllers.User.prototype.fetch_data = function (options = {}) {
  options.in_promise_all = true;

  return new Promise(resolve => {
    Promise.all([
      this.get_bugzilla_profile(options),
      this.get_gravatar_image(options),
      // Refresh the Gravatar profile if already exists, or fetch later on demand
      this.profiles.gravatar ? this.get_gravatar_profile(options, true) : Promise.resolve()
    ]).then(results => {
      this.profiles = {
        'name': this.email, // String
        'bugzilla': results[0], // Object
        'image_blob': results[1], // Blob
        'image_src': results[1] ? URL.createObjectURL(results[1]) : undefined, // URL
        'gravatar': results[2] || undefined, // Object
        'updated': Date.now(), // Integer
      };
    }).catch(error => {
      this.profiles = {
        'name': this.email,
        'error': error.message,
        'updated': Date.now(),
      };
    }).then(() => {
      this.save();
      resolve(this.profiles);
    });
  });
};

BzDeck.controllers.User.prototype.get_bugzilla_profile = function (options = {}) {
  // Bugzilla profile could be provided when the User is created.
  // If the refresh option is not specified, just return it
  if (!options.refresh && this.profiles.bugzilla.id) {
    return Promise.resolve(this.profiles.bugzilla);
  }

  if (!options.refresh && this.profiles.error) {
    return Promise.reject(new Error(this.profiles.error));
  }

  let params = new URLSearchParams();

  params.append('names', this.email);

  if (options.api_key) {
    params.append('api_key', options.api_key);
  }

  return new Promise((resolve, reject) => {
    this.request('GET', 'user', params).then(result => {
      result.users ? resolve(result.users[0]) : reject(new Error(result.message || 'User Not Found'));
    }).catch(error => reject(error));
  });
};

BzDeck.controllers.User.prototype.get_gravatar_profile = function (options = {}) {
  if (!options.refresh && this.profiles.gravatar) {
    if (this.profiles.gravatar.error) {
      return Promise.reject(new Error('The Gravatar profile cannot be found'));
    }

    return Promise.resolve(this.profiles.gravatar);
  }

  return new Promise((resolve, reject) => {
    FlareTail.util.network.jsonp(`https://secure.gravatar.com/${this.hash}.json`)
        .then(data => data.entry[0]).then(profile => {
      this.profiles.gravatar = profile;
      resolve(profile);
    }).catch(error => {
      let profile = this.profiles.gravatar = { 'error': 'Not Found' };

      // Resolve anyway if this is called in Promise.all()
      if (options.in_promise_all) {
        resolve(profile);
      } else {
        reject(new Error('The Gravatar profile cannot be found'));
      }
    }).then(() => {
      if (!options.in_promise_all) {
        this.save();
      }
    });
  });
};

BzDeck.controllers.User.prototype.get_gravatar_image = function (options) {
  if (!options.refresh && this.profiles.image_blob) {
    return Promise.resolve(this.profiles.image_blob);
  }

  let $image = new Image(),
      $canvas = document.createElement('canvas'),
      ctx = $canvas.getContext('2d');

  $image.crossOrigin = 'anonymous';
  $canvas.width = 160;
  $canvas.height = 160;

  return new Promise((resolve, reject) => {
    $image.addEventListener('load', event => {
      ctx.drawImage($image, 0, 0);
      $canvas.toBlob(blob => resolve(blob));
    });

    $image.addEventListener('error', event => {
      // Plain background of the user's color
      ctx.fillStyle = this.color;
      ctx.fillRect(0, 0, 160, 160);
      // Initial at the center of the canvas
      ctx.font = '110px FiraSans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF';
      ctx.fillText(this.initial, 80, 85); // Adjust the baseline by 5px
      $canvas.toBlob(blob => resolve(blob));
    });

    $image.src = `https://secure.gravatar.com/avatar/${this.hash}?s=160&d=404`;
  });
};
