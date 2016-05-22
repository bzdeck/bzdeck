/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Global Controller that provides some utility functions for controllers.
 * @extends BzDeck.BaseController
 */
BzDeck.GlobalController = class GlobalController extends BzDeck.BaseController {
  /**
   * Get a GlobalController instance.
   * @constructor
   * @listens GlobalView:OpenBug
   * @listens GlobalView:OpenAttachment
   * @listens GlobalView:OpenProfile
   * @param {undefined}
   * @returns {Object} controller - New GlobalController instance.
   */
  constructor () {
    super(); // This does nothing but is required before using `this`

    this.subscribe_safe('BugModel:AnnotationUpdated', true);
    this.subscribe('UserModel:GravatarProfileRequested', true);
    this.subscribe('UserModel:GravatarImageRequested', true);

    // Navigation, can be requested by any view
    this.on('V:OpenBug',
            data => BzDeck.router.navigate(`/bug/${data.id}`, { ids: data.ids, att_id: data.att_id }), true);
    this.on('V:OpenAttachment', data => BzDeck.router.navigate(`/attachment/${data.id}`), true);
    this.on('V:OpenProfile', data => BzDeck.router.navigate(`/profile/${data.email}`), true);
  }

  /**
   * Prepare the corresponding view. This should be called after the prefs are retrieved.
   * @param {undefined}
   * @returns {undefined}
   */
  init () {
    this.view = BzDeck.views.global = new BzDeck.GlobalView();
  }

  /**
   * Called whenever a bug annotation is updated. Notify the change if the type is 'unread'.
   * @listens BugModel:AnnotationUpdated
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
   * Called whenever a Gravatar profile is required. Retrieve the profile using JSONP because Gravatar doesn't support
   * CORS. Notify UserModel when the profile is ready.
   * @listens UserModel:GravatarProfileRequested
   * @param {String} hash - Hash value of the user's email.
   * @returns {undefined}
   * @fires GlobalController:GravatarProfileProvided
   */
  on_gravatar_profile_requested ({ hash } = {}) {
    let notify = profile => this.trigger(':GravatarProfileProvided', { hash, profile });

    this.helpers.network.jsonp(`https://secure.gravatar.com/${hash}.json`)
        .then(data => data.entry[0]).then(profile => notify(profile)).catch(error => notify(undefined));
  }

  /**
   * Called whenever a Gravatar image is required. Retrieve the image, or generate a fallback image if the Gravatar
   * image could not be found. Notify UserModel when the image is ready.
   * @listens UserModel:GravatarImageRequested
   * @param {String} hash - Hash value of the user's email.
   * @param {String} color - Generated color of the user for the fallback image.
   * @param {String} initial - Initial of the user for the fallback image.
   * @returns {undefined}
   * @fires GlobalController:GravatarImageProvided
   */
  on_gravatar_image_requested ({ hash, color, initial } = {}) {
    let notify = blob => this.trigger(':GravatarImageProvided', { hash, blob });
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
   * Determine the number of unread bugs and notify the view.
   * @param {Boolean} [loaded=false] - Whether bug data is loaded at startup.
   * @returns {undefined}
   */
  toggle_unread (loaded = false) {
    if (!BzDeck.controllers.homepage) {
      return;
    }

    BzDeck.collections.bugs.get_all().then(bugs => {
      return [...bugs.values()].filter(bug => bug.unread);
    }).then(bugs => {
      let status = bugs.length > 1 ? `You have ${bugs.length} unread bugs` : 'You have 1 unread bug'; // l10n
      let extract = bugs.slice(0, 3).map(bug => `${bug.id} - ${bug.summary}`).join('\n');
      let unread_num = [...BzDeck.controllers.homepage.data.bugs.values()].filter(bug => bug.unread).length;

      // Update View
      this.view.toggle_unread(bugs, loaded, unread_num);
    });
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
    let blockquote = p => {
      let regex = /^&gt;\s?/gm;

      if (!p.match(regex)) {
        return p;
      }

      let lines = p.split(/\n/);
      let quote = [];

      for (let [i, line] of lines.entries()) {
        if (line.match(regex)) {
          // A quote start
          quote.push(line);
        }

        if ((!line.match(regex) || !lines[i + 1]) && quote.length) {
          // A quote end, the next line is not a part of the quote, or no more lines
          let quote_str = quote.join('\n');
          let quote_repl = quote_str.replace(regex, '');

          if (quote_repl.match(regex)) {
            // Nested quote(s) found, do recursive processing
            quote_repl = blockquote(quote_repl);
          }

          for (let p of quote_repl.split(/\n{2,}/)) {
            quote_repl = quote_repl.replace(p, `<p>${p}</p>`);
          }

          p = p.replace(quote_str, `<blockquote>${quote_repl}</blockquote>`);
          quote = [];
        }
      }

      return p;
    };

    // Autolinkification of general URLs
    let linkify_general = () => {
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
    let linkify_bugzilla = () => {
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

    str = this.helpers.string.sanitize(str);

    // Quotes
    for (let p of str.split(/\n{2,}/)) {
      str = str.replace(p, `<p>${blockquote(p)}</p>`);
    }

    str = str.replace(/\n{2,}/gm, '').replace(/\n/gm, '<br>');

    linkify_general();
    linkify_bugzilla();

    return str;
  }
}

BzDeck.GlobalController.prototype.timers = new Map();
