/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the User Model that represents a Bugzilla user. Available through the UserCollection.
 * @extends BzDeck.BaseModel
 * @todo Move this to the worker thread.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user Bugzilla API}
 */
BzDeck.UserModel = class UserModel extends BzDeck.BaseModel {
  /**
   * Get an UserModel instance.
   * @constructor
   * @param {Object} data - Profile object.
   * @param {String} data.name - User name, usually the same as email address.
   * @param {Object} [data.bugzilla] - Bugzilla's raw user data.
   * @fires UserModel#UserInfoUpdated
   * @returns {Proxy} Proxified UserModel instance, so consumers can seamlessly access user properties via user.prop
   *  instead of user.data.prop.
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
        // The avatar will be retrieved via service worker
        get: () => `/api/gravatar/avatar/${this.hash}` +
                   `?color=${encodeURIComponent(this.color)}&initial=${encodeURIComponent(this.initial)}`,
      },
      background_image: {
        enumerable: true,
        get: () => { try { return this.data.gravatar.profileBackground.url; } catch (e) { return undefined; }}
      },
      // Find background color from Gravatar profile or generate one based on the user name and email
      color: {
        enumerable: true,
        get: () => { try { return this.data.gravatar.profileBackground.color; } catch (e) {
          return '#' + this.hash.toUpperCase().match(/[0-9A-C]/g).join('').substr(0, 6);
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

    if (!this.data.bugzilla || !this.data.bugzilla.id) {
      (async () => {
        await this.get_bugzilla_profile();
        // Notify the change to update the UI when necessary
        this.trigger('#UserInfoUpdated', { name: this.email });
      })();
    }

    // Delete old avatar image cache
    if (this.data.image_blob) {
      delete this.data.image_blob;
      delete this.data.image_src;
      this.save();
    }

    return this.proxy();
  }

  /**
   * Get or retrieve the user's Bugzilla profile. The profile may be available at the time of creating the UserModel.
   * @param {String} [api_key] - API key used to authenticate against the Bugzilla API.
   * @returns {Promise.<Object>} The user's Bugzilla profile.
   * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/user.html#get-user Bugzilla API}
   */
  async get_bugzilla_profile ({ api_key } = {}) {
    if (this.data.bugzilla && this.data.bugzilla.id) {
      return this.data.bugzilla;
    }

    // If the user data has an error (e.g. not found) but it's loaded within 24 hours, just return the error object.
    // Otherwise continue to retrieve the data again
    if (this.data.error && this.data.updated > Date.now() - 1000 * 60 * 60 * 24) {
      return this.data;
    }

    const params = new URLSearchParams();

    params.append('names', this.email);

    const result = await BzDeck.host.request('user', params, { api_key: api_key || undefined });

    if (!result.users) {
      this.save({
        name: this.email,
        error: result.message || 'User Not Found',
        updated: Date.now(),
      });

      throw new Error(this.data.error);
    }

    const _user = result.users[0];

    this.data.id = _user.id;
    this.data.bugzilla = _user;
    this.data.updated = Date.now();
    this.save();

    return _user;
  }

  /**
   * Get or retrieve the user's Gravatar profile. Because the request can be done only through JSONP that requires DOM
   * access, delegate the process to GlobalView.
   * @listens GlobalView#GravatarProfileProvided
   * @fires UserModel#GravatarProfileRequested
   * @returns {Promise.<Object>} The user's Gravatar profile.
   * @see {@link https://en.gravatar.com/site/implement/profiles/json/ Gravatar API}
   */
  async get_gravatar_profile () {
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
          } else {
            reject(new Error('The Gravatar profile could not be found'));
          }

          this.data.gravatar = profile;
          this.save();
        }
      }, true);

      this.trigger('#GravatarProfileRequested', { hash: this.hash });
    });
  }
}
