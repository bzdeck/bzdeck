/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Session Presenter serving as the application bootstrapper. The member functions require refactoring.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.SessionPresenter = class SessionPresenter extends BzDeck.BasePresenter {
  /**
   * Get a SessionPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @param {URLSearchParams} params - Search parameters.
   * @returns {Object} presenter - New SessionPresenter instance.
   */
  constructor (id, params) {
    super(id); // Assign this.id

    BzDeck.config.debug = params.get('debug') === 'true';

    this.bootstrapping = true;

    BzDeck.datasources.global = new BzDeck.GlobalDataSource();
    BzDeck.datasources.account = new BzDeck.AccountDataSource();

    // Register service workers. Due to the scope limitation, those files should be on the root directory
    navigator.serviceWorker.register('/service-worker.js');

    this.find_account();
  }

  /**
   * Bootstrap Step 1. Find a user account from the local database.
   * @param {undefined}
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   * @returns {undefined}
   */
  find_account () {
    this.trigger('#StatusUpdate', { message: 'Looking for your account...' }); // l10n

    BzDeck.datasources.global.load().then(database => {
      BzDeck.collections.accounts = new BzDeck.AccountCollection();
      BzDeck.collections.hosts = new BzDeck.HostCollection();
    }, error => {
      console.error(error);
      this.trigger('#Error', { message: error.message });
    }).then(() => Promise.all([
      BzDeck.collections.accounts.load(),
      BzDeck.collections.hosts.load(),
    ])).then(() => {
      return BzDeck.collections.accounts.get_current();
    }).then(account => {
      BzDeck.account = account;
    }).then(() => {
      return BzDeck.collections.hosts.get(BzDeck.account.data.host);
    }).then(host => {
      BzDeck.host = host;
    }).then(() => {
      this.load_data();
    }).catch(error => {
      this.force_login();
    });
  }

  /**
   * Bootstrap Step 2. Let the user sign in if an active account could not be found.
   * @listens LoginFormView#LoginRequested
   * @listens LoginFormView#QRCodeDecoded
   * @listens LoginFormView#QRCodeError
   * @param {undefined}
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   * @returns {undefined}
   */
  force_login () {
    this.trigger('#StatusUpdate', { status: 'ForcingLogin', message: '' });

    // User credentials will be passed from a sub window over a BroadcastChannel
    let bc = this.auth_callback_bc = new BroadcastChannel('BugzillaAuthCallback');

    this.on('LoginFormView#LoginRequested', data => {
      bc.addEventListener('message', ({ data: { client_api_login: name, client_api_key: key }} = {}) => {
        if (name && key) {
          this.verify_account(data.host, name, key);
        } else {
          this.trigger('#Error', { message: 'Your Bugzilla user name and API key could not be retrieved. Try again.' });
        }
      });
    });

    this.on('LoginFormView#QRCodeDecoded', data => {
      if (data.result && data.result.match(/^.+@.+\..+\|[A-Za-z0-9]{40}$/)) {
        this.verify_account(data.host, ...data.result.split('|'));
      } else {
        this.trigger('#Error', { message: 'Your QR code could not be detected nor decoded. Try again.' });
      }
    });

    this.on('LoginFormView#QRCodeError', data => {
      this.trigger('#Error', { message: 'Failed to access a camera on your device. Try again.' });
    });
  }

  /**
   * Bootstrap Step 3. Once the user's auth info is provided, check if the user name and API key are valid.
   * @param {String} host_id - Host identifier like 'mozilla'.
   * @param {String} name - User's Bugzilla account name. Usually email address.
   * @param {String} api_key - User's 40-character Bugzilla API key.
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   * @fires SessionPresenter#UserFound
   * @returns {undefined}
   */
  verify_account (host_id, name, api_key) {
    this.trigger('#StatusUpdate', { message: 'Verifying your account...' }); // l10n

    if (!this.bootstrapping) {
      // User is trying to re-login
      this.relogin = true;
      this.bootstrapping = true;
    }

    BzDeck.collections.hosts.get(host_id, { host: host_id }).then(host => {
      BzDeck.host = host;
    }).then(() => {
      return BzDeck.host.verify_account(name, api_key);
    }).then(user => {
      let _account = { host: BzDeck.host.name, name, api_key, loaded: Date.now(), active: true, bugzilla: user };
      let account = BzDeck.account = new BzDeck.AccountModel(_account);

      account.save();
      this.trigger('#UserFound');
      this.auth_callback_bc.close();
      this.load_data();
    }).catch(error => {
      this.trigger('#Error', { message: error.message || 'Failed to find your account.' }); // l10n
    });
  }

  /**
   * Bootstrap Step 4. Load data from the local database once the user account is set.
   * @param {undefined}
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   * @returns {undefined}
   */
  load_data () {
    this.trigger('#StatusUpdate', { status: 'LoadingData', message: 'Loading your data...' }); // l10n

    BzDeck.datasources.account.load().then(database => {
      BzDeck.collections.bugs = new BzDeck.BugCollection();
      BzDeck.collections.attachments = new BzDeck.AttachmentCollection();
      BzDeck.collections.subscriptions = new BzDeck.SubscriptionCollection();
      BzDeck.prefs = new BzDeck.PrefCollection();
      BzDeck.collections.users = new BzDeck.UserCollection();
    }, error => {
      console.error(error);
      this.trigger('#Error', { message: error.message });
    }).then(() => Promise.all([
      BzDeck.collections.bugs.load(),
      BzDeck.prefs.load(),
      BzDeck.collections.users.load(),
    ])).then(() => Promise.all([
      BzDeck.collections.attachments.load(), // Depends on BzDeck.collections.bugs
    ])).then(() => {
      return BzDeck.collections.bugs.get_all();
    }).then(bugs => {
      this.firstrun = !bugs.size;
    }).then(() => {
      // Fetch data for new users before showing the main app window, or defer fetching for returning users
      return this.firstrun ? this.fetch_data(true) : Promise.resolve();
    }).then(() => {
      this.init_components();
    }).catch(error => {
      console.error(error);
      this.trigger('#Error', { message: error.message });
    });
  }

  /**
   * Bootstrap Step 5. Retrieve bugs and Bugzilla config from the remote Bugzilla instance.
   * @param {Boolean} [firstrun=false] - True for the initial session.
   * @fires SessionPresenter#StatusUpdate
   * @returns {Promise.<Array>} - Promise to be resolved in retrieved data.
   */
  fetch_data (firstrun = false) {
    this.trigger('#StatusUpdate', { message: 'Loading Bugzilla config and your bugs...' });

    let now = Date.now();
    let get_datetime = days => (new Date(now - 1000 * 60 * 60 * 24 * days)).toISOString();
    // Fetch only bugs changed in the last 14 days first to reduce the initial startup time
    let params = firstrun ? new URLSearchParams(`chfieldfrom=${get_datetime(14)}`) : undefined;

    return Promise.all([
      BzDeck.host.get_config(),
      BzDeck.collections.users.refresh(),
      BzDeck.collections.subscriptions.fetch(firstrun, params).then(bugs => {
        if (firstrun) {
          // Fetch the remaining bugs changed within a year
          let _params = new URLSearchParams(`chfieldfrom=${get_datetime(365)}&chfieldto=${get_datetime(14)}`);
          let _fetch = BzDeck.collections.subscriptions.fetch(true, _params);

          // If the first fetch returned no bugs, wait for the second fetch
          if (!bugs.size) {
            return _fetch;
          }
        }

        return Promise.resolve(bugs);
      }),
    ]);
  }

  /**
   * Bootstrap Step 6. Set up everything including the global presenters and views, then complete bootstrapping.
   * @param {undefined}
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   * @returns {undefined}
   */
  init_components () {
    this.trigger('#StatusUpdate', { message: 'Initializing UI...' }); // l10n

    new Promise((resolve, reject) => {
      this.relogin ? resolve() : reject();
    }).catch(error => {
      // Finally load the UI modules
      this.trigger('#DataLoaded');
    }).then(() => {
      let endpoint = BzDeck.host.websocket_endpoint;

      BzDeck.models.bugzfeed = new BzDeck.BugzfeedModel();

      // Connect to the push notification server if available
      if (endpoint) {
        BzDeck.models.bugzfeed.connect(endpoint);
      }
    }).then(() => {
      this.trigger('#StatusUpdate', { message: 'Loading complete.' }); // l10n
      this.login();
      this.bootstrapping = false;
    }).then(() => {
      // Fetch data for returning users
      return this.firstrun ? Promise.resolve() : this.fetch_data();
    }).catch(error => {
      console.error(error);
      this.trigger('#Error', { message: error.message });
    });
  }

  /**
   * Notify the view of the user's sign-in once prepared.
   * @param {undefined}
   * @fires SessionPresenter#Login
   * @returns {undefined}
   */
  login () {
    this.trigger('#Login');
  }

  /**
   * Notify the view of the user's sign-out, run the clean-up script, and delete the active account info.
   * @param {undefined}
   * @fires SessionPresenter#Logout
   * @returns {undefined}
   */
  logout () {
    this.trigger('#Logout');
    this.clean();

    // Delete the account data and refresh the page to ensure the app works properly
    // TODO: Support multiple account by removing only the current account
    BzDeck.collections.accounts.delete(BzDeck.account.data.loaded)
      .then(() => location.replace(BzDeck.config.app.root));
  }

  /**
   * Clean up the browsing session by terminating all timers and Bugzfeed subscriptions.
   * @param {undefined}
   * @returns {undefined}
   */
  clean () {
    // Terminate timers
    for (let timer of BzDeck.presenters.global.timers.values()) {
      window.clearInterval(timer);
    }

    BzDeck.presenters.global.timers.clear();

    // Disconnect from the Bugzfeed server
    BzDeck.models.bugzfeed.disconnect();
  }
}
