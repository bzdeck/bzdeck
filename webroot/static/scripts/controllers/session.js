/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Session Controller serving as the main application bootstrapper.
 * @extends BzDeck.BaseController
 */
BzDeck.SessionController = class SessionController extends BzDeck.BaseController {
  /**
   * Get a SessionController instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} controller - New SessionController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    let params = new URLSearchParams(location.search.substr(1)),
        worker = BzDeck.workers.shared = new SharedWorker('/static/scripts/worker.js');

    BzDeck.config.debug = params.get('debug') === 'true';

    // Register service workers. Due to the scope limitation, those files should be on the root directory
    // navigator.serviceWorker.register('/service-worker.js');

    BzDeck.controllers.global = new BzDeck.GlobalController();
    BzDeck.controllers.bugzfeed = new BzDeck.BugzfeedController();
    BzDeck.views.session = new BzDeck.SessionView();
    BzDeck.views.login_form = new BzDeck.LoginFormView(params);

    // Subscribe to events
    this.on('H:UserAccountNotFound', () => this.force_login());
    this.on('H:UserDataLoaded', () => this.init_components());
  }

  /**
   * Bootstrap Step 2. Let the user sign in if an active account could not be found.
   * @argument {undefined}
   * @return {undefined}
   */
  force_login () {
    this.trigger('Bootstrapper:StatusUpdate', { status: 'ForcingLogin', message: '' });

    // User credentials will be passed from a sub window over a BroadcastChannel
    let bc = new BroadcastChannel('BugzillaAuthCallback');

    this.on('LoginFormView:LoginRequested', data => {
      let { host } = data;

      bc.addEventListener('message', event => {
        let { client_api_login: email, client_api_key: api_key } = event.data;

        if (email && api_key) {
          this.trigger(':UserAccountVerifying', { host, email, api_key });
        } else {
          this.trigger('Bootstrapper:Error', { message: 'Your Bugzilla user name and API key could not be retrieved. \
                                                         Try again.' });
        }
      });
    }, true);

    this.on('LoginFormView:QRCodeDecoded', data => {
      let { host } = data;

      if (data.result && data.result.match(/^.+@.+\..+\|[A-Za-z0-9]{40}$/)) {
        let [ email, api_key ] = data.result.split('|');

        this.trigger(':UserAccountVerifying', { host, email, api_key });
      } else {
        this.trigger('Bootstrapper:Error', { message: 'Your QR code could not be detected nor decoded. Try again.' });
      }
    }, true);

    this.on('LoginFormView:QRCodeError', data => {
      this.trigger('Bootstrapper:Error', { message: 'Failed to access a camera on your device. Try again.' });
    }, true);

    this.on('H:UserAccountVerified', () => bc.close(), true);
  }

  /**
   * Bootstrap Step 6. Set up everything including the global controllers and views, then complete bootstrapping.
   * @argument {undefined}
   * @return {undefined}
   */
  init_components () {
    let worker = BzDeck.workers.shared;

    this.trigger('Bootstrapper:StatusUpdate', { message: 'Initializing UI...' }); // l10n

    // Proxify the collections to seamlessly use the member functions
    BzDeck.collections.accounts = new FlareTail.app.WorkerProxy('BzDeck.collections.accounts', worker);
    BzDeck.collections.servers = new FlareTail.app.WorkerProxy('BzDeck.collections.servers', worker);
    BzDeck.collections.bugs = new FlareTail.app.WorkerProxy('BzDeck.collections.bugs', worker);
    BzDeck.collections.attachments = new FlareTail.app.WorkerProxy('BzDeck.collections.attachments', worker);
    BzDeck.collections.subscriptions = new FlareTail.app.WorkerProxy('BzDeck.collections.subscriptions', worker);
    BzDeck.collections.users = new FlareTail.app.WorkerProxy('BzDeck.collections.users', worker);
    BzDeck.prefs = new FlareTail.app.WorkerProxy('BzDeck.prefs', worker);

    new Promise((resolve, reject) => {
      this.relogin ? resolve() : reject();
    }).catch(error => {
      return BzDeck.collections.accounts.get_current();
    }).then(account => {
      BzDeck.account = account;

      return BzDeck.collections.users.get(account.data.name, { name: account.data.name });
    }).then(user => {
      // Finally load the UI modules
      BzDeck.controllers.global.init(),
      BzDeck.controllers.banner = new BzDeck.BannerController(user),
      BzDeck.controllers.sidebar = new BzDeck.SidebarController(),
      BzDeck.controllers.statusbar = new BzDeck.StatusbarController(),

      console.log(BzDeck.controllers.sidebar, BzDeck.controllers.statusbar);
      console.log(BzDeck.controllers.banner, BzDeck.views.banner);
      console.log('here');

      // Connect to the push notification server
      BzDeck.controllers.bugzfeed.connect();
    }).then(() => {
      // Activate the router
      BzDeck.router.locate();
    }).then(() => {
      this.trigger('Bootstrapper:StatusUpdate', { message: 'Loading complete.' }); // l10n
      this.login();
      BzDeck.controllers.global.toggle_unread(true);
    }).catch(error => {
      console.error(error);
      this.trigger('Bootstrapper:Error', { error, message: error.message });
    });
  }

  /**
   * Notify of sign-in once prepared.
   * @argument {undefined}
   * @return {undefined}
   */
  login () {
    this.trigger(':Login');
  }

  /**
   * Notify of sign-out.
   * @argument {undefined}
   * @return {undefined}
   */
  logout () {
    this.trigger(':Logout');

    window.setTimeout(() => location.replace(BzDeck.config.app.root), 150);
  }
}
