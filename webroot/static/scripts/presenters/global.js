/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Global Presenter that provides some utility functions for presenters.
 * @extends BzDeck.BasePresenter
 * @todo Move this to the worker thread.
 */
BzDeck.GlobalPresenter = class GlobalPresenter extends BzDeck.BasePresenter {
  /**
   * Get a GlobalPresenter instance.
   * @constructor
   * @param {String} id - Unique instance identifier shared with the corresponding view.
   * @returns {Object} presenter - New GlobalPresenter instance.
   */
  constructor (id) {
    super(id); // Assign this.id

    this.timers = new Map();

    // Timer to check for updates, call every 5 minutes or per minute if debugging is enabled
    this.timers.set('fetch_subscriptions', window.setInterval(() => {
      BzDeck.collections.subscriptions.fetch();
    }, 1000 * 60 * (BzDeck.config.debug ? 1 : 5)));

    // Subscribe to events
    this.subscribe('BugModel#AnnotationUpdated', true);
    this.subscribe('AnyView#OpeningBugRequested', true);
    this.subscribe('AnyView#OpeningAttachmentRequested', true);
    this.subscribe('AnyView#OpeningProfileRequested', true);
  }

  /**
   * Called whenever a bug annotation is updated. Notify the change if the type is 'unread'.
   * @listens BugModel#AnnotationUpdated
   * @param {Number} bug_id - Updated bug ID.
   * @param {String} type - Annotation type such as 'starred'.
   * @param {Boolean} value - New annotation value.
   * @returns {undefined}
   */
  on_annotation_updated ({ bug_id, type, value } = {}) {
    if (type === 'unread') {
      this.toggle_unread();
    }
  }

  /**
   * Called whenever opening a bug is requested.
   * @listens AnyView#OpeningBugRequested
   * @param {Number} id - Bug ID.
   * @param {Array.<Number>} [siblings=[]] - Optional bug ID list that can be navigated with the Back and Forward buttons
   * @param {Number} [att_id] - Attachment ID.
   * @returns {undefined}
   */
  on_opening_bug_requested ({ id, siblings = [], att_id } = {}) {
    BzDeck.router.navigate(`/bug/${id}`, { siblings, att_id })
  }

  /**
   * Called whenever opening an attachment is requested.
   * @listens AnyView#OpeningAttachmentRequested
   * @param {Number} id - Attachment ID.
   * @returns {undefined}
   */
  on_opening_attachment_requested ({ id } = {}) {
    BzDeck.router.navigate(`/attachment/${id}`);
  }

  /**
   * Called whenever opening a user profile is requested.
   * @listens AnyView#OpeningProfileRequested
   * @param {String} email - Person's Bugzilla account name.
   * @returns {undefined}
   */
  on_opening_profile_requested ({ email } = {}) {
    BzDeck.router.navigate(`/profile/${email}`);
  }

  /**
   * Determine the number of unread bugs and notify the view.
   * @param {Boolean} [loaded=false] - Whether bug data is loaded at startup.
   * @returns {Promise.<undefined>}
   */
  async toggle_unread (loaded = false) {
    if (!BzDeck.presenters.homepage) {
      return;
    }

    const all_bugs = await BzDeck.collections.bugs.get_all();
    const bugs = [...all_bugs.values()].filter(bug => bug.unread);
    const status = bugs.length > 1 ? `You have ${bugs.length} unread bugs` : 'You have 1 unread bug'; // l10n
    const extract = bugs.slice(0, 3).map(bug => `${bug.id} - ${bug.summary}`).join('\n');
    const unread_num = [...BzDeck.presenters.homepage.data.bugs.values()].filter(bug => bug.unread).length;

    // Update View
    this.view.toggle_unread(bugs, loaded, unread_num);
  }

  /**
   * Parse a bug comment and format as HTML. URLs are automatically converted to links. Bug IDs and attachment IDs are
   * converted to in-app links. Quotes are nested in <blockquote> elements.
   * @param {String} str - Bug comment in plain text, as provided by Bugzilla.
   * @param {Boolean} [is_markdown=true] - Whether the comment is written in Markdown.
   * @returns {String} str - HTML-formatted comment.
   * @todo Add more autolinkification support (#68)
   * @todo Improve the performance probably using a worker.
   */
  parse_comment (str, is_markdown = true) {
    const blockquote = p => {
      const regex = /^&gt;\s?/gm;

      if (!p.match(regex)) {
        return p;
      }

      const lines = p.split(/\n/);
      let quote = [];

      for (const [i, line] of lines.entries()) {
        if (line.match(regex)) {
          // A quote start
          quote.push(line);
        }

        if ((!line.match(regex) || !lines[i + 1]) && quote.length) {
          // A quote end, the next line is not a part of the quote, or no more lines
          const quote_str = quote.join('\n');
          let quote_repl = quote_str.replace(regex, '');

          if (quote_repl.match(regex)) {
            // Nested quote(s) found, do recursive processing
            quote_repl = blockquote(quote_repl);
          }

          for (const p of quote_repl.split(/\n{2,}/)) {
            quote_repl = quote_repl.replace(p, `<p>${p}</p>`);
          }

          p = p.replace(quote_str, `<blockquote>${quote_repl}</blockquote>`);
          quote = [];
        }
      }

      return p;
    };

    // Autolinkification of general URLs
    const linkify_general = () => {
      str = str.replace(
        /((https?|feed|ftps?|ircs?|mailto|news):(?:\/\/)?[\w-]+(\.[\w-]+)+((&amp;|[\w.,@?^=%$:\/~+#-])*(&amp;|[\w@?^=%$\/~+#-]))?)/gm,
        '<a href="$1">$1</a>'
      );

      // Email links
      // http://www.w3.org/TR/html5/forms.html#valid-e-mail-address
      str = str.replace(
        /^([a-zA-Z0-9.!#$%&\'*+\/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*)$/,
        '<a href="mailto:$1">$1</a>'
      );
    };

    // Autolinkification of bug IDs, attachment IDs, etc.
    const linkify_bugzilla = () => {
      str = str.replace(/Bug\s*#?(\d+)/igm, '<a href="/bug/$1" data-bug-id="$1">$&</a>');
      str = str.replace(/Attachment\s*#?(\d+)/igm, '<a href="/attachment/$1" data-att-id="$1">$&</a>');
    };

    if (!str.trim()) {
      return '';
    }

    // Remove the attachment ID and description automatically inserted by Bugzilla. Previously, we were using the
    // comment.raw_text field that didn't contain this label, but it has been removed with Bugzilla 5.0, so modify the
    // comment.text field here instead. This probably won't work with localized Bugzilla instances.
    str = str.replace(/^Created\ attachment\ \d+\n.*\n?/m, '');

    if (is_markdown) {
      linkify_bugzilla();

      // Parse the Markdown with a library
      return (new showdown.Converter()).makeHtml(str);
    }

    str = FlareTail.helpers.string.sanitize(str);

    // Quotes
    for (const p of str.split(/\n{2,}/)) {
      str = str.replace(p, `<p>${blockquote(p)}</p>`);
    }

    str = str.replace(/\n{2,}/gm, '').replace(/\n/gm, '<br>');

    linkify_general();
    linkify_bugzilla();

    return str;
  }
}
