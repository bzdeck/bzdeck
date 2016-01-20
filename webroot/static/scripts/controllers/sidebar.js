/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Sidebar Controller that controls everything on the global application sidebar.
 * @extends BzDeck.BaseController
 */
BzDeck.SidebarController = class SidebarController extends BzDeck.BaseController {
  /**
   * Get a SidebarController instance.
   * @constructor
   * @argument {undefined}
   * @return {Object} controller - New SidebarController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    let mobile = this.helpers.env.device.mobile;

    this.data = new Proxy({
      folder_id: null
    }, {
      set: (obj, prop, newval) => {
        let oldval = obj[prop];

        // On mobile, the same folder can be selected
        if (!mobile && oldval === newval) {
          return true;
        }

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

    BzDeck.views.sidebar = new BzDeck.SidebarView();

    this.on('V:FolderSelected', data => this.data.folder_id = data.id);

    // Update the sidebar Inbox folder at startup and whenever notified
    this.toggle_unread();
    this.subscribe('BugModel:AnnotationUpdated', true);
  }

  /**
   * Open a specific folder by ID.
   * @argument {String} folder_id - One of the folder identifiers defined in the app config.
   * @return {undefined}
   */
  open_folder (folder_id) {
    BzDeck.collections.subscriptions.get(folder_id).then(bugs => {
      BzDeck.controllers.homepage.data.bugs = bugs; // Map
      this.trigger(':FolderOpened', { folder_id, bugs });
    });
  }

  /**
   * Called by BugModel whenever a bug annotation is updated. Notify the change if the type is 'unread'.
   * @argument {Object} data - Annotation change details.
   * @argument {Proxy} data.bug - Changed bug.
   * @argument {String} data.type - Annotation type such as 'starred' or 'unread'.
   * @argument {Boolean} data.value - New annotation value.
   * @return {undefined}
   */
  on_annotation_updated (data) {
    if (data.type === 'unread') {
      this.toggle_unread();
    }
  }

  /**
   * Notify the number of unread bugs so the view can show it on the Inbox option.
   * @argument {undefined}
   * @return {undefined}
   */
  toggle_unread () {
    BzDeck.collections.subscriptions.get_all().then(bugs => {
      let _bugs = [...bugs.values()];

      return Promise.all(_bugs.map(bug => bug.is_new)).then(is_new_results => {
        this.trigger(':UnreadToggled', {
          number: _bugs.filter((bug, index) => bug.unread && is_new_results[index]).length,
        });
      });
    });
  }
}
