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
   * @returns {SessionPresenter} New SessionPresenter instance.
   */
  constructor (id, params) {
    super(id); // Assign this.id

    BzDeck.config.debug = params.get('debug') === 'true';

    this.bootstrapping = true;

    BzDeck.datasources.global = new BzDeck.GlobalDataSource();
    BzDeck.datasources.account = new BzDeck.AccountDataSource();

    // Wait until the service worker is successfully registered so that request interceptions will always work
    navigator.serviceWorker.ready.then(reg => this.find_account());
    navigator.serviceWorker.register('/service-worker.js');
  }

  /**
   * Bootstrap Step 1. Find a user account from the local database.
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   */
  async find_account () {
    this.trigger('#StatusUpdate', { message: 'Looking for your account...' }); // l10n

    try {
      await BzDeck.datasources.global.load();
      BzDeck.collections.accounts = new BzDeck.AccountCollection();
      BzDeck.collections.hosts = new BzDeck.HostCollection();
    } catch (error) {
      this.trigger('#Error', { message: error.message });
    }

    try {
      await Promise.all([
        BzDeck.collections.accounts.load(),
        BzDeck.collections.hosts.load(),
      ]);

      BzDeck.account = await BzDeck.collections.accounts.get_current();
      BzDeck.host = await BzDeck.collections.hosts.get(BzDeck.account.data.host);
      this.load_data();
    } catch (error) {
      this.force_login();
    }
  }

  /**
   * Bootstrap Step 2. Let the user sign in if an active account could not be found.
   * @listens LoginFormView#LoginRequested
   * @listens LoginFormView#QRCodeDecoded
   * @listens LoginFormView#QRCodeError
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   */
  force_login () {
    this.trigger('#StatusUpdate', { status: 'ForcingLogin', message: '' });

    // User credentials will be passed from a sub window over a BroadcastChannel
    const bc = this.auth_callback_bc = new BroadcastChannel('BugzillaAuthCallback');

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
   */
  async verify_account (host_id, name, api_key) {
    this.trigger('#StatusUpdate', { message: 'Verifying your account...' }); // l10n

    if (!this.bootstrapping) {
      // User is trying to re-login
      this.relogin = true;
      this.bootstrapping = true;
    }

    BzDeck.host = await BzDeck.collections.hosts.get(host_id, { host: host_id });

    try {
      const user = await BzDeck.host.verify_account(name, api_key);
      const _account = { host: BzDeck.host.name, name, api_key, loaded: Date.now(), active: true, bugzilla: user };
      const account = BzDeck.account = new BzDeck.AccountModel(_account);

      account.save();
      this.trigger('#UserFound');
      this.auth_callback_bc.close();
      this.load_data();
    } catch (error) {
      this.trigger('#Error', { message: error.message || 'Failed to find your account.' }); // l10n
    }
  }

  /**
   * Bootstrap Step 4. Load data from the local database once the user account is set.
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   */
  async load_data () {
    this.trigger('#StatusUpdate', { status: 'LoadingData', message: 'Loading your data...' }); // l10n

    try {
      await BzDeck.datasources.account.load();
      BzDeck.collections.bugs = new BzDeck.BugCollection();
      BzDeck.collections.attachments = new BzDeck.AttachmentCollection();
      BzDeck.collections.subscriptions = new BzDeck.SubscriptionCollection();
      BzDeck.prefs = new BzDeck.PrefCollection();
      BzDeck.collections.users = new BzDeck.UserCollection();
    } catch (error) {
      this.trigger('#Error', { message: error.message });
    }

    try {
      await Promise.all([
        BzDeck.collections.bugs.load(),
        BzDeck.prefs.load(),
        BzDeck.collections.users.load(),
      ]);

      // Depends on BzDeck.collections.bugs
      await BzDeck.collections.attachments.load();

      const bugs = await BzDeck.collections.bugs.get_all();

      this.firstrun = !bugs.size;

      // Fetch data for new users before showing the main app window, or defer fetching for returning users
      if (this.firstrun) {
        await this.fetch_data(true);
      }

      this.init_components();
    } catch (error) {
      this.trigger('#Error', { message: error.message });
    }
  }

  /**
   * Bootstrap Step 5. Retrieve bugs and Bugzilla config from the remote Bugzilla instance.
   * @param {Boolean} [firstrun=false] - True for the initial session.
   * @fires SessionPresenter#StatusUpdate
   * @returns {Promise.<Array>} Retrieved data.
   */
  async fetch_data (firstrun = false) {
    this.trigger('#StatusUpdate', { message: 'Loading Bugzilla config and your bugs...' });

    const fetch_bugs = async () => {
      const now = Date.now();
      const get_datetime = days => (new Date(now - 1000 * 60 * 60 * 24 * days)).toISOString();
      // Fetch only bugs changed in the last 14 days first to reduce the initial startup time
      const params = firstrun ? new URLSearchParams(`chfieldfrom=${get_datetime(14)}`) : undefined;
      const bugs = await BzDeck.collections.subscriptions.fetch(firstrun, params);

      if (firstrun) {
        // Fetch the remaining bugs changed within a year
        const _params = new URLSearchParams(`chfieldfrom=${get_datetime(365)}&chfieldto=${get_datetime(14)}`);
        const _fetch = BzDeck.collections.subscriptions.fetch(true, _params);

        // If the first fetch returned no bugs, wait for the second fetch
        if (!bugs.size) {
          return _fetch;
        }
      }

      return bugs;
    };

    return Promise.all([
      BzDeck.host.get_config(),
      BzDeck.collections.users.refresh(),
      fetch_bugs(),
    ]);
  }

  /**
   * Bootstrap Step 6. Set up everything including the global presenters and views, then complete bootstrapping.
   * @fires SessionPresenter#StatusUpdate
   * @fires SessionPresenter#Error
   */
  async init_components () {
    this.trigger('#StatusUpdate', { message: 'Initializing UI...' }); // l10n

    if (!this.relogin) {
      // Finally load the UI modules
      this.trigger('#DataLoaded');
    }

    try {
      const endpoint = BzDeck.host.websocket_endpoint;

      BzDeck.models.bugzfeed = new BzDeck.BugzfeedModel();

      // Connect to the push notification server if available
      if (endpoint) {
        BzDeck.models.bugzfeed.connect(endpoint);
      }

      this.trigger('#StatusUpdate', { message: 'Loading complete.' }); // l10n
      this.login();
      this.bootstrapping = false;

      // Fetch data for returning users
      if (!this.firstrun) {
        this.fetch_data();
      }
    } catch (error) {
      this.trigger('#Error', { message: error.message });
    }
  }

  /**
   * Notify the view of the user's sign-in once prepared.
   * @fires SessionPresenter#Login
   */
  login () {
    this.trigger('#Login');
  }

  /**
   * Notify the view of the user's sign-out, run the clean-up script, and delete the active account info.
   * @fires SessionPresenter#Logout
   */
  async logout () {
    this.trigger('#Logout');
    this.clean();

    // Delete the account data and refresh the page to ensure the app works properly
    // TODO: Support multiple account by removing only the current account
    await BzDeck.collections.accounts.delete(BzDeck.account.data.loaded);
    location.replace(BzDeck.config.app.root);
  }

  /**
   * Clean up the browsing session by terminating all timers and Bugzfeed subscriptions.
   */
  clean () {
    // Terminate timers
    for (const timer of BzDeck.presenters.global.timers.values()) {
      window.clearInterval(timer);
    }

    BzDeck.presenters.global.timers.clear();

    // Disconnect from the Bugzfeed server
    BzDeck.models.bugzfeed.disconnect();
  }
}
