/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Define the Attachment Page View that represents the Bug Attachment Page tabpanel content.
 * @extends BzDeck.BaseView
 */
BzDeck.AttachmentPageView = class AttachmentPageView extends BzDeck.BaseView {
  /**
   * Called by the app router and initialize the Attachment Page View. If the specified attachment has an existing tab,
   * switch to it. Otherwise, open a new tab and try to load the attachment.
   * @constructor
   * @param {(Number|String)} att_id - Numeric ID for an existing file or md5 hash for an unuploaded file.
   * @returns {AttachmentPageView} New AttachmentPageView instance.
   */
  constructor (att_id) {
    super(); // Assign this.id

    this.att_id = att_id;

    // Subscribe to events
    this.subscribe('P#AttachmentAvailable');
    this.subscribe('P#LoadingComplete');

    this.activate();
  }

  /**
   * Called by the app router to reuse the view.
   * @param {(Number|String)} att_id - Numeric ID for an existing file or md5 hash for an unuploaded file.
   */
  reactivate (att_id) {
    const $$tablist = BzDeck.views.main.$$tablist;

    // Find an existing tab
    for (const [page_id, page_view] of BzDeck.views.pages.attachment_list || []) {
      if (page_view.att_id === this.att_id && page_view.$tab.parentElement) {
        $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;

        return;
      }
    }

    this.activate();
  }

  /**
   * Activate the view.
   */
  activate () {
    BzDeck.views.main.open_tab({
      label: isNaN(this.att_id) ? 'New Attachment' : `Attachment ${this.att_id}`, // l10n
      category: 'attachment',
    }, this);

    this.$tab = document.querySelector(`#tab-attachment-${this.id}`);
    this.$tabpanel = document.querySelector(`#tabpanel-attachment-${this.id}`);
    this.$tabpanel.querySelector('h2 [itemprop="id"]').textContent = this.att_id;
    this.$placeholder = this.$tabpanel.querySelector('article > div');

    // Initiate the corresponding presenter and sub-view
    this.presenter = new BzDeck.AttachmentPagePresenter(this.id, this.att_id);
    this.attachment_view = new BzDeck.AttachmentView(this.id, this.att_id, this.$placeholder);
  }

  /**
   * Called when the attachment is found. Render it on the page.
   * @listens AttachmentPresenter#AttachmentAvailable
   */
  async on_attachment_available () {
    const { id, hash, summary } = await BzDeck.collections.attachments.get(this.att_id);

    if (hash) {
      this.$tab.title = this.$tabpanel.querySelector('h2').textContent = `New Attachment\n${summary}`; // l10n
    } else {
      this.$tab.title = `Attachment ${id}\n${summary}`; // l10n
    }

    BzDeck.views.global.update_window_title(this.$tab);
  }

  /**
   * Called when loading the attachment completed. Remove the throbber.
   * @listens AttachmentPresenter#LoadingComplete
   */
  on_loading_complete () {
    this.$tabpanel.removeAttribute('aria-busy');
  }
}
