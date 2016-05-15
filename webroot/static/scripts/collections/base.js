/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

BzDeck.collections = BzDeck.collections || {};

/**
 * Define the app's Base Collection. This constructor is intended to be inherited by the app's each collection.
 * @abstract
 * @extends FlareTail.app.Collection
 */
BzDeck.BaseCollection = class BaseCollection extends FlareTail.app.Collection {}
