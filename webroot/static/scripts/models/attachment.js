/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Attachment Model that represents a downloaded or unuploaded bug attachment. Available through the
 * AttachmentCollection.
 *
 * @constructor
 * @extends BaseModel
 * @argument {Object} data - Bugzilla's raw attachment object or unuploaded attachment object.
 * @return {Proxy} attachment - Proxified AttachmentModel instance, so consumers can seamlessly access attachment
 *  properties via attachment.prop instead of attachment.data.prop.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html}
 */
BzDeck.models.Attachment = function AttachmentModel (data) {
  this.id = data.id || data.hash; // Use the hash for unuploaded attachments
  this.data = data;

  return this.proxy();
};

BzDeck.models.Attachment.prototype = Object.create(BzDeck.models.Base.prototype);
BzDeck.models.Attachment.prototype.constructor = BzDeck.models.Attachment;

/**
 * Retrieve the attachment from Bugzilla.
 *
 * @argument {undefined}
 * @return {Promise.<Proxy>} attachment - Promise to be resolved in the AttachmentModel instance.
 * @see {@link http://bugzilla.readthedocs.org/en/latest/api/core/v1/attachment.html#get-attachment}
 */
BzDeck.models.Attachment.prototype.fetch = function () {
  return BzDeck.controllers.global.request(`bug/attachment/${this.id}`).then(result => {
    this.data = result.attachments[this.id];

    return Promise.resolve(this.proxy());
  });
};

/**
 * Get the attachment raw file data only. If it's not in the cache, retrieve the data from Bugzilla and save it in the
 * local database.
 *
 * @argument {undefined}
 * @return {Promise.<Object>} data - Promise to be resolved in an object containing the Blob and plaintext data, and
 *  this AttachmentModel.
 */
BzDeck.models.Attachment.prototype.get_data = function () {
  let decode = () => new Promise(resolve => {
    let worker = new SharedWorker('/static/scripts/workers/shared.js');

    worker.port.addEventListener('message', event => {
      let { binary, blob } = event.data,
          text = (this.is_patch || this.content_type.startsWith('text/')) ? binary : undefined;

      resolve({ blob, text, attachment: this });
    });

    worker.port.start();
    worker.port.postMessage(['decode', { str: this.data.data, type: this.content_type }]);
  });

  if (this.data.data) {
    return Promise.resolve(decode());
  }

  return BzDeck.controllers.global.request(`bug/attachment/${this.id}`,
                                           new URLSearchParams('include_fields=data')).then(result => {
    let attachment = result.attachments[this.id],
        data = attachment && attachment.data ? attachment.data : undefined;

    if (!data) {
      return Promise.reject();
    }

    this.data.data = data;
    BzDeck.collections.attachments.set(this.id, this.data);
    this.save();

    return Promise.resolve(decode());
  }).catch(error => {
    return Promise.reject(new Error(`The attachment ${this.id} cannot be retrieved from Bugzilla.`));
  });
};

/**
 * Save this attachment as part of the relevant bug.
 *
 * @argument {undefined}
 * @return {Promise.<Proxy>} item - Promise to be resolved in the proxified AttachmentModel instance.
 */
BzDeck.models.Attachment.prototype.save = function () {
  let bug = BzDeck.collections.bugs.get(this.data.bug_id);

  if (bug && bug.attachments && bug.attachments.length) {
    for (let [index, att] of bug.attachments.entries()) if (att.id === this.id && !att.data) {
      bug.attachments[index].data = this.data.data;
    }

    bug.save(bug.data);
  }

  return Promise.resolve(this.proxy());
};
