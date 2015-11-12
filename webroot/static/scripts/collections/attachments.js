/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * Initialize the Attachment Collection.
 *
 * @constructor
 * @extends BaseCollection
 * @argument {undefined}
 * @return {Object} attachments - New AttachmentCollection instance.
 */
BzDeck.collections.Attachments = function AttachmentCollection () {
  this.model = BzDeck.models.Attachment;
};

BzDeck.collections.Attachments.prototype = Object.create(BzDeck.collections.Base.prototype);
BzDeck.collections.Attachments.prototype.constructor = BzDeck.collections.Attachments;

/**
 * Load the all attachment data from local bug cache, create a new AttachmentModel instance for each item, cache them in
 * a new Map for faster access, then return a Promise to make consistent with the super load method.
 *
 * @argument {undefined}
 * @return {Promise.<Map.<Number, Proxy>>} attachments - AttachmentModel instances.
 */
BzDeck.collections.Attachments.prototype.load = function () {
  // This map's key is usually an attachment ID, but it can be a hash value for an unuploaded attachment as the cache
  // method below shows.
  this.map = new Map();

  for (let bug of BzDeck.collections.bugs.get_all().values()) {
    for (let att of bug.attachments || []) {
      this.map.set(att.id, new this.model(att));
    }
  }

  return Promise.resolve(this.map);
};

/**
 * Cache an unuploaded attachment data temporarily on memory.
 *
 * @argument {Object} att - Raw attachment upload object for Bugzilla.
 * @argument {Integer} size - Actual file size.
 * @return {Proxy} attachment - AttachmentModel instance.
 */
BzDeck.collections.Attachments.prototype.cache = function (att, size) {
  let current_time = (new Date()).toISOString();

  // Add custom properties to make it easier to find the cached attachment, track the upload status and update the view.
  // These properties are unenumerable so later dropped by Object.assign() before the data is sent through the API.
  Object.defineProperties(att, {
    uploaded: { writable: true, value: 0 },
    hash: { value: md5([att.file_name, att.content_type, String(size)].join()) },
    is_unuploaded: { value: true },
    // Emulate properties on the existing attachment objects
    creator: { value: BzDeck.models.account.data.name },
    creation_time: { value: current_time },
    last_change_time: { value: current_time },
    size: { value: size },
    is_obsolete: { value: false },
  });

  att = new this.model(att);
  this.map.set(att.hash, att);

  return att;
};
