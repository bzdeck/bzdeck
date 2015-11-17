/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the User Model that represents a Bugzilla user. Available through the UserCollection.
 *
 * @constructor
 * @extends BaseModel
 * @argument {Object} data - Profile object including Bugzilla's raw user data.
 * @return {Proxy} user - Proxified UserModel instance, so consumers can seamlessly access user properties via user.prop
 *  instead of user.data.prop.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
 */
BzDeck.models.User = function UserModel (data) {
  this.datasource = BzDeck.datasources.account;
  this.store_name = 'users';
  this.email = data.name = (data.name || data.bugzilla.name);
  this.hash = md5(this.email);
  this.cache(data);

  // These properties should work even when the user's Bugzilla profile is still being loaded
  Object.defineProperties(this, {
    // This is not the Bugzilla user name (email address) but pretty name.
    // Replace both 'Kohei Yoshino [:Kohei]' and 'Kohei Yoshino :Kohei' with 'Kohei Yoshino'
    name: {
      enumerable: true,
      get: () => this.original_name.replace(/[\[\(<‹].*?[›>\)\]]/g, '').replace(/\:[\w\-]+/g, '').trim()
                      || this.email.split('@')[0]
    },
    // Other name props
    original_name: {
      enumerable: true,
      get: () => this.data.bugzilla ? this.data.bugzilla.real_name || '' : ''
    },
    first_name: {
      enumerable: true,
      get: () => this.name.split(/\s/)[0]
    },
    initial: {
      enumerable: true,
      get: () => this.first_name.charAt(0).toUpperCase()
    },
    nick_names: {
      enumerable: true,
      get: () => (this.original_name.match(/\:[\w\-]+/g) || []).map(name => name.substr(1)) // Consider multiple nick
    },
    // Images provided by Gravatar
    image: {
      enumerable: true,
      get: () => this.data.image_src || ''
    },
    background_image: {
      enumerable: true,
      get: () => { try { return this.data.gravatar.profileBackground.url; } catch (e) { return undefined; }}
    },
    // Find background color from Gravatar profile or generate one based on the user name and email
    color: {
      enumerable: true,
      get: () => { try { return this.data.gravatar.profileBackground.color; } catch (e) {
        return '#' + String(this.original_name ? this.original_name.length : 0).substr(-1, 1)
                   + String(this.email.length).substr(-1, 1)
                   + String(this.email.length).substr(0, 1);
      }}
    },
    // Return basic info for easier fill-in on views
    properties: {
      enumerable: true,
      get: () => ({
        name: this.name,
        givenName: this.first_name,
        alternateName: this.nick_names[0],
        description: this.original_name || this.name,
        email: this.email,
        image: this.image,
      }),
    },
  });

  // Generate the avatar's object URL for this session
  if (this.data.image_blob) {
    this.data.image_src = URL.createObjectURL(this.data.image_blob);
  }

  let options = {
    // Refresh profiles if the data is older than 10 days
    refresh: this.data.updated && this.data.updated < Date.now() - 864000000,
  };

  if (options.refresh || !this.data.updated) {
    this.fetch(options).then(profiles => {
      // Notify the change to update the UI when necessary
      this.trigger(':UserInfoUpdated', { name: this.email });
    });
  }

  return this.proxy();
};

BzDeck.models.User.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.User.prototype.constructor = BzDeck.models.User;

/**
 * Retrieve the user's relevant data from Bugzilla and Gravatar, save the results, and return the profile.
 *
 * @argument {Object} [options] - Extra options.
 * @argument {Boolean} [options.refresh=false] - Whether the existing cache should be updated.
 * @return {Promise.<Proxy>} data - Promise to be resolved in the user's profile.
 */
BzDeck.models.User.prototype.fetch = function (options = {}) {
  options.in_promise_all = true;

  return Promise.all([
    this.get_bugzilla_profile(options),
    this.get_gravatar_image(options),
    // Refresh the Gravatar profile if already exists, or fetch later on demand
    this.data.gravatar ? this.get_gravatar_profile(options, true) : Promise.resolve()
  ]).then(results => {
    this.save({
      name: this.email, // String
      id: results[0].id, // Number
      bugzilla: results[0], // Object
      image_blob: results[1], // Blob
      image_src: results[1] ? URL.createObjectURL(results[1]) : undefined, // URL
      gravatar: results[2] || undefined, // Object
      updated: Date.now(), // Number
    });
  }).catch(error => {
    this.save({
      name: this.email,
      error: error.message,
      updated: Date.now(),
    });
  }).then(() => Promise.resolve(this.data));
};

/**
 * Get or retrieve the user's Bugzilla profile. The profile may be available at the time of creating the UserModel. If
 * the refresh option is not specified, just return it.
 *
 * @argument {Object} [options] - Extra options.
 * @argument {Boolean} [options.refresh=false] - Whether the existing cache should be updated.
 * @argument {Boolean} [options.in_promise_all=false] - Whether the function is called as part of Promise.all().
 * @argument {String} [options.api_key] - API key used to authenticate against the Bugzilla API.
 * @return {Promise.<Object>} bug - Promise to be resolved in the user's Bugzilla profile.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
 */
BzDeck.models.User.prototype.get_bugzilla_profile = function (options = {}) {
  if (!options.refresh && this.data.bugzilla && this.data.bugzilla.id) {
    return Promise.resolve(this.data.bugzilla);
  }

  if (!options.refresh && this.data.error) {
    return Promise.reject(new Error(this.data.error));
  }

  let params = new URLSearchParams(),
      _options = { api_key: options.api_key || undefined };

  params.append('names', this.email);

  return new Promise((resolve, reject) => {
    BzDeck.controllers.global.request('user', params, _options).then(result => {
      result.users ? resolve(result.users[0]) : reject(new Error(result.message || 'User Not Found'));
    }).catch(error => reject(error));
  });
};

/**
 * Get or retrieve the user's Gravatar profile.
 *
 * @argument {Object} [options] - Extra options.
 * @argument {Boolean} [options.refresh=false] - Whether the existing cache should be updated.
 * @argument {Boolean} [options.in_promise_all=false] - Whether the function is called as part of Promise.all().
 * @return {Promise.<Object>} bug - Promise to be resolved in the user's Gravatar profile.
 * @see {@link https://en.gravatar.com/site/implement/profiles/json/}
 */
BzDeck.models.User.prototype.get_gravatar_profile = function (options = {}) {
  if (!options.refresh && this.data.gravatar) {
    if (this.data.gravatar.error) {
      return Promise.reject(new Error('The Gravatar profile cannot be found'));
    }

    return Promise.resolve(this.data.gravatar);
  }

  return new Promise((resolve, reject) => {
    this.helpers.network.jsonp(`https://secure.gravatar.com/${this.hash}.json`)
        .then(data => data.entry[0]).then(profile => {
      this.data.gravatar = profile;
      resolve(profile);
    }).catch(error => {
      let profile = this.data.gravatar = { error: 'Not Found' };

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

/**
 * Get or retrieve the user's Gravatar image. If the image cannot be found, generate a fallback image and return it.
 *
 * @argument {Object} [options] - Extra options.
 * @argument {Boolean} [options.refresh=false] - Whether the existing cache should be updated.
 * @return {Promise.<Blob>} bug - Promise to be resolved in the user's avatar image in the Blob format.
 * @see {@link https://en.gravatar.com/site/implement/images/}
 */
BzDeck.models.User.prototype.get_gravatar_image = function (options = {}) {
  if (!options.refresh && this.data.image_blob) {
    return Promise.resolve(this.data.image_blob);
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
