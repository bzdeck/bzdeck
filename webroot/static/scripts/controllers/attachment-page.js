/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.controllers.AttachmentPage = function AttachmentPageController (att_id) {
  let $$tablist = BzDeck.views.banner.$$tablist;

  this.id = Date.now(); // The page/tab is not assosiated with an attachment, because it's reused when navigated
  this.att_id = att_id;

  // Find an existing tab
  for (let [page_id, page_view] of BzDeck.views.pages.attachment_list || []) {
    if (page_view.att_id === this.att_id && page_view.$tab.parentElement) {
      $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;

      return page_view.controller;
    }
  }

  BzDeck.views.banner.open_tab({
    page_category: 'attachment',
    page_id: this.id,
    page_constructor: BzDeck.views.AttachmentPage,
    page_constructor_args: [this.id, this.att_id],
    tab_label: isNaN(this.att_id) ? 'New Attachment' : `Attachment ${this.att_id}`,
    tab_position: 'next',
  }, this);

  this.init();

  return this;
};

BzDeck.controllers.AttachmentPage.route = '/attachment/(\\d+|[a-z0-9]{32})';

BzDeck.controllers.AttachmentPage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.AttachmentPage.prototype.constructor = BzDeck.controllers.AttachmentPage;

BzDeck.controllers.AttachmentPage.prototype.init = function () {
  let attachment = BzDeck.collections.attachments.get(this.att_id);

  // If found, show it
  if (attachment) {
    this.attachment = attachment;
    this.trigger(':AttachmentAvailable', { attachment });
    this.trigger(':LoadingComplete');

    return;
  }

  // If the ID is hash, it's an unuploaded attachment. And if the cache cound not be found, just raise an error
  if (isNaN(this.att_id)) {
    this.trigger(':LoadingError');

    return;
  }

  if (!navigator.onLine) {
    this.trigger(':Offline');

    return;
  }

  // If no cache found, try to retrieve it from Bugzilla
  this.trigger(':LoadingStarted');

  BzDeck.collections.attachments.get(this.att_id, { id: this.att_id }).fetch().then(attachment => {
    if (attachment) {
      this.attachment = attachment;
      this.trigger(':AttachmentAvailable', { attachment });
    } else {
      this.trigger(':AttachmentUnavailable', { attachment });
    }
  }).catch(error => {
    this.trigger(':LoadingError');
  }).then(() => {
    this.trigger(':LoadingComplete');
  });
};
