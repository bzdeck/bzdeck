/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar Presenter that controls everything on the global application sidebar.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.SidebarPresenter = class SidebarPresenter extends BzDeck.BasePresenter {
  /**
   * Get a SidebarPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New SidebarPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    const mobile = FlareTail.helpers.env.device.mobile;

    this.data = new Proxy({
      folder_id: null
    }, {
      set: (obj, prop, newval) => {
        const oldval = obj[prop];

        if (prop === 'folder_id' && oldval) {
          // On mobile, wait until the sidebar is closed so that the transition effects work smoother
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

    this.load_user_gravatar();

    // Update the sidebar Inbox folder at startup and whenever notified
    this.toggle_unread();
    this.subscribe_safe('BugModel#AnnotationUpdated', true);
  }

  /**
   * Load the user's Gravatar profile.
   * @param {undefined}
   * @fires SidebarPresenter#GravatarProfileFound
   * @returns {Promise.<undefined>}
   */
  async load_user_gravatar (folder_id) {
    const user = await BzDeck.collections.users.get(BzDeck.account.data.name, { name: BzDeck.account.data.name });
    const profile = await user.get_gravatar_profile()

    this.trigger_safe('#GravatarProfileFound', { user });
  }

  /**
   * Open a specific folder by ID.
   * @param {String} folder_id - One of the folder identifiers defined in the app config.
   * @fires SidebarPresenter#FolderOpened
   * @returns {Promise.<undefined>}
   */
  async open_folder (folder_id) {
    const bugs = await BzDeck.collections.subscriptions.get(folder_id);

    BzDeck.presenters.homepage.data.bugs = bugs; // Map
    this.trigger_safe('#FolderOpened', { folder_id, bugs });
  }

  /**
   * Called whenever a bug annotation is updated. Notify the change if the type is 'unread'.
   * @listens BugModel#AnnotationUpdated
   * @param {Proxy} bug - Changed bug.
   * @param {String} type - Annotation type such as 'starred' or 'unread'.
   * @param {Boolean} value - New annotation value.
   * @returns {undefined}
   */
  on_annotation_updated ({ bug, type, value } = {}) {
    if (type === 'unread') {
      this.toggle_unread();
    }
  }

  /**
   * Notify the number of unread bugs so the view can show it on the Inbox option.
   * @param {undefined}
   * @fires SidebarPresenter#UnreadToggled
   * @returns {Promise.<undefined>}
   */
  async toggle_unread () {
    const all_bugs = await BzDeck.collections.subscriptions.get_all();
    const bugs = [...all_bugs.values()];
    const is_new_results = bugs.map(bug => bug.is_new);

    this.trigger('#UnreadToggled', {
      number: bugs.filter((bug, index) => bug.unread && is_new_results[index]).length,
    });
  }

  /**
   * Called whenever a folder is selected.
   * @listens SidebarView#FolderSelected
   * @param {String} id - Folder id.
   * @returns {undefined}
   */
  on_folder_selected ({ id } = {}) {
    this.data.folder_id = id;
  }

  /**
   * Called whenever an Application menu item is selected.
   * @listens SidebarView#AppMenuItemSelected
   * @param {String} command - Command name of the menu item.
   * @returns {undefined}
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
}
