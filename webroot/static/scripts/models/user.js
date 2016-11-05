/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the User Model that represents a Bugzilla user. Available through the UserCollection.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
 */
BzDeck.UserModel = class UserModel extends BzDeck.BaseModel {
  /**
   * Get an UserModel instance.
   * @constructor
   * @param {Object} data - Profile object including Bugzilla's raw user data.
   * @fires UserModel#UserInfoUpdated
   * @returns {Proxy} user - Proxified UserModel instance, so consumers can seamlessly access user properties via
   *  user.prop instead of user.data.prop.
   */
  constructor (data) {
    super(); // Assign this.id

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

    if (!this.data.updated) {
      (async () => {
        await this.fetch();
        // Notify the change to update the UI when necessary
        this.trigger('#UserInfoUpdated', { name: this.email });
      })();
    }

    return this.proxy();
  }

  /**
   * Retrieve the user's relevant data from Bugzilla and Gravatar, save the results, and return the profile.
   * @param {Object} [options] - Extra options.
   * @returns {Promise.<Proxy>} data - Promise to be resolved in the user's profile.
   */
  async fetch (options = {}) {
    options.in_promise_all = true;

    try {
      const [bugzilla, image_blob, gravatar] = await Promise.all([
        this.get_bugzilla_profile(options),
        this.get_gravatar_image(options),
        // Refresh the Gravatar profile if already exists, or fetch later on demand
        this.data.gravatar ? this.get_gravatar_profile(options) : Promise.resolve(),
      ]);

      this.save({
        name: this.email, // String
        id: bugzilla.id, // Number
        bugzilla, // Object
        image_blob, // Blob
        image_src: image_blob ? URL.createObjectURL(image_blob) : undefined, // URL
        gravatar, // Object
        updated: Date.now(), // Number
      });
    } catch (error) {
      this.save({
        name: this.email,
        error: error.message,
        updated: Date.now(),
      });
    }

    return this.data;
  }

  /**
   * Get or retrieve the user's Bugzilla profile. The profile may be available at the time of creating the UserModel.
   * @param {Boolean} [in_promise_all=false] - Whether the function is called as part of Promise.all().
   * @param {String} [api_key] - API key used to authenticate against the Bugzilla API.
   * @returns {Promise.<Object>} bug - Promise to be resolved in the user's Bugzilla profile.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user}
   */
  async get_bugzilla_profile ({ in_promise_all = false, api_key } = {}) {
    if (this.data.bugzilla && this.data.bugzilla.id) {
      return this.data.bugzilla;
    }

    if (this.data.error) {
      throw new Error(this.data.error);
    }

    const params = new URLSearchParams();

    params.append('names', this.email);

    const result = await BzDeck.host.request('user', params, { api_key: api_key || undefined });

    if (!result.users) {
      throw new Error(result.message || 'User Not Found');
    }

    return result.users[0];
  }

  /**
   * Get or retrieve the user's Gravatar profile. Because the request can be done only through JSONP that requires DOM
   * access, delegate the process to GlobalView.
   * @listens GlobalView#GravatarProfileProvided
   * @param {Boolean} [in_promise_all=false] - Whether the function is called as part of Promise.all().
   * @fires UserModel#GravatarProfileRequested
   * @returns {Promise.<Object>} bug - Promise to be resolved in the user's Gravatar profile.
   * @see {@link https://en.gravatar.com/site/implement/profiles/json/}
   */
  async get_gravatar_profile ({ in_promise_all = false } = {}) {
    if (this.data.gravatar) {
      if (this.data.gravatar.error) {
        throw new Error('The Gravatar profile could not be found');
      }

      return this.data.gravatar;
    }

    return new Promise((resolve, reject) => {
      this.on('GlobalView#GravatarProfileProvided', ({ hash, profile } = {}) => {
        if (hash === this.hash) {
          if (profile) {
            resolve(profile);
          } else if (in_promise_all) {
            // Resolve anyway if this is called in Promise.all()
            profile = { error: 'Not Found' };
            resolve(profile);
          } else {
            reject(new Error('The Gravatar profile could not be found'));
          }

          // Save the profile when called by UserCollection
          if (!in_promise_all) {
            this.data.gravatar = profile;
            this.save();
          }
        }
      }, true);

      this.trigger('#GravatarProfileRequested', { hash: this.hash });
    });
  }

  /**
   * Get or retrieve the user's Gravatar image. If the image cannot be found, generate a fallback image and return it.
   * Because this requires DOM access, delegate the process to GlobalView.
   * @listens GlobalView#GravatarImageProvided
   * @param {Boolean} [in_promise_all=false] - Whether the function is called as part of Promise.all().
   * @fires UserModel#GravatarImageRequested
   * @returns {Promise.<Blob>} bug - Promise to be resolved in the user's avatar image in the Blob format.
   * @see {@link https://en.gravatar.com/site/implement/images/}
   */
  async get_gravatar_image ({ in_promise_all = false } = {}) {
    if (this.data.image_blob) {
      return this.data.image_blob;
    }

    return new Promise(resolve => {
      const { hash, color, initial } = this;

      this.on('GlobalView#GravatarImageProvided', data => {
        if (data.hash === hash) {
          resolve(data.blob);

          // Save the image when called by UserCollection
          if (!in_promise_all) {
            this.data.image_blob = data.blob;
            this.data.image_src = URL.createObjectURL(data.blob);
            this.save();
          }
        }
      }, true);

      this.trigger('#GravatarImageRequested', { hash, color, initial });
    });
  }
}
