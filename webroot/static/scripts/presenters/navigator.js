/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Navigator Presenter that controls everything on the global application navigator.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.NavigatorPresenter = class NavigatorPresenter extends BzDeck.BasePresenter {
  /**
   * Get a NavigatorPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {NavigatorPresenter} New NavigatorPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    const mobile = FlareTail.env.device.mobile;

    this.data = new Proxy({
      folder_id: null
    }, {
      set: (obj, prop, newval) => {
        const oldval = obj[prop];

        if (prop === 'folder_id' && oldval) {
          // On mobile, wait until the navigator is closed so that the transition effects work smoother
          if (mobile) {
            window.setTimeout(window => {
              BzDeck.router.navigate('/home/' + newval);
              obj[prop] = newval;
            }, 600);

            return true;
          }

          BzDeck.router.navigate('/home/' + newval);
        }

        obj[prop] = newval;

        return true;
      }
    });

    // Subscribe to events
    this.subscribe('V#FolderSelected');
    this.subscribe('V#AppMenuItemSelected');
    this.on('SubscriptionCollection#Updated', () => this.on_subscriptions_updated(), true);

    this.load_user_gravatar();

    // Update the navigator Inbox folder at startup and whenever notified
    this.toggle_unread();
    this.subscribe('BugModel#AnnotationUpdated', true);
  }

  /**
   * Load the user's Gravatar profile.
   * @fires NavigatorPresenter#GravatarProfileFound
   */
  async load_user_gravatar (folder_id) {
    const user = await BzDeck.collections.users.get(BzDeck.account.data.name, { name: BzDeck.account.data.name });
    const profile = await user.get_gravatar_profile();

    this.trigger('#GravatarProfileFound');
  }

  /**
   * Open a specific folder by ID.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @fires NavigatorPresenter#FolderOpened
   */
  async open_folder (folder_id) {
    const bugs = await BzDeck.collections.subscriptions.get(folder_id);

    BzDeck.presenters.sidebar_list.data.bugs = bugs; // Map
    this.trigger('#FolderOpened', { folder_id, bug_ids: [...bugs.keys()] });
  }

  /**
   * Called whenever a bug annotation is updated. Notify the change if the type is 'unread'.
   * @listens BugModel#AnnotationUpdated
   * @param {Number} bug_id - Updated bug ID.
   * @param {String} type - Annotation type such as 'starred' or 'unread'.
   * @param {Boolean} value - New annotation value.
   */
  on_annotation_updated ({ bug_id, type, value } = {}) {
    if (type === 'unread') {
      this.toggle_unread();
    }
  }

  /**
   * Notify the number of unread bugs so the view can show it on the Inbox option.
   * @fires NavigatorPresenter#UnreadToggled
   */
  async toggle_unread () {
    const all_bugs = await BzDeck.collections.subscriptions.get_all();
    const _bugs = [...all_bugs.values()];
    const is_new_results = await Promise.all(_bugs.map(bug => bug.is_new));

    this.trigger('#UnreadToggled', {
      number: _bugs.filter((bug, index) => bug.unread && is_new_results[index]).length,
    });
  }

  /**
   * Called whenever a folder is selected.
   * @listens NavigatorView#FolderSelected
   * @param {String} id - Folder id.
   */
  on_folder_selected ({ id } = {}) {
    this.data.folder_id = id;
  }

  /**
   * Called whenever an Application menu item is selected.
   * @listens NavigatorView#AppMenuItemSelected
   * @param {String} command - Command name of the menu item.
   */
  on_app_menu_item_selected ({ command } = {}) {
    const func = {
      'show-profile': () => BzDeck.router.navigate('/profile/' + BzDeck.account.data.name),
      'show-settings': () => BzDeck.router.navigate('/settings'),
      logout: () => BzDeck.presenters.session.logout(),
    }[command];

    if (func) {
      func();
    }
  }

  /**
   * Called whenever any bug is updated. Refresh the thread. FIXME: add/remove/update each bug when required, instead of
   * refreshing the entire thread unconditionally.
   * @listens SubscriptionCollection#Updated
   */
  on_subscriptions_updated () {
    this.open_folder(this.data.folder_id);
  }
}
