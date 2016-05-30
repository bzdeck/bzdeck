/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Global View that provides some utility functions for views.
 * @extends BzDeck.BaseView
 */
BzDeck.GlobalView = class GlobalView extends BzDeck.BaseView {
  /**
   * Get a GlobalView instance. This should be called after user prefs are loaded.
   * @constructor
   * @param {undefined}
   * @returns {Object} view - New GlobalView instance.
   */
  constructor () {
    super(); // Assign this.id

    let datetime = FlareTail.helpers.datetime;
    let $root = document.documentElement;

    // Automatically update relative dates on the app
    datetime.options.updater_enabled = true;

    // Theme
    BzDeck.prefs.get('ui.theme.selected').then(theme => {
      // Change the theme
      if (theme && FlareTail.helpers.theme.list.contains(theme)) {
        FlareTail.helpers.theme.selected = theme;
      }

      // Preload images from CSS
      FlareTail.helpers.theme.preload_images();
    });

    // Date format
    BzDeck.prefs.get('ui.date.relative').then(value => {
      datetime.options.relative = value !== undefined ? value : true;
    });

    // Date timezone
    BzDeck.prefs.get('ui.date.timezone').then(value => {
      datetime.options.timezone = value || 'local';
    });

    // Timeline: Font
    BzDeck.prefs.get('ui.timeline.font.family').then(value => {
      $root.setAttribute('data-ui-timeline-font-family', value || 'proportional');
    });

    // Timeline: Sort order
    BzDeck.prefs.get('ui.timeline.sort.order').then(value => {
      $root.setAttribute('data-ui-timeline-sort-order', value || 'ascending');
    });

    // Timeline: Changes
    BzDeck.prefs.get('ui.timeline.show_cc_changes').then(value => {
      $root.setAttribute('data-ui-timeline-show-cc-changes', value !== undefined ? value : false);
    });

    // Timeline: Attachments
    BzDeck.prefs.get('ui.timeline.display_attachments_inline').then(value => {
      $root.setAttribute('data-ui-timeline-display-attachments-inline', value !== undefined ? value : true);
    });

    // Update user name & image asynchronously
    this.subscribe('UserModel#GravatarProfileRequested', true);
    this.subscribe('UserModel#GravatarImageRequested', true);
    this.subscribe('UserModel#UserInfoUpdated', true);

    // General events
    window.addEventListener('contextmenu', event => event.preventDefault());
    window.addEventListener('dragenter', event => event.preventDefault());
    window.addEventListener('dragover', event => event.preventDefault());
    window.addEventListener('drop', event => event.preventDefault());
    window.addEventListener('wheel', event => event.preventDefault());
    window.addEventListener('popstate', event => this.onpopstate(event));
    window.addEventListener('click', event => this.onclick(event));
    window.addEventListener('keydown', event => this.onkeydown(event));

    // Initiate the corresponding presenter
    this.presenter = BzDeck.presenters.global = new BzDeck.GlobalPresenter(this.id);
  }

  /**
   * Update the document title and statusbar message when the number of unread bugs is changed.
   * @param {Array.<Proxy>} bugs - All unread bugs in the database.
   * @param {Boolean} loaded - Whether bug data is loaded at startup.
   * @param {Number} unread_num - Number of unread bugs currently displayed on the home page.
   * @returns {undefined}
   */
  toggle_unread (bugs, loaded, unread_num) {
    if (document.documentElement.getAttribute('data-current-tab') === 'home') {
      BzDeck.views.pages.home.update_title(
          document.title.replace(/(\s\(\d+\))?$/, unread_num ? ` (${unread_num})` : ''));
    }

    if (!loaded) {
      return;
    }

    if (bugs.length === 0) {
      BzDeck.views.statusbar.show('No new bugs to download'); // l10n

      return;
    }

    bugs.sort((a, b) => new Date(b.last_change_time) - new Date(a.last_change_time));

    let status = bugs.length > 1 ? `You have ${bugs.length} unread bugs` : 'You have 1 unread bug'; // l10n

    BzDeck.views.statusbar.show(status);
  }

  /**
   * Update the document title based on the specified tab.
   * @param {HTMLElement} $tab - Tab to retrieve the label.
   * @returns {undefined}
   */
  update_window_title ($tab) {
    if ($tab.id === 'tab-home') {
      BzDeck.views.pages.home.update_title($tab.title);
    } else {
      document.title = $tab.title.replace('\n', ' – ');
    }
  }

  /**
   * Called whenever the history state is updated. Hide the Sidebar on mobile.
   * @param {PopStateEvent} event - The popstate event.
   * @returns {undefined}
   */
  onpopstate (event) {
    if (FlareTail.helpers.env.device.mobile) {
      document.documentElement.setAttribute('data-sidebar-hidden', 'true');
      document.querySelector('#sidebar').setAttribute('aria-hidden', 'true');
    }
  }

  /**
   * Called whenever any item is clicked or tapped on the page. If the target element is a button or link, open the
   * relevant content in a new in-app tab or browser tab.
   * @param {MouseEvent} event - The click event.
   * @returns {Boolean} default - Whether the event should lead to the default action.
   * @fires AnyView#OpeningBugRequested
   * @fires AnyView#OpeningAttachmentRequested
   * @fires AnyView#OpeningProfileRequested
   */
  onclick (event) {
    let $target = event.target;
    let $parent = $target.parentElement;

    // Discard clicks on the fullscreen dialog
    if ($target === document) {
      return true;
    }

    if ($target.matches('[itemtype$="User"][role="link"]')) {
      this.trigger('AnyView#OpeningProfileRequested', { email: $target.querySelector('[itemprop="email"]').content });

      return FlareTail.helpers.event.ignore(event);
    }

    // Support clicks on the avatar image in a comment
    if ($parent && $parent.matches('[itemtype$="User"][role="link"]')) {
      this.trigger('AnyView#OpeningProfileRequested', { email: $parent.querySelector('[itemprop="email"]').content });

      return FlareTail.helpers.event.ignore(event);
    }

    if ($target.matches(':-moz-any-link, [role="link"]')) {
      let new_win;

      if ($target.hasAttribute('data-bug-id')) {
        // Bug link: open in a new app tab
        this.trigger('AnyView#OpeningBugRequested', { id: Number($target.getAttribute('data-bug-id')) });
      } else if ($target.hasAttribute('data-att-id')) {
        // Attachment link: open in a new app tab
        let $content_type = $target.querySelector('[itemprop="content_type"]');
        let att_id = Number($target.getAttribute('data-att-id'));
        let att_type = $content_type ? ($content_type.content || $content_type.textContent) : undefined;

        if (att_type && ['text/x-github-pull-request', 'text/x-review-board-request'].includes(att_type)) {
          // Open the link directly in a new browser tab
          new_win = window.open();
          new_win.opener = null;
          new_win.location = `${BzDeck.host.origin}/attachment.cgi?id=${att_id}`;
        } else {
          BzDeck.collections.bugs.get_all().then(bugs => {
            return [...bugs.values()].find(bug => (bug.attachments || []).some(att => att.id === att_id)).id;
          }).then(bug_id => {
            if (!bug_id || (FlareTail.helpers.env.device.mobile && window.matchMedia('(max-width: 1023px)').matches)) {
              this.trigger('AnyView#OpeningAttachmentRequested', { id: att_id });
            } else {
              this.trigger('AnyView#OpeningBugRequested', { id: bug_id, att_id });
            }
          });
        }
      } else {
        // Normal link: open in a new browser tab
        new_win = window.open();
        new_win.opener = null;
        new_win.location = $target.href;
      }

      return FlareTail.helpers.event.ignore(event);
    }

    return true;
  }

  /**
   * Called whenever any key is pressed on desktop. Prevent the browser's built-in keyboard shortcuts being triggered,
   * like Ctrl+F to find in page or Ctrl+S to save the page.
   * @param {KeyboardEvent} event - The keydown event.
   * @returns {undefined}
   */
  onkeydown (event) {
    let modifiers = event.shiftKey || event.ctrlKey || event.metaKey || event.altKey;
    let tab = event.key === 'Tab';

    if (!event.target.matches('[role="textbox"], [role="searchbox"]') && !modifiers && !tab) {
      event.preventDefault();
    }
  }

  /**
   * Called whenever a Gravatar profile is required. Retrieve the profile using JSONP because Gravatar doesn't support
   * CORS. Notify UserModel when the profile is ready.
   * @listens UserModel#GravatarProfileRequested
   * @param {String} hash - Hash value of the user's email.
   * @returns {undefined}
   * @fires GlobalView#GravatarProfileProvided
   */
  on_gravatar_profile_requested ({ hash } = {}) {
    let notify = profile => this.trigger('#GravatarProfileProvided', { hash, profile });

    FlareTail.helpers.network.jsonp(`https://secure.gravatar.com/${hash}.json`)
        .then(data => data.entry[0]).then(profile => notify(profile)).catch(error => notify(undefined));
  }

  /**
   * Called whenever a Gravatar image is required. Retrieve the image, or generate a fallback image if the Gravatar
   * image could not be found. Notify UserModel when the image is ready.
   * @listens UserModel#GravatarImageRequested
   * @param {String} hash - Hash value of the user's email.
   * @param {String} color - Generated color of the user for the fallback image.
   * @param {String} initial - Initial of the user for the fallback image.
   * @returns {undefined}
   * @fires GlobalView#GravatarImageProvided
   */
  on_gravatar_image_requested ({ hash, color, initial } = {}) {
    let notify = blob => this.trigger('#GravatarImageProvided', { hash, blob });
    let $image = new Image();
    let $canvas = document.createElement('canvas');
    let ctx = $canvas.getContext('2d');

    $canvas.width = 160;
    $canvas.height = 160;

    $image.addEventListener('load', event => {
      ctx.drawImage($image, 0, 0);
      $canvas.toBlob(notify);
    });

    $image.addEventListener('error', event => {
      // Plain background of the user's color
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, 160, 160);
      // Initial at the center of the canvas
      ctx.font = '110px FiraSans';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#FFF';
      ctx.fillText(initial, 80, 85); // Adjust the baseline by 5px
      $canvas.toBlob(notify);
    });

    $image.crossOrigin = 'anonymous';
    $image.src = `https://secure.gravatar.com/avatar/${hash}?s=160&d=404`;
  }

  /**
   * Called whenever any information of a user is updated. This may happen, for example, when the user's Gravatar is
   * retrieved. Find the user's node on the view and update the displayed information accordingly.
   * @listens UserModel#UserInfoUpdated
   * @param {String} name - Name of the updated person.
   * @returns {undefined}
   */
  on_user_info_updated ({ name } = {}) {
    BzDeck.collections.users.get(name, { name }).then(user => {
      for (let $email of [...document.querySelectorAll(`[itemprop="email"][content="${CSS.escape(user.email)}"]`)]) {
        let title = `${user.original_name || user.name}\n${user.email}`;
        let $person = $email.closest('[itemtype$="User"]');
        let $name = $person.querySelector('[itemprop="name"]');
        let $image = $person.querySelector('[itemprop="image"]');

        if ($person.title && $person.title !== title) {
          $person.title = title;
        }

        if ($name && $name.textContent !== user.name) {
          $name.textContent = user.name;
        }

        if ($image && $image.src !== user.image) {
          $image.src = user.image; // Blob URL
        }
      }
    });
  }
}
