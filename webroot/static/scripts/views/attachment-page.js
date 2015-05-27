/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.views.AttachmentPage = function AttachmentPageView (page_id, attachment_id) {
  this.id = page_id;
  this.attachment_id = attachment_id;

  this.$tab = document.querySelector(`#tab-attachment-${this.id}`);
  this.$tabpanel = document.querySelector(`#tabpanel-attachment-${this.id}`);
  this.$tabpanel.querySelector('h2 [itemprop="id"]').textContent = this.attachment_id;

  this.on('C:AttachmentAvailable', data => {
    let attachment = this.attachment = data.attachment,
        { id, summary } = attachment;

    new this.widget.ScrollBar(this.$tabpanel.querySelector('article > div'));
    new BzDeck.views.Attachment(attachment, this.$tabpanel.querySelector('.scrollable-area-content'));

    this.$tab.title = `Attachment ${id}\n${summary}`; // l10n;
    this.update_window_title(this.$tab);
  });

  this.on('C:AttachmentUnavailable', data => {
    let id = this.attachment_id,
        error = data.attachment && data.attachment.error ? data.attachment.error : '';

    BzDeck.views.statusbar.show(`The attachment ${id} cannot be retrieved. ${error}`); // l10n
  });

  this.on('C:Offline', () => {
    BzDeck.views.statusbar.show('You have to go online to load the bug.'); // l10n
  });

  this.on('C:LoadingStarted', () => {
    BzDeck.views.statusbar.show('Loading...'); // l10n
  });

  this.on('C:LoadingError', () => {
    BzDeck.views.statusbar.show('ERROR: Failed to load data.'); // l10n
  });

  this.on('C:LoadingComplete', () => {
    this.$tabpanel.removeAttribute('aria-busy');
  });
};

BzDeck.views.AttachmentPage.prototype = Object.create(BzDeck.views.Base.prototype);
BzDeck.views.AttachmentPage.prototype.constructor = BzDeck.views.AttachmentPage;
