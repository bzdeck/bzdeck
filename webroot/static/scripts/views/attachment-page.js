/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Attachment Page View that represents the Bug Attachment Page tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.AttachmentPageView = class AttachmentPageView extends BzDeck.BaseView {
  /**
   * Get a AttachmentPageView instance.
   * @constructor
   * @param {Number} page_id - 13-digit identifier for a new instance, generated with Date.now().
   * @param {(Number|String)} att_id - Numeric ID for an existing file or md5 hash for an unuploaded file.
   * @returns {Object} view - New AttachmentPageView instance.
   */
  constructor (page_id, att_id) {
    super(); // This does nothing but is required before using `this`

    this.id = page_id;
    this.att_id = att_id;

    this.$tab = document.querySelector(`#tab-attachment-${this.id}`);
    this.$tabpanel = document.querySelector(`#tabpanel-attachment-${this.id}`);
    this.$tabpanel.querySelector('h2 [itemprop="id"]').textContent = this.att_id;

    this.subscribe_safe('C:AttachmentAvailable');
    this.subscribe_safe('C:AttachmentUnavailable');
    this.subscribe('C:Offline');
    this.subscribe('C:LoadingStarted');
    this.subscribe('C:LoadingError');
    this.subscribe('C:LoadingComplete');
  }

  /**
   * Called when the attachment is found. Render it on the page.
   * @listens AttachmentPageController:AttachmentAvailable
   * @param {Proxy}  attachment - Added attachment data as an AttachmentModel instance.
   * @returns {undefined}
   */
  on_attachment_available ({ attachment } = {}) {
    this.attachment = attachment;

    let $attachment = this.$tabpanel.querySelector('article > div');
    let { id, hash, summary } = attachment;

    new this.widgets.ScrollBar($attachment);
    new BzDeck.AttachmentView(attachment, $attachment);

    if (hash) {
      this.$tab.title = this.$tabpanel.querySelector('h2').textContent = `New Attachment\n${summary}`; // l10n
    } else {
      this.$tab.title = `Attachment ${id}\n${summary}`; // l10n
    }

    BzDeck.views.global.update_window_title(this.$tab);
  }

  /**
   * Called when the attachment is not found. Show an error message on the page.
   * @listens AttachmentPageController:AttachmentUnavailable
   * @param {Proxy}  attachment - Added attachment data as an AttachmentModel instance.
   * @returns {undefined}
   */
  on_attachment_unavailable ({ attachment } = {}) {
    let id = this.att_id;
    let error = attachment && attachment.error ? attachment.error : '';

    BzDeck.views.statusbar.show(`The attachment ${id} could not be retrieved. ${error}`); // l10n
  }

  /**
   * Called when the attachment cannot be retrieved because the device or browser is offline. Show a message to ask the
   * user to go online.
   * @listens AttachmentPageController:Offline
   * @param {undefined}
   * @returns {undefined}
   * @todo reload when going online.
   */
  on_offline () {
    BzDeck.views.statusbar.show('You have to go online to load the bug.'); // l10n
  }

  /**
   * Called when loading the attachment started. Show a message accordingly.
   * @listens AttachmentPageController:LoadingStarted
   * @param {undefined}
   * @returns {undefined}
   */
  on_loading_started () {
    BzDeck.views.statusbar.show('Loading...'); // l10n
  }

  /**
   * Called when loading the attachment failed. Show a message accordingly.
   * @listens AttachmentPageController:LoadingError
   * @param {undefined}
   * @returns {undefined}
   */
  on_loading_error () {
    BzDeck.views.statusbar.show('ERROR: Failed to load data.'); // l10n
  }

  /**
   * Called when loading the attachment completed. Remove the throbber.
   * @listens AttachmentPageController:LoadingComplete
   * @param {undefined}
   * @returns {undefined}
   */
  on_loading_complete () {
    this.$tabpanel.removeAttribute('aria-busy');
  }
}
