/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Sidebar Controller that controls everything on the global application sidebar.
 *
 * @constructor
 * @extends BaseController
 * @argument {undefined}
 * @return {Object} controller - New SidebarController instance.
 */
BzDeck.controllers.Sidebar = function SidebarController () {
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

  BzDeck.views.sidebar = new BzDeck.views.Sidebar();

  this.on('V:FolderSelected', data => this.data.folder_id = data.id);

  // Update the sidebar Inbox folder at startup and whenever notified
  this.toggle_unread();
  this.subscribe('BugModel:AnnotationUpdated', true);
};

BzDeck.controllers.Sidebar.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.Sidebar.prototype.constructor = BzDeck.controllers.Sidebar;

/**
 * Open a specific folder by ID.
 *
 * @argument {String} folder_id - One of the folder identifiers defined in the app config.
 * @return {undefined}
 */
BzDeck.controllers.Sidebar.prototype.open_folder = function (folder_id) {
  let bugs = BzDeck.controllers.homepage.data.bugs = BzDeck.collections.subscriptions.get(folder_id); // Map

  this.trigger(':FolderOpened', { folder_id, bugs });
};

/**
 * Called by BugModel whenever a bug annotation is updated. Notify the change if the type is 'unread'.
 *
 * @argument {Object} data - Annotation change details.
 * @argument {Proxy} data.bug - Changed bug.
 * @argument {String} data.type - Annotation type such as 'starred' or 'unread'.
 * @argument {Boolean} data.value - New annotation value.
 * @return {undefined}
 */
BzDeck.controllers.Sidebar.prototype.on_annotation_updated = function (data) {
  if (data.type === 'unread') {
    this.toggle_unread();
  }
};

/**
 * Notify the number of unread bugs so the view can show it on the Inbox option.
 *
 * @argument {undefined}
 * @return {undefined}
 */
BzDeck.controllers.Sidebar.prototype.toggle_unread = function () {
  let number = [...BzDeck.collections.subscriptions.get_all().values()].filter(bug => bug.unread && bug.is_new).length;

  this.trigger(':UnreadToggled', { number });
};
