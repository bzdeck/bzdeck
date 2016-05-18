/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Session Controller serving as the application bootstrapper. The member functions require refactoring.
 * @extends BzDeck.BaseController
 */
BzDeck.SessionController = class SessionController extends BzDeck.BaseController {
  /**
   * Get a SessionController instance.
   * @constructor
   * @param {undefined}
   * @returns {Object} controller - New SessionController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    let params = new URLSearchParams(location.search.substr(1));

    BzDeck.config.debug = params.get('debug') === 'true';

    this.bootstrapping = true;

    BzDeck.datasources.global = new BzDeck.GlobalDataSource();
    BzDeck.datasources.account = new BzDeck.AccountDataSource();
    BzDeck.controllers.global = new BzDeck.GlobalController();
    BzDeck.controllers.bugzfeed = new BzDeck.BugzfeedController();

    new BzDeck.SessionView();
    new BzDeck.LoginFormView(params);

    // Register service workers. Due to the scope limitation, those files should be on the root directory
    navigator.serviceWorker.register('/service-worker.js');

    this.find_account();
  }

  /**
   * Bootstrap Step 1. Find a user account from the local database.
   * @param {undefined}
   * @returns {undefined}
   * @fires SessionController:StatusUpdate
   * @fires SessionController:Error
   */
  find_account () {
    this.trigger(':StatusUpdate', { message: 'Looking for your account...' }); // l10n

    BzDeck.datasources.global.load().then(database => {
      BzDeck.collections.accounts = new BzDeck.AccountCollection();
      BzDeck.collections.hosts = new BzDeck.HostCollection();
    }, error => {
      console.error(error);
      this.trigger(':Error', { message: error.message });
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
   * @param {undefined}
   * @returns {undefined}
   * @fires SessionController:StatusUpdate
   * @fires SessionController:Error
   * @listens LoginFormView:LoginRequested
   * @listens LoginFormView:QRCodeDecoded
   * @listens LoginFormView:QRCodeError
   */
  force_login () {
    this.trigger(':StatusUpdate', { status: 'ForcingLogin', message: '' });

    // User credentials will be passed from a sub window over a BroadcastChannel
    let bc = this.auth_callback_bc = new BroadcastChannel('BugzillaAuthCallback');

    this.on('LoginFormView:LoginRequested', data => {
      bc.addEventListener('message', event => {
        let { client_api_login: email, client_api_key: key } = event.data;

        if (email && key) {
          this.verify_account(data.host, email, key);
        } else {
          this.trigger(':Error', { message: 'Your Bugzilla user name and API key could not be retrieved. Try again.' });
        }
      });
    }, true);

    this.on('LoginFormView:QRCodeDecoded', data => {
      if (data.result && data.result.match(/^.+@.+\..+\|[A-Za-z0-9]{40}$/)) {
        this.verify_account(data.host, ...data.result.split('|'));
      } else {
        this.trigger(':Error', { message: 'Your QR code could not be detected nor decoded. Try again.' });
      }
    }, true);

    this.on('LoginFormView:QRCodeError', data => {
      this.trigger(':Error', { message: 'Failed to access a camera on your device. Try again.' });
    }, true);
  }

  /**
   * Bootstrap Step 3. Once the user's auth info is provided, check if the email and API key are valid.
   * @param {String} host_id - Host identifier like 'mozilla'.
   * @param {String} email - User's Bugzilla account name.
   * @param {String} api_key - User's 40-character Bugzilla API key.
   * @returns {undefined}
   * @fires SessionController:StatusUpdate
   * @fires SessionController:Error
   * @fires SessionController:UserFound
   */
  verify_account (host_id, email, api_key) {
    this.trigger(':StatusUpdate', { message: 'Verifying your account...' }); // l10n

    if (!this.bootstrapping) {
      // User is trying to re-login
      this.relogin = true;
      this.bootstrapping = true;
    }

    BzDeck.collections.hosts.get(host_id, { host: host_id }).then(host => {
      BzDeck.host = host;
    }).then(() => {
      return BzDeck.host.request('user', new URLSearchParams(`names=${email}`), { api_key });
    }).then(result => {
      return result.users ? Promise.resolve(result.users[0])
                          : Promise.reject(new Error(result.message || 'User Not Found'));
    }, error => {
      return Promise.reject(error);
    }).then(user => {
      return user.error ? Promise.reject(new Error(user.error)) : Promise.resolve(user);
    }).then(user => {
      let account = BzDeck.account = new BzDeck.AccountModel({
        host: BzDeck.host.name,
        name: email,
        api_key,
        loaded: Date.now(), // key
        active: true,
        bugzilla: user,
      });

      account.save();
      this.trigger(':UserFound');
      this.auth_callback_bc.close();
      this.load_data();
    }).catch(error => {
      this.trigger(':Error', { message: error.message || 'Failed to find your account.' }); // l10n
    });
  }

  /**
   * Bootstrap Step 4. Load data from the local database once the user account is set.
   * @param {undefined}
   * @returns {undefined}
   * @fires SessionController:StatusUpdate
   * @fires SessionController:Error
   */
  load_data () {
    this.trigger(':StatusUpdate', { status: 'LoadingData', message: 'Loading your data...' }); // l10n

    BzDeck.datasources.account.load().then(database => {
      BzDeck.collections.bugs = new BzDeck.BugCollection();
      BzDeck.collections.attachments = new BzDeck.AttachmentCollection();
      BzDeck.collections.subscriptions = new BzDeck.SubscriptionCollection();
      BzDeck.prefs = new BzDeck.PrefCollection();
      BzDeck.collections.users = new BzDeck.UserCollection();
    }, error => {
      console.error(error);
      this.trigger(':Error', { message: error.message });
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
      this.trigger(':Error', { message: error.message });
    });
  }

  /**
   * Bootstrap Step 5. Retrieve bugs and Bugzilla config from the remote Bugzilla instance.
   * @param {Boolean} [firstrun=false] - True for the initial session.
   * @returns {Promise.<Array>} - Promise to be resolved in retrieved data.
   * @fires SessionController:StatusUpdate
   */
  fetch_data (firstrun = false) {
    this.trigger(':StatusUpdate', { message: 'Loading Bugzilla config and your bugs...' });

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
   * Bootstrap Step 6. Set up everything including the global controllers and views, then complete bootstrapping.
   * @param {undefined}
   * @returns {undefined}
   * @fires SessionController:StatusUpdate
   * @fires SessionController:Error
   */
  init_components () {
    this.trigger(':StatusUpdate', { message: 'Initializing UI...' }); // l10n

    new Promise((resolve, reject) => {
      this.relogin ? resolve() : reject();
    }).catch(error => Promise.all([
      // Finally load the UI modules
      BzDeck.controllers.global.init(),
      BzDeck.controllers.banner = new BzDeck.BannerController(),
      BzDeck.collections.users.get(BzDeck.account.data.name, { name: BzDeck.account.data.name }).then(user => {
        BzDeck.controllers.sidebar = new BzDeck.SidebarController(user);
      }),
      BzDeck.controllers.statusbar = new BzDeck.StatusbarController(),
    ])).then(() => {
      // Connect to the push notification server
      BzDeck.controllers.bugzfeed.connect();
    }).then(() => {
      // Activate the router
      BzDeck.router.locate();
    }).then(() => {
      // Timer to check for updates, call every 5 minutes or per minute if debugging is enabled
      BzDeck.controllers.global.timers.set('fetch_subscriptions',
          window.setInterval(() => BzDeck.collections.subscriptions.fetch(),
                             1000 * 60 * (BzDeck.config.debug ? 1 : 5)));
    }).then(() => {
      this.trigger(':StatusUpdate', { message: 'Loading complete.' }); // l10n
      this.login();
      this.bootstrapping = false;
    }).then(() => {
      // Fetch data for returning users
      return this.firstrun ? Promise.resolve() : this.fetch_data();
    }).catch(error => {
      console.error(error);
      this.trigger(':Error', { message: error.message });
    });
  }

  /**
   * Notify the view of the user's sign-in once prepared.
   * @param {undefined}
   * @returns {undefined}
   * @fires SessionController:Login
   */
  login () {
    this.trigger(':Login');
  }

  /**
   * Notify the view of the user's sign-out, run the clean-up script, and delete the active account info.
   * @param {undefined}
   * @returns {undefined}
   * @fires SessionController:Logout
   */
  logout () {
    this.trigger(':Logout');
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
    for (let timer of BzDeck.controllers.global.timers.values()) {
      window.clearInterval(timer);
    }

    BzDeck.controllers.global.timers.clear();

    // Disconnect from the Bugzfeed server
    BzDeck.controllers.bugzfeed.disconnect();
  }
}

window.addEventListener('DOMContentLoaded', event => {
  if (FlareTail.compatible && BzDeck.compatible) {
    // Define the router
    BzDeck.router = new FlareTail.app.Router(BzDeck.config.app, {
      '/attachment/(\\d+|[a-z0-9]{32})': { controller: BzDeck.AttachmentPageController },
      '/bug/(\\d+)': { controller: BzDeck.DetailsPageController },
      '/home/(\\w+)': { controller: BzDeck.HomePageController, catch_all: true },
      '/profile/(.+)': { controller: BzDeck.ProfilePageController },
      '/search/(\\d{13,})': { controller: BzDeck.SearchPageController },
      '/settings': { controller: BzDeck.SettingsPageController },
    });

    // Bootstrapper
    BzDeck.controllers.session = new BzDeck.SessionController();
  }
});

window.addEventListener('beforeunload', event => {
  BzDeck.controllers.session.clean();
});
