/**
 * BzDeck Attachment Page Controller
 * Copyright © 2015 Kohei Yoshino. All rights reserved.
 *
 * This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 */

BzDeck.controllers.AttachmentPage = function AttachmentPageController (attachment_id) {
  let $$tablist = BzDeck.views.toolbar.$$tablist;

  // Find an existing tab
  for (let [page_id, page_view] of BzDeck.views.pages.attachment_list || []) {
    if (page_view.attachment_id === attachment_id && page_view.$tab.parentElement) {
      $$tablist.view.selected = $$tablist.view.$focused = page_view.$tab;

      return page_view.controller;
    }
  }

  this.id = Date.now(); // The page/tab is not assosiated with an attachment, because it's reused when navigated
  this.attachment_id = attachment_id;

  BzDeck.views.toolbar.open_tab({
    'page_category': 'attachment',
    'page_id': this.id,
    'page_constructor': BzDeck.views.AttachmentPage,
    'page_constructor_args': [this.id, this.attachment_id],
    'tab_label': `Attachment ${this.attachment_id}`,
    'tab_position': 'next',
  }, this);

  this.init();

  return this;
};

BzDeck.controllers.AttachmentPage.route = '/attachment/(\\d+)';

BzDeck.controllers.AttachmentPage.prototype = Object.create(BzDeck.controllers.Base.prototype);
BzDeck.controllers.AttachmentPage.prototype.constructor = BzDeck.controllers.AttachmentPage;

BzDeck.controllers.AttachmentPage.prototype.init = function () {
  let attachment;

  // Find the attachment in the local bug store
  for (let bug of BzDeck.collections.bugs.get_all().values()) if (bug.attachments && bug.attachments.length) {
    attachment = bug.attachments.find(att => att.id === this.attachment_id);

    if (attachment) {
      break;
    }
  }

  // If found, show it
  if (attachment) {
    this.attachment = attachment;
    this.trigger(':AttachmentAvailable', { attachment });
    this.trigger(':LoadingComplete');

    return;
  }

  if (!navigator.onLine) {
    this.trigger(':Offline');

    return;
  }

  // If no cache found, try to retrieve it from Bugzilla
  this.trigger(':LoadingStarted');

  BzDeck.controllers.global.request(`bug/attachment/${this.attachment_id}`).then(result => {
    attachment = result.attachments[this.attachment_id];

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
