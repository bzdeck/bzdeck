/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Session Handler serving as the background application bootstrapper.
 * @extends BzDeck.BaseHandler
 */
BzDeck.SessionHandler = class SessionHandler extends BzDeck.BaseHandler {
  /**
   * Initialize the Session background service.
   * @constructor
   * @argument {undefined}
   * @return {Object} worker - New SessionHandler instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    let params = new URLSearchParams(location.search.substr(1));

    BzDeck.datasources.global = new BzDeck.GlobalDataSource();
    BzDeck.datasources.account = new BzDeck.AccountDataSource();

    this.bootstrapping = true;
    this.timers = new Map();
    
    // Subscribe to events
    this.on('C:UserAccountVerifying', data => this.verify_account(data));
    this.on('C:Login', () => this.login());
    this.on('C:Logout', () => this.logout());

    this.find_account();
  }

  /**
   * Bootstrap Step 1. Find a user account from the local database.
   * @argument {undefined}
   * @return {undefined}
   */
  find_account () {
    this.trigger('Bootstrapper:StatusUpdate', { message: 'Looking for your account...' }); // l10n

    BzDeck.datasources.global.load().then(database => {
      BzDeck.collections.accounts = new BzDeck.AccountCollection();
      BzDeck.collections.servers = new BzDeck.ServerCollection();
    }, error => {
      console.error(error);
      this.trigger('Bootstrapper:Error', { error, message: error.message });
    }).then(() => Promise.all([
      BzDeck.collections.accounts.load(),
      BzDeck.collections.servers.load(),
    ])).then(() => {
      return BzDeck.collections.accounts.get_current();
    }).then(account => {
      BzDeck.account = account;
    }).then(() => {
      return BzDeck.collections.servers.get(BzDeck.account.data.host);
    }).then(server => {
      BzDeck.server = server;
    }).then(() => {
      this.load_data();
    }).catch(error => {
      this.trigger(':UserAccountNotFound');
    });
  }

  /**
   * Bootstrap Step 3. Once the user's auth info is provided, check if the email and API key are valid.
   * @argument {String} data - Passed data.
   * @argument {String} data.host - Host identifier like 'mozilla'.
   * @argument {String} data.email - User's Bugzilla account name.
   * @argument {String} data.api_key - User's 40-character Bugzilla API key.
   * @return {undefined}
   */
  verify_account (data) {
    let { host, email, api_key } = data;

    this.trigger('Bootstrapper:StatusUpdate', { message: 'Verifying your account...' }); // l10n

    if (!this.bootstrapping) {
      // User is trying to re-login
      this.relogin = true;
      this.bootstrapping = true;
    }

    BzDeck.collections.servers.get(host, { host }).then(server => {
      BzDeck.server = server;
    }).then(() => {
      return BzDeck.server.request('user', new URLSearchParams(`names=${email}`), { api_key });
    }).then(result => {
      return result.users ? Promise.resolve(result.users[0])
                          : Promise.reject(new Error(result.message || 'User Not Found'));
    }, error => {
      return Promise.reject(error);
    }).then(user => {
      return user.error ? Promise.reject(new Error(user.error)) : Promise.resolve(user);
    }).then(user => {
      let account = BzDeck.account = new BzDeck.AccountModel({
        host: BzDeck.server.name,
        name: email,
        api_key,
        loaded: Date.now(), // key
        active: true,
        bugzilla: user,
      });

      account.save();
      this.trigger(':UserAccountVerified');
      this.load_data();
    }).catch(error => {
      console.error(error);
      this.trigger('Bootstrapper:Error', { message: error.message || 'Failed to find your account.' }); // l10n
    });
  }

  /**
   * Bootstrap Step 4. Load data from the local database once the user account is set.
   * @argument {undefined}
   * @return {undefined}
   */
  load_data () {
    this.trigger('Bootstrapper:StatusUpdate', { status: 'LoadingData', message: 'Loading your data...' }); // l10n

    BzDeck.datasources.account.load().then(database => {
      BzDeck.collections.bugs = new BzDeck.BugCollection();
      BzDeck.collections.attachments = new BzDeck.AttachmentCollection();
      BzDeck.collections.subscriptions = new BzDeck.SubscriptionCollection();
      BzDeck.prefs = new BzDeck.PrefCollection();
      BzDeck.collections.users = new BzDeck.UserCollection();
      BzDeck.handlers.bugzfeed = new BzDeck.BugzfeedHandler();
    }, error => {
      console.error(error);
      this.trigger('Bootstrapper:Error', { error, message: error.message });
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
      return this.firstrun ? this.fetch_data() : Promise.resolve();
    }).then(() => {
      this.trigger(':UserDataLoaded');
    }).catch(error => {
      console.error(error);
      this.trigger('Bootstrapper:Error', { error, message: error.message });
    });
  }

  /**
   * Bootstrap Step 5. Retrieve bugs and Bugzilla config from the remote Bugzilla instance.
   * @argument {undefined}
   * @return {undefined}
   */
  fetch_data () {
    this.trigger('Bootstrapper:StatusUpdate', { message: 'Loading Bugzilla config and your bugs...' });

    return Promise.all([
      BzDeck.collections.subscriptions.fetch(),
      BzDeck.server.get_config(),
    ]);
  }

  /**
   * Called when the user has successfully logged into the app.
   * @argument {undefined}
   * @return {undefined}
   */
  login () {
    this.bootstrapping = false;

    // Fetch data for returning users
    if (!this.firstrun) {
      this.fetch_data();
    }

    // Timer to check for updates, call every 5 minutes or per minute if debugging is enabled
    this.timers.set('fetch_subscriptions', self.setInterval(() =>
        BzDeck.collections.subscriptions.fetch(), 1000 * 60 * (BzDeck.config.debug ? 1 : 5)));
  }

  /**
   * Called when the user has successfully logged out from the app. Terminate the timers.
   * @argument {undefined}
   * @return {undefined}
   */
  logout () {
    this.timers.forEach(timers => self.clearInterval(timer));
    this.timers.clear();
  }
}
