/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/*
 * Initialize the Attachment Model.
 *
 * [argument] data (Object) Bugzilla's raw attachment data object
 * [return] attachment (Proxy) proxified instance of the AttachmentModel object, when called with `new`, so consumers
 *                      can access attachment data seamlessly using attachment.prop instead of attachment.data.prop
 */
BzDeck.models.Attachment = function AttachmentModel (data) {
  this.id = data.id || data.hash; // Use the hash for unuploaded attachments
  this.data = data;

  return this.proxy();
};

BzDeck.models.Attachment.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Attachment.prototype.constructor = BzDeck.models.Attachment;

/*
 * Retrieve attachment data from Bugzilla.
 *
 * [argument] none
 * [return] attachment (Promise -> Proxy or Error) AttachmentModel instance
 */
BzDeck.models.Attachment.prototype.fetch = function () {
  return BzDeck.controllers.global.request(`bug/attachment/${this.id}`).then(result => {
    this.data = result.attachments[this.id];

    return Promise.resolve(this.proxy());
  });
};

/*
 * Get the attachment data only. If it's not in the cache, retrieve it from Bugzilla.
 *
 * [argument] none
 * [return] data (Promise -> Object or Error)
 */
BzDeck.models.Attachment.prototype.get_data = function () {
  let convert = () => {
    let binary = window.atob(this.data.data),
        text = (this.is_patch || this.content_type.startsWith('text/')) ? binary : undefined,
        blob = new Blob([new Uint8Array([...binary].map((x, i) => binary.charCodeAt(i)))],
                        { type: this.content_type });

    return { blob, text, attachment: this };
  };

  if (this.data.data) {
    return Promise.resolve(convert());
  }

  return BzDeck.controllers.global.request(`bug/attachment/${this.id}`,
                                           new URLSearchParams('include_fields=data')).then(result => {
    let attachment = result.attachments[this.id],
        data = attachment && attachment.data ? attachment.data : undefined,
        bug = BzDeck.collections.bugs.get(this.data.bug_id);

    if (!data) {
      return Promise.reject();
    }

    this.data.data = data;

    // Cache the data on the relevant bug
    if (bug && bug.attachments && bug.attachments.length) {
      for (let [index, att] of bug.attachments.entries()) if (att.id === this.id && !att.data) {
        bug.attachments[index].data = data;
        bug.merge(bug.attachments); // Save
      }
    }

    return Promise.resolve(convert());
  }).catch(error => {
    return Promise.reject(new Error(`The attachment ${this.id} cannot be retrieved from Bugzilla.`));
  });
};
